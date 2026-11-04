import type { PracticeAttempt as AttemptRow, PrismaClient } from '@prisma/client'
import { redactSecrets } from '@/features/assessment/redact'
import { SKILL_IDS, type SkillId } from '@/features/assessment/rubric'
import { getChallenge } from './challenge-repository'
import { rulesEvaluator } from './evaluate'
import { reviewAfter, type AttemptRecord } from './plan'
import { DIFFICULTIES, type Difficulty, type Evaluation, type PromptEvaluator } from './types'
import { evaluationSchema } from './stored'

// Every read and write of a user's practice attempts. Like the workspace
// repository, each function takes the caller's id from the session and scopes
// every query to it; the Prisma client is passed in so tests can run these
// against a test database. Scoring happens here, on the server, never in the
// browser.

type Owner = { db: PrismaClient; userId: string }

export interface StoredAttempt extends AttemptRecord {
	/** The exact challenge version scored against; null only for unlinked legacy rows. */
	readonly challengeVersionId: string | null
	/** That version's title, so history reads right even after the challenge changes. */
	readonly title: string | null
	readonly prompt: string
	readonly band: string
	readonly evaluator: string
	readonly assessmentId: string | null
	readonly evaluation: Evaluation
}

const toJson = (value: unknown) => JSON.parse(JSON.stringify(value))

function skillOf(value: string): SkillId {
	const skill = SKILL_IDS.find((each) => each === value)
	if (skill == null) throw new Error(`Stored practice skill "${value}" is not a rubric skill`)
	return skill
}

function difficultyOf(value: string): Difficulty {
	const difficulty = DIFFICULTIES.find((each) => each === value)
	if (difficulty == null) throw new Error(`Stored difficulty "${value}" is not known`)
	return difficulty
}

type AttemptWithTitle = AttemptRow & { scoredVersion: { title: string } | null }

const WITH_TITLE = { scoredVersion: { select: { title: true } } } as const

function toStored(row: AttemptWithTitle): StoredAttempt {
	return {
		id: row.id,
		challengeSlug: row.challengeSlug,
		challengeVersion: row.challengeVersion,
		challengeVersionId: row.challengeVersionId,
		title: row.scoredVersion?.title ?? null,
		skill: skillOf(row.skill),
		difficulty: difficultyOf(row.difficulty),
		score: row.score,
		createdAt: row.createdAt,
		reviewAfter: row.reviewAfter,
		prompt: row.prompt,
		band: row.band,
		evaluator: row.evaluator,
		assessmentId: row.assessmentId,
		evaluation: evaluationSchema.parse(row.evaluation)
	}
}

/**
 * Scores an answer against the challenge's current version, loaded from the
 * database, and saves it as a new attempt linked to that exact version. The
 * answer is redacted before it is scored or stored; the assessment link is the
 * caller's own latest assessment, looked up here. Returns null for an unknown
 * or retired challenge.
 */
export async function recordAttempt({
	db,
	userId,
	slug,
	prompt,
	evaluator = rulesEvaluator,
	now = new Date()
}: Owner & {
	slug: string
	prompt: string
	evaluator?: PromptEvaluator
	now?: Date
}): Promise<StoredAttempt | null> {
	const [challenge, latest] = await Promise.all([
		getChallenge({ db, slug }),
		db.assessment.findFirst({
			where: { userId },
			orderBy: { createdAt: 'desc' },
			select: { id: true }
		})
	])
	if (challenge == null || !challenge.isActive) return null
	const answer = redactSecrets(prompt.trim()).text
	const evaluation = evaluator.evaluate({ challenge, prompt: answer })
	const row = await db.practiceAttempt.create({
		data: {
			userId,
			assessmentId: latest?.id ?? null,
			challengeVersionId: challenge.versionId,
			challengeSlug: challenge.slug,
			challengeVersion: challenge.version,
			skill: challenge.skill,
			exerciseType: challenge.type,
			difficulty: challenge.difficulty,
			prompt: answer,
			score: evaluation.score,
			band: evaluation.band,
			evaluator: evaluation.evaluator,
			evaluation: toJson(evaluation),
			reviewAfter: reviewAfter({ score: evaluation.score, from: now }),
			createdAt: now
		},
		include: WITH_TITLE
	})
	return toStored(row)
}

/** Every attempt of the caller, newest first. */
export async function listAttempts({ db, userId }: Owner): Promise<StoredAttempt[]> {
	const rows = await db.practiceAttempt.findMany({
		where: { userId },
		orderBy: { createdAt: 'desc' },
		include: WITH_TITLE
	})
	return rows.map(toStored)
}

/** The caller's best score at each of these challenges; a challenge never tried is absent. */
export async function bestScores({
	db,
	userId,
	slugs
}: Owner & { slugs: readonly string[] }): Promise<Map<string, number>> {
	if (slugs.length === 0) return new Map()
	const rows = await db.practiceAttempt.groupBy({
		by: ['challengeSlug'],
		where: { userId, challengeSlug: { in: [...slugs] } },
		_max: { score: true }
	})
	return new Map(
		rows.flatMap((row) => (row._max.score == null ? [] : [[row.challengeSlug, row._max.score]]))
	)
}

/** The caller's attempts at one challenge, newest first. */
export async function listAttemptsFor({
	db,
	userId,
	slug
}: Owner & { slug: string }): Promise<StoredAttempt[]> {
	const rows = await db.practiceAttempt.findMany({
		where: { userId, challengeSlug: slug },
		orderBy: { createdAt: 'desc' },
		include: WITH_TITLE
	})
	return rows.map(toStored)
}

/** The caller's attempt, or null: another user's id finds nothing. */
export async function getAttempt({
	db,
	userId,
	attemptId
}: Owner & { attemptId: string }): Promise<StoredAttempt | null> {
	const row = await db.practiceAttempt.findFirst({
		where: { id: attemptId, userId },
		include: WITH_TITLE
	})
	return row == null ? null : toStored(row)
}
