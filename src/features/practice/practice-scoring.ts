import 'server-only'
import { userMessageFor } from '@/features/ai-insights/prompts'
import { captureError } from '@/lib/observability/capture-error'
import { AiError, generate, isAiScoringOn } from '@/server/ai/llm'
import { rulesEvaluator } from './evaluate'
import { llmEvaluator } from './judge'
import { llmJudgementSchema, PRACTICE_SYSTEM_PROMPT } from './llm-evaluate'
import type { PromptEvaluator } from './types'

// The evaluator a submission is scored with: the LLM judge (rules fallback)
// when AI scoring is on, the rules evaluator otherwise.

// The free model can take over a minute to judge one answer; past this the rules stand in.
const PRACTICE_TIMEOUT_MS = 150_000
const PRACTICE_MAX_OUTPUT_TOKENS = 4_000

export function practiceEvaluatorFor(userId: string): PromptEvaluator {
	if (!isAiScoringOn()) return rulesEvaluator
	return llmEvaluator({
		generate: (input) =>
			generate({
				feature: 'ai_practice_scoring',
				system: PRACTICE_SYSTEM_PROMPT,
				user: userMessageFor(input),
				schemaName: 'judgement',
				schema: llmJudgementSchema,
				maxOutputTokens: PRACTICE_MAX_OUTPUT_TOKENS,
				timeoutMs: PRACTICE_TIMEOUT_MS,
				meta: { user_id: userId }
			}),
		onFallback: (failure) => {
			if (
				failure instanceof AiError &&
				['auth', 'payment_required', 'invalid_output'].includes(failure.failure)
			) {
				captureError(failure, { feature: 'ai_practice_scoring', failure: failure.failure })
			}
		}
	})
}
