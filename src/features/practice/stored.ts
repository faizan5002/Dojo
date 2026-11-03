import { z } from 'zod'
import { SKILL_IDS } from '@/features/assessment/rubric'
import { DIFFICULTIES, EXERCISE_TYPES } from './types'

// What the Prompting Guru API accepts, and the stored evaluation JSON read
// back through a schema rather than cast.

const MAX_PROMPT_CHARS = 8_000
const MAX_SEARCH_CHARS = 100
const MAX_PAGE = 1_000
const MAX_PAGE_SIZE = 50
const DEFAULT_PAGE_SIZE = 12

export const MAX_ANSWER_CHARS = MAX_PROMPT_CHARS

/** A challenge slug as it appears in a URL. */
export const slugSchema = z
	.string()
	.min(1)
	.max(80)
	.regex(/^[a-z0-9-]+$/)

/** An attempt id as it appears in a URL. */
export const attemptIdSchema = z.string().uuid()

/** What the browser may send with a submission: the answer, nothing else. */
export const submissionSchema = z.object({
	answer: z.string().trim().min(1).max(MAX_PROMPT_CHARS)
})

const optionalEnum = <T extends string>(values: readonly [T, ...T[]]) =>
	z.preprocess((value) => (value === '' ? undefined : value), z.enum(values).optional())

/** The browse filters, read from a query string; an unknown value is a 400, not ignored. */
export const challengeQuerySchema = z.object({
	skill: optionalEnum(SKILL_IDS),
	difficulty: optionalEnum(DIFFICULTIES),
	type: optionalEnum(EXERCISE_TYPES),
	search: z.string().trim().max(MAX_SEARCH_CHARS).optional(),
	page: z.coerce.number().int().min(1).max(MAX_PAGE).default(1),
	pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE)
})

export type ChallengeQuery = z.infer<typeof challengeQuerySchema>

export const evaluationSchema = z.object({
	evaluator: z.string(),
	score: z.number(),
	band: z.enum(['needsImprovement', 'developing', 'proficient', 'strong']),
	criteria: z.array(
		z.object({
			id: z.string(),
			label: z.string(),
			weight: z.number(),
			status: z.enum(['met', 'partial', 'missing']),
			points: z.number(),
			evidence: z.string().nullable(),
			note: z.string()
		})
	),
	pitfalls: z.array(
		z.object({ id: z.string(), label: z.string(), penalty: z.number(), evidence: z.string() })
	),
	caps: z.array(z.string()),
	strengths: z.array(z.string()),
	missing: z.array(z.string()),
	suggestion: z.string()
})
