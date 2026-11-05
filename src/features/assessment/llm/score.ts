import 'server-only'
import { userMessageFor } from '@/features/ai-insights/prompts'
import type { ParsedSession } from '@/features/sessions/types'
import { captureError } from '@/lib/observability/capture-error'
import { AiError, generate, isAiScoringOn } from '@/server/ai/llm'
import { llmAssessmentSchema } from './assess-llm'
import { ASSESSMENT_SYSTEM_PROMPT, LLM_RUBRIC_VERSION } from './rubric-prompt'
import { scoreSessionsWith, type AssessmentGenerator, type ScoredSessions } from './score-sessions'

// The real model behind scoreSessionsWith, when AI scoring is on (llm.ts). A long log is a long answer, so the timeout is
// generous; the output is bounded by MAX_OPPORTUNITIES_PER_SKILL.

const ASSESSMENT_TIMEOUT_MS = 180_000
const ASSESSMENT_MAX_OUTPUT_TOKENS = 16_000

export async function scoreSessions({
	sessions,
	userId
}: {
	sessions: readonly ParsedSession[]
	userId: string
}): Promise<ScoredSessions> {
	const generator: AssessmentGenerator | null = isAiScoringOn()
		? (input) =>
				generate({
					feature: 'ai_assessment_scoring',
					system: ASSESSMENT_SYSTEM_PROMPT,
					user: userMessageFor(input),
					schemaName: 'assessment',
					schema: llmAssessmentSchema,
					maxOutputTokens: ASSESSMENT_MAX_OUTPUT_TOKENS,
					timeoutMs: ASSESSMENT_TIMEOUT_MS,
					meta: { user_id: userId, rubric: LLM_RUBRIC_VERSION }
				})
		: null
	const result = await scoreSessionsWith({ sessions, generate: generator })
	// An answer that never fits, or a rejected key, is ours to fix; limits and
	// outages are expected, and the rules fallback has already covered them.
	if (
		result.failure instanceof AiError &&
		['auth', 'payment_required', 'invalid_output'].includes(result.failure.failure)
	) {
		captureError(result.failure, {
			feature: 'ai_assessment_scoring',
			failure: result.failure.failure
		})
	}
	return result
}
