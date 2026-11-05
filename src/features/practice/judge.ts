import { RULES_EVALUATOR_ID, evaluateWithRules } from './evaluate'
import {
	LLM_EVALUATOR_VERSION,
	evaluationFromLlm,
	practiceJudgingInput,
	type LlmJudgement
} from './llm-evaluate'
import type { PromptEvaluator } from './types'

// The Prompting Guru evaluator used for submissions: the LLM judge when AI
// scoring is on, with the rules evaluator as the fallback when the LLM fails,
// so an answer is always scored and its result says how. The model call is
// passed in, so the tests drive every branch.

export const FALLBACK_EVALUATOR_ID = `${RULES_EVALUATOR_ID} (AI unavailable)`

export type JudgementGenerator = (
	input: ReturnType<typeof practiceJudgingInput>
) => Promise<{ data: LlmJudgement; model: string }>

export function llmEvaluator({
	generate,
	onFallback
}: {
	generate: JudgementGenerator
	onFallback?: (failure: unknown) => void
}): PromptEvaluator {
	return {
		id: LLM_EVALUATOR_VERSION,
		async evaluate({ challenge, prompt }) {
			try {
				const { data, model } = await generate(
					practiceJudgingInput({ challenge, answer: prompt.trim() })
				)
				return evaluationFromLlm({
					challenge,
					prompt,
					judgement: data,
					evaluator: `${LLM_EVALUATOR_VERSION} · ${model}`
				})
			} catch (failure) {
				onFallback?.(failure)
				return { ...evaluateWithRules({ challenge, prompt }), evaluator: FALLBACK_EVALUATOR_ID }
			}
		}
	}
}

/** How a stored evaluation was made, read back from its evaluator id. */
export function judgedBy(evaluator: string): 'ai' | 'rules' | 'rules_fallback' {
	if (evaluator.startsWith('ai-judge')) return 'ai'
	return evaluator === FALLBACK_EVALUATOR_ID ? 'rules_fallback' : 'rules'
}
