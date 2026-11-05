import 'server-only'
import type { z } from 'zod'
import { getChallenge, getChallengeVersion } from '@/features/practice/challenge-repository'
import { loadPracticeContext } from '@/features/practice/load-practice'
import { getAttempt, listAttemptsFor } from '@/features/practice/practice-repository'
import { getAssessment, getUploadView, loadSessions } from '@/features/workspace/repository'
import { getFlag } from '@/lib/flags/server'
import { AiError, configuredModel, generate } from '@/server/ai/llm'
import { db } from '@/server/db/client'
import { verifySessionAnalysis } from './evidence'
import {
	assessmentExplanationInput,
	attemptFeedbackInput,
	challengeExampleInput,
	quotesIn,
	recommendationExplanationInput,
	sessionAnalysisInput
} from './inputs'
import {
	getOrGenerateInsight,
	latestInsight,
	type InsightResult,
	type StoredInsight
} from './insight-repository'
import { systemPromptFor, userMessageFor } from './prompts'
import { INSIGHT_SCHEMAS, type InsightFeature } from './schemas'

// Each AI insight end to end, for the signed-in user: check they own the
// subject (with the same scoped repositories the pages use), build the
// minimised input, then reuse a stored result or generate one. Returns null
// when the subject is not theirs (or does not exist), so an endpoint answers
// 404 either way. Throws AiError for everything AI-side. Deterministic scores
// are read here, never written.

/** Output ceilings per feature, generous enough for a reasoning model's hidden tokens. */
const MAX_OUTPUT_TOKENS: Record<InsightFeature, number> = {
	session_analysis: 6_000,
	assessment_explanation: 5_000,
	attempt_feedback: 6_000,
	challenge_example: 4_000,
	recommendation_explanation: 2_500
}

type Outputs = { [K in InsightFeature]: z.infer<(typeof INSIGHT_SCHEMAS)[K]> }
export type InsightOutput<F extends InsightFeature> = Outputs[F]

// A mapped type TypeScript can correlate with a generic key, so each feature's
// schema and output type stay tied together without a cast.
const SCHEMAS: { [K in InsightFeature]: z.ZodType<Outputs[K]> } = INSIGHT_SCHEMAS

const parser =
	<F extends InsightFeature>(feature: F) =>
	(value: unknown): InsightOutput<F> =>
		SCHEMAS[feature].parse(value)

/** The configured model, or AiError('disabled') when AI is off for this user or everywhere. */
async function enabledModel(userId: string): Promise<string> {
	const model = configuredModel()
	if (model == null || !(await getFlag('ai_insights', { userId }))) throw new AiError('disabled')
	return model
}

async function produce<F extends InsightFeature>({
	feature,
	userId,
	subjectId,
	input,
	postProcess = (data) => data
}: {
	feature: F
	userId: string
	subjectId: string
	input: unknown
	postProcess?: (data: InsightOutput<F>) => InsightOutput<F>
}): Promise<InsightResult<InsightOutput<F>>> {
	const model = await enabledModel(userId)
	const schema = SCHEMAS[feature]
	return getOrGenerateInsight({
		db,
		userId,
		feature,
		subjectId,
		input,
		model,
		parse: parser(feature),
		generate: async () => {
			const result = await generate({
				feature: `ai_${feature}`,
				system: systemPromptFor(feature),
				user: userMessageFor(input),
				schemaName: feature,
				schema,
				maxOutputTokens: MAX_OUTPUT_TOKENS[feature],
				meta: { user_id: userId }
			})
			return { data: postProcess(result.data) }
		}
	})
}

const read = <F extends InsightFeature>(feature: F, userId: string, subjectId: string) =>
	latestInsight({ db, userId, feature, subjectId, parse: parser(feature) })

// --- A: session analysis ------------------------------------------------------

export async function sessionAnalysis({
	userId,
	uploadId,
	create
}: {
	userId: string
	uploadId: string
	create: boolean
}): Promise<{ result: InsightResult<InsightOutput<'session_analysis'>> | null; found: boolean }> {
	const view = await getUploadView({ db, userId, uploadId })
	if (view == null) return { result: null, found: false }
	if (!create)
		return { result: wrap(await read('session_analysis', userId, uploadId)), found: true }
	const sessions = await loadSessions({ db, userId, uploadId })
	const input = sessionAnalysisInput({ overview: view.overview, sessions })
	const result = await produce({
		feature: 'session_analysis',
		userId,
		subjectId: uploadId,
		input,
		postProcess: (data) => verifySessionAnalysis(data, quotesIn(input))
	})
	return { result, found: true }
}

// --- B: assessment explanation ------------------------------------------------

export async function assessmentExplanation({
	userId,
	assessmentId,
	create
}: {
	userId: string
	assessmentId: string
	create: boolean
}) {
	const stored = await getAssessment({ db, userId, assessmentId })
	if (stored == null) return { result: null, found: false }
	if (!create)
		return { result: wrap(await read('assessment_explanation', userId, assessmentId)), found: true }
	const result = await produce({
		feature: 'assessment_explanation',
		userId,
		subjectId: assessmentId,
		input: assessmentExplanationInput(stored.assessment)
	})
	return { result, found: true }
}

// --- C + D: feedback and a rewrite for one scored attempt ---------------------

export async function attemptFeedback({
	userId,
	attemptId,
	create
}: {
	userId: string
	attemptId: string
	create: boolean
}) {
	const attempt = await getAttempt({ db, userId, attemptId })
	if (attempt == null) return { result: null, found: false }
	if (!create)
		return { result: wrap(await read('attempt_feedback', userId, attemptId)), found: true }
	// The challenge as this attempt saw it: its own version, not today's.
	const challenge =
		attempt.challengeVersionId == null
			? await getChallenge({ db, slug: attempt.challengeSlug })
			: await getChallengeVersion({ db, versionId: attempt.challengeVersionId })
	if (challenge == null) return { result: null, found: false }
	const result = await produce({
		feature: 'attempt_feedback',
		userId,
		subjectId: attemptId,
		input: attemptFeedbackInput({ challenge, attempt })
	})
	return { result, found: true }
}

// --- E: an alternative example answer, only after an attempt -------------------

export type ExampleAccess = 'ok' | 'not_found' | 'attempt_first'

export async function challengeExample({
	userId,
	slug,
	create
}: {
	userId: string
	slug: string
	create: boolean
}): Promise<{
	result: InsightResult<InsightOutput<'challenge_example'>> | null
	access: ExampleAccess
}> {
	const [challenge, attempts] = await Promise.all([
		getChallenge({ db, slug }),
		listAttemptsFor({ db, userId, slug })
	])
	if (challenge == null || (!challenge.isActive && attempts.length === 0))
		return { result: null, access: 'not_found' }
	// Like Dojo's own strong answer, an example is shown only once the user has tried.
	if (attempts.length === 0) return { result: null, access: 'attempt_first' }
	if (!create)
		return {
			result: wrap(await read('challenge_example', userId, challenge.versionId)),
			access: 'ok'
		}
	const result = await produce({
		feature: 'challenge_example',
		userId,
		subjectId: challenge.versionId,
		input: challengeExampleInput(challenge)
	})
	return { result, access: 'ok' }
}

// --- F: why the planner's next challenge -----------------------------------------

export async function recommendationExplanation({
	userId,
	create
}: {
	userId: string
	create: boolean
}) {
	const context = await loadPracticeContext(userId)
	const next =
		context.plan.next == null
			? null
			: (context.catalog.find((entry) => entry.slug === context.plan.next?.slug) ?? null)
	// No recommendation to explain: the library is empty or everything is retired.
	if (next == null) return { result: null, slug: null }
	const subjectId = `next:${next.slug}`
	if (!create)
		return {
			result: wrap(await read('recommendation_explanation', userId, subjectId)),
			slug: next.slug
		}
	const result = await produce({
		feature: 'recommendation_explanation',
		userId,
		subjectId,
		input: recommendationExplanationInput({ plan: context.plan, next, attempts: context.attempts })
	})
	return { result, slug: next.slug }
}

const wrap = <T>(insight: StoredInsight<T> | null): InsightResult<T> | null =>
	insight == null ? null : { insight, cached: true }
