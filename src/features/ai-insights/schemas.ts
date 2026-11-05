import { z } from 'zod'
import { SKILL_IDS } from '@/features/assessment/rubric'

// What each AI insight must look like. A model's answer is parsed against
// these before it is stored or returned, so a malformed or oversized answer
// is a failed generation, never content. The limits bound what a single
// answer can cost to store and to read.

const text = (max: number) => z.string().trim().min(1).max(max)
const list = (max: number, item = text(400)) => z.array(item).max(max)
const skill = z.enum(SKILL_IDS)

/**
 * Long text, as paragraphs. The free OpenRouter model cuts any single string
 * in a tool call at 1,024 characters, so a long answer is asked for in parts
 * that each fit, and shown joined.
 */
const paragraphs = z.array(text(900)).min(1).max(8)

/** A paragraphs field as one text, for display and copying. */
export const joinParagraphs = (parts: readonly string[]) => parts.join('\n\n')

export const INSIGHT_FEATURES = [
	'session_analysis',
	'assessment_explanation',
	'attempt_feedback',
	'challenge_example',
	'recommendation_explanation'
] as const
export type InsightFeature = (typeof INSIGHT_FEATURES)[number]

/** A: patterns across an upload's sessions, every claim tied to supplied evidence. */
export const sessionAnalysisSchema = z.object({
	summary: text(800),
	observations: z
		.array(
			z.object({
				skill,
				observation: text(500),
				/** Exact quotes from the supplied prompts; checked server-side. */
				evidence: list(3, text(300)),
				recommendation: text(400),
				confidence: z.enum(['high', 'medium', 'low']),
				/** Seen directly in the quotes, or inferred from a pattern across them. */
				basis: z.enum(['observed', 'inferred'])
			})
		)
		.max(8),
	strengths: list(5),
	improvementAreas: list(5),
	recommendedActions: list(5)
})
export type SessionAnalysis = z.infer<typeof sessionAnalysisSchema>

/** B: the deterministic assessment explained; scores are quoted, never set. */
export const assessmentExplanationSchema = z.object({
	summary: text(800),
	strongAreas: z.array(z.object({ skill, explanation: text(500) })).max(5),
	weakAreas: z
		.array(
			z.object({
				skill,
				explanation: text(500),
				whyItMatters: text(400),
				recommendation: text(400)
			})
		)
		.max(5),
	nextSteps: list(5)
})
export type AssessmentExplanation = z.infer<typeof assessmentExplanationSchema>

/** C + D: feedback on one scored attempt, and a rewrite that keeps its intent. */
export const attemptFeedbackSchema = z.object({
	summary: text(600),
	strengths: list(5),
	weaknesses: list(5),
	missingRequirements: list(6),
	suggestedImprovements: list(6),
	improvedExample: paragraphs,
	rewrite: z.object({
		prompt: paragraphs,
		requirements: list(8),
		constraints: list(8),
		expectedOutput: text(600),
		acceptanceCriteria: list(8),
		verification: list(6)
	})
})
export type AttemptFeedback = z.infer<typeof attemptFeedbackSchema>

/** E: an alternative strong answer to a challenge, shown only after an attempt. */
export const challengeExampleSchema = z.object({
	exampleAnswer: paragraphs,
	whyItWorks: list(6)
})
export type ChallengeExample = z.infer<typeof challengeExampleSchema>

/** F: why the planner's choice suits this user. The choice itself is not the model's. */
export const recommendationExplanationSchema = z.object({
	headline: text(200),
	reasons: list(4),
	focusTip: text(400)
})
export type RecommendationExplanation = z.infer<typeof recommendationExplanationSchema>

export const INSIGHT_SCHEMAS = {
	session_analysis: sessionAnalysisSchema,
	assessment_explanation: assessmentExplanationSchema,
	attempt_feedback: attemptFeedbackSchema,
	challenge_example: challengeExampleSchema,
	recommendation_explanation: recommendationExplanationSchema
} as const satisfies Record<InsightFeature, z.ZodType>
