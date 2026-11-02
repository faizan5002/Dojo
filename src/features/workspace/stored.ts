import { z } from 'zod'
import { SKILL_IDS, isCriterionId, type CriterionId } from '@/features/assessment/rubric'

// Schemas for what the workspace stores in JSON columns, and for what the
// browser sends. Rows are parsed through these on the way out of the
// database, so a malformed or older row fails loudly instead of being cast.

const MAX_TEXT_CHARS = 200_000
const MAX_TURNS_PER_SESSION = 5_000
const MAX_SESSIONS_PER_UPLOAD = 200
const MAX_FILES_PER_UPLOAD = 400
const MAX_ID_CHARS = 128
const MAX_NAME_CHARS = 260

export const logEntrySchema = z.object({
	timestamp: z.string().max(MAX_ID_CHARS),
	text: z.string().max(MAX_TEXT_CHARS)
})

export const turnSchema = z.object({
	prompt: logEntrySchema.nullable(),
	response: logEntrySchema.nullable()
})
export const turnsSchema = z.array(turnSchema).max(MAX_TURNS_PER_SESSION)

export const parsedSessionSchema = z.object({
	sessionId: z.string().min(1).max(MAX_ID_CHARS).regex(/^\S+$/),
	agent: z.enum(['claude', 'codex', 'unknown']),
	project: z.string().max(MAX_NAME_CHARS).nullable(),
	generatedAt: z.string().max(MAX_ID_CHARS).nullable(),
	turns: turnsSchema
})

export const rejectionReasonSchema = z.enum([
	'no-frontmatter',
	'no-session-id',
	'no-entries',
	'not-markdown',
	'too-large',
	'empty',
	'unreadable',
	'too-many-files',
	'duplicate-session'
])

export const uploadFileSchema = z.object({
	fileName: z.string().min(1).max(MAX_NAME_CHARS),
	reason: rejectionReasonSchema.nullable()
})
export const uploadFilesSchema = z.array(uploadFileSchema).max(MAX_FILES_PER_UPLOAD)

/** What the browser sends after parsing and redacting in the tab. */
export const uploadInputSchema = z.object({
	files: uploadFilesSchema.min(1),
	sessions: z.array(parsedSessionSchema).max(MAX_SESSIONS_PER_UPLOAD)
})
export type UploadInput = z.infer<typeof uploadInputSchema>

const nullableNumber = z.number().nullable()

export const sessionMetricsSchema = z.object({
	sessionId: z.string(),
	agent: z.enum(['claude', 'codex', 'unknown']),
	project: z.string().nullable(),
	startedAt: z.string().nullable(),
	sessionMinutes: nullableNumber,
	promptWords: z.array(z.number()),
	promptCount: z.number(),
	responseCount: z.number(),
	averagePromptWords: nullableNumber,
	pasteRatio: nullableNumber,
	promptToResponseRatio: nullableNumber,
	averageGapMinutes: nullableNumber,
	longestGapMinutes: nullableNumber,
	codeBlocksPerPrompt: nullableNumber,
	filePathsPerPrompt: nullableNumber,
	urlsPerPrompt: nullableNumber
})
export const sessionMetricsListSchema = z.array(sessionMetricsSchema)

const skillSchema = z.enum(SKILL_IDS)
const criterionSchema = z.custom<CriterionId>(isCriterionId, 'Unknown rubric criterion')
const polaritySchema = z.enum(['strength', 'opportunity'])

export const talliesSchema = z.array(
	z.object({ criterion: criterionSchema, polarity: polaritySchema, count: z.number() })
)

export const evidenceListSchema = z.array(
	z.object({
		id: z.string(),
		skill: skillSchema,
		criterion: criterionSchema,
		polarity: polaritySchema,
		sessionId: z.string(),
		promptNumber: z.number(),
		excerpt: z.string(),
		start: z.number(),
		end: z.number(),
		clippedBefore: z.boolean(),
		clippedAfter: z.boolean(),
		suggestion: z
			.object({
				base: z.string(),
				additions: z.array(
					z.enum([
						'context',
						'constraints',
						'doneWhen',
						'planFirst',
						'verify',
						'scope',
						'expectedActual'
					])
				)
			})
			.nullable()
	})
)

export const profileSchema = z.array(
	z.object({
		id: z.enum([
			'plansFirst',
			'buildsBeforePlanning',
			'checksTheWork',
			'movesOnWithoutChecking',
			'specificFeedback',
			'vagueFeedback',
			'namesTargets',
			'broadRequests'
		]),
		kind: polaritySchema,
		skill: skillSchema,
		count: z.number(),
		total: z.number(),
		evidenceIds: z.array(z.string())
	})
)

export const recommendationsSchema = z.array(
	z.object({
		skill: skillSchema,
		criterion: criterionSchema,
		count: z.number(),
		total: z.number(),
		evidenceId: z.string()
	})
)
