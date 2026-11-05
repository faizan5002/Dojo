import type { ParsedSession } from '@/features/sessions/types'
import { assessSessions } from '../assess'
import { RUBRIC_VERSION } from '../rubric'
import type { Assessment } from '../types'
import { assessmentFromLlm, assessmentInput, type LlmAssessment } from './assess-llm'

// How an upload is scored: by the LLM applying the rubric when AI scoring is
// on, by the rules engine when it is off, and by the rules engine as a
// fallback when the LLM fails (rate limit, outage, an answer that does not fit
// the schema), so the user always gets a result and it says how it was made.
// The model call is passed in, so the tests drive every branch.

export type ScoringMethod = 'ai' | 'rules' | 'rules_fallback'

/** The rubric version recorded when the rules stood in for the LLM. */
export const FALLBACK_RUBRIC_VERSION = `${RUBRIC_VERSION} (AI unavailable)`

export type AssessmentGenerator = (
	input: ReturnType<typeof assessmentInput>
) => Promise<{ data: LlmAssessment; model: string }>

export interface ScoredSessions {
	readonly assessment: Assessment
	readonly method: ScoringMethod
	/** Why the LLM was not used, for a fallback; never shown to the user as is. */
	readonly failure?: unknown
}

export async function scoreSessionsWith({
	sessions,
	generate
}: {
	sessions: readonly ParsedSession[]
	/** null when AI scoring is off. */
	generate: AssessmentGenerator | null
}): Promise<ScoredSessions> {
	if (generate == null) return { assessment: assessSessions(sessions), method: 'rules' }
	try {
		const { data, model } = await generate(assessmentInput(sessions))
		return { assessment: assessmentFromLlm({ sessions, answer: data, model }), method: 'ai' }
	} catch (failure) {
		return {
			assessment: { ...assessSessions(sessions), rubricVersion: FALLBACK_RUBRIC_VERSION },
			method: 'rules_fallback',
			failure
		}
	}
}

/** How a stored assessment was scored, read back from its rubric version. */
export function scoringMethodOf(rubricVersion: string): ScoringMethod {
	if (rubricVersion.startsWith('ai-rubric')) return 'ai'
	return rubricVersion === FALLBACK_RUBRIC_VERSION ? 'rules_fallback' : 'rules'
}
