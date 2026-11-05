import { z } from 'zod'
import type { ParsedSession } from '@/features/sessions/types'
import { aggregate } from '../assess'
import { prepareSessions, type Interaction } from '../interactions'
import { summarizeSkill, type Observation, type Signal } from '../observation'
import { workflowProfile } from '../profile'
import { recommendations } from '../recommendations'
import { CRITERIA, SKILL_IDS, isCriterionId, type SkillId } from '../rubric'
import { openingSpan, type Span } from '../signals'
import type { Assessment, Polarity, RewriteLine } from '../types'
import { LLM_RUBRIC_VERSION, MAX_OPPORTUNITIES_PER_SKILL, OUTCOME_VALUES } from './rubric-prompt'

// The LLM half of an assessment, without the network: what is sent (the
// redacted prompts, referenced S1P3), the shape the model must answer in, and
// how an answer becomes an Assessment. The model only reports opportunities,
// outcomes and quotes; everything numeric (scores, confidence, the
// insufficient-evidence rule, the overall score, profile and recommendations)
// is the same code the rules engine uses. Pure, so the tests feed it answers.

/** How much of the user's own text one assessment may send. */
export const ASSESSMENT_INPUT_LIMITS = {
	promptChars: 1_500,
	totalChars: 120_000
} as const

const REWRITE_LINES = [
	'context',
	'constraints',
	'doneWhen',
	'planFirst',
	'verify',
	'scope',
	'expectedActual'
] as const satisfies readonly RewriteLine[]

const signalSchema = z.object({
	criterion: z.string().refine(isCriterionId, 'not a rubric criterion'),
	quote: z.string().trim().min(1).max(300),
	rewrite: z.array(z.enum(REWRITE_LINES)).max(4).optional()
})

const opportunitySchema = z.object({
	prompt: z.string().regex(/^S\d+P\d+$/),
	outcome: z.enum(['good', 'partial', 'poor']),
	signals: z.array(signalSchema).min(1).max(2)
})

/** What the model must return: every skill, each with its opportunities. */
export const llmAssessmentSchema = z.object({
	skills: z
		.array(
			z.object({
				skill: z.enum(SKILL_IDS),
				opportunities: z.array(opportunitySchema).max(MAX_OPPORTUNITIES_PER_SKILL)
			})
		)
		.min(1)
		.max(SKILL_IDS.length)
})

export type LlmAssessment = z.infer<typeof llmAssessmentSchema>

type Numbered = Interaction & { readonly sessionNumber: number }

const refOf = (interaction: Numbered) => `S${interaction.sessionNumber}P${interaction.promptNumber}`

/** The redacted prompts (prepareSessions), each with its session number for its reference. */
function numbered(sessions: readonly ParsedSession[]) {
	const prepared = prepareSessions(sessions)
	const prompts: Numbered[] = prepared.sessions.flatMap((session, index) =>
		session.map((interaction) => ({ ...interaction, sessionNumber: index + 1 }))
	)
	return { prompts, redactions: prepared.redactions }
}

const clip = (text: string, max: number) =>
	text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`

/**
 * The prompts as sent: already redacted (prepareSessions), each referenced,
 * with two facts from the parser: whether the agent answered it, and whether
 * it follows an agent answer. The agent's replies themselves are not sent.
 * Prompts past the total budget are left out, and the input says so.
 */
export function assessmentInput(sessions: readonly ParsedSession[]) {
	let budget: number = ASSESSMENT_INPUT_LIMITS.totalChars
	const included: Array<{
		ref: string
		answered: boolean
		followsAgentAnswer: boolean
		prompt: string
	}> = []
	let omitted = 0
	for (const prompt of numbered(sessions).prompts) {
		const text = clip(prompt.text, ASSESSMENT_INPUT_LIMITS.promptChars)
		if (text.length > budget) {
			omitted++
			continue
		}
		budget -= text.length
		included.push({
			ref: refOf(prompt),
			answered: prompt.answered,
			followsAgentAnswer: prompt.followsResponse,
			prompt: text
		})
	}
	return {
		sessions: sessions.length,
		prompts: included,
		...(omitted > 0 ? { note: `${omitted} later prompts were left out to fit the limit.` } : {})
	}
}

function polarityOf(skill: SkillId, criterion: string): Polarity | null {
	const criteria: { strength: readonly string[]; opportunity: readonly string[] } = CRITERIA[skill]
	if (criteria.strength.includes(criterion)) return 'strength'
	if (criteria.opportunity.includes(criterion)) return 'opportunity'
	return null
}

/** Where a quote sits in its prompt: exact first, then ignoring case and spacing. */
function locate(text: string, quote: string): Span | null {
	const exact = text.indexOf(quote)
	if (exact >= 0) return { start: exact, end: exact + quote.length }
	const lower = text.toLowerCase()
	const loose = lower.indexOf(quote.toLowerCase().trim())
	return loose >= 0 ? { start: loose, end: loose + quote.trim().length } : null
}

/**
 * Turns the model's report into an Assessment with the rules engine's own
 * arithmetic. A signal is kept only when its criterion belongs to the skill
 * and its quote is found in the prompt it names (a missing behaviour may fall
 * back to the prompt's opening, as the rules do); an opportunity with no signal
 * left, naming a prompt that does not exist, or repeating a prompt already
 * counted for that skill, is dropped.
 */
export function assessmentFromLlm({
	sessions,
	answer,
	model
}: {
	sessions: readonly ParsedSession[]
	answer: LlmAssessment
	model: string
}): Assessment {
	const { prompts, redactions } = numbered(sessions)
	const byRef = new Map(prompts.map((prompt) => [refOf(prompt), prompt]))

	const skills = SKILL_IDS.map((skill) => {
		const reported = answer.skills.find((entry) => entry.skill === skill)?.opportunities ?? []
		// Like the rules, a prompt is one opportunity per skill at most: a model
		// that lists the same prompt twice does not double its weight or its
		// confidence. The first report of a prompt that survives the checks counts.
		const seen = new Set<string>()
		const observations: Observation[] = reported.flatMap((opportunity) => {
			const interaction = byRef.get(opportunity.prompt)
			if (interaction == null || seen.has(opportunity.prompt)) return []
			const signals: Signal[] = opportunity.signals.flatMap((signal) => {
				const polarity = polarityOf(skill, signal.criterion)
				if (polarity == null || !isCriterionId(signal.criterion)) return []
				const span =
					locate(interaction.text, signal.quote) ??
					(polarity === 'opportunity' ? openingSpan(interaction.text) : null)
				if (span == null || span.end <= span.start) return []
				return [
					{
						criterion: signal.criterion,
						polarity,
						interaction,
						span,
						...(signal.rewrite == null || polarity === 'strength'
							? {}
							: { rewrite: signal.rewrite })
					}
				]
			})
			if (signals.length === 0) return []
			seen.add(opportunity.prompt)
			return [{ value: OUTCOME_VALUES[opportunity.outcome], signals }]
		})
		return summarizeSkill({ skill, observations })
	})

	return {
		rubricVersion: `${LLM_RUBRIC_VERSION} · ${model}`,
		sessionCount: sessions.length,
		promptCount: prompts.length,
		redactions,
		overall: aggregate(skills),
		skills,
		profile: workflowProfile(skills),
		recommendations: recommendations(skills)
	}
}
