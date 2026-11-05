import type { Prisma, PrismaClient } from '@prisma/client'
import { AiError, type AiFailure } from '@/server/ai/llm-core'
import { hashInput } from './inputs'
import { PROMPT_VERSIONS } from './prompts'
import type { InsightFeature } from './schemas'

// Stored AI insights, and the rules around generating one: reuse a result
// whose input, prompt version and model are unchanged; refuse past the user's
// daily limit; record failures too (they count toward the limit, so a broken
// provider cannot be hammered from one account). Every query is scoped to the
// caller's id; the Prisma client and the generator are passed in, so the tests
// run this against a test database with a fake model. See docs/rules/ai-usage.md.

type Owner = { db: PrismaClient; userId: string }

/** Generations (successful or failed) one user may start in 24 hours. Cached reads are free. */
export const DAILY_GENERATION_LIMIT = 20
const DAY_MS = 86_400_000

export interface StoredInsight<T> {
	readonly id: string
	readonly feature: InsightFeature
	readonly subjectId: string
	readonly model: string
	readonly promptVersion: string
	readonly createdAt: Date
	readonly output: T
}

export interface InsightResult<T> {
	readonly insight: StoredInsight<T>
	/** True when an earlier result for the same input was reused, at no cost. */
	readonly cached: boolean
}

const toJson = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value))

type Row = {
	id: string
	feature: string
	subjectId: string
	model: string
	promptVersion: string
	createdAt: Date
	output: Prisma.JsonValue
}

function toStored<T>(
	row: Row,
	feature: InsightFeature,
	parse: (value: unknown) => T
): StoredInsight<T> {
	return {
		id: row.id,
		feature,
		subjectId: row.subjectId,
		model: row.model,
		promptVersion: row.promptVersion,
		createdAt: row.createdAt,
		output: parse(row.output)
	}
}

/** The caller's latest successful insight about a subject, or null. */
export async function latestInsight<T>({
	db,
	userId,
	feature,
	subjectId,
	parse
}: Owner & {
	feature: InsightFeature
	subjectId: string
	parse: (value: unknown) => T
}): Promise<StoredInsight<T> | null> {
	const row = await db.aiInsight.findFirst({
		where: { userId, feature, subjectId, status: 'ok' },
		orderBy: { createdAt: 'desc' }
	})
	return row == null ? null : toStored(row, feature, parse)
}

/** How many generations the caller started since `since`. */
export function generationsSince({ db, userId, since }: Owner & { since: Date }): Promise<number> {
	return db.aiInsight.count({ where: { userId, createdAt: { gt: since } } })
}

/**
 * The stored result for this exact input, or a new generation. Throws AiError
 * `quota_exceeded` past the daily limit, and rethrows the generator's AiError
 * after recording the failure.
 */
export async function getOrGenerateInsight<T>({
	db,
	userId,
	feature,
	subjectId,
	input,
	model,
	parse,
	generate,
	now = new Date(),
	dailyLimit = DAILY_GENERATION_LIMIT
}: Owner & {
	feature: InsightFeature
	subjectId: string
	input: unknown
	/** The model that will answer, part of what makes a cached result reusable. */
	model: string
	parse: (value: unknown) => T
	generate: () => Promise<{ data: T }>
	now?: Date
	dailyLimit?: number
}): Promise<InsightResult<T>> {
	const promptVersion = PROMPT_VERSIONS[feature]
	const inputHash = hashInput(input)
	const reusable = await db.aiInsight.findFirst({
		where: { userId, feature, subjectId, inputHash, promptVersion, model, status: 'ok' },
		orderBy: { createdAt: 'desc' }
	})
	if (reusable != null) return { insight: toStored(reusable, feature, parse), cached: true }

	const used = await generationsSince({ db, userId, since: new Date(now.getTime() - DAY_MS) })
	if (used >= dailyLimit) throw new AiError('quota_exceeded')

	const base = { userId, feature, subjectId, promptVersion, inputHash, createdAt: now }
	try {
		const result = await generate()
		const row = await db.aiInsight.create({
			data: { ...base, model, status: 'ok', output: toJson(result.data) }
		})
		return { insight: toStored(row, feature, parse), cached: false }
	} catch (error) {
		const failure: AiFailure = error instanceof AiError ? error.failure : 'unavailable'
		await db.aiInsight.create({ data: { ...base, model, status: 'failed', errorCode: failure } })
		throw error instanceof AiError ? error : new AiError('unavailable', { cause: error })
	}
}
