import type { ChatCompletion, ChatParams } from './chat-completions-client'
import type { LlmRequest, LlmResponse } from './llm-core'

// How Dojo asks OpenRouter for structured output, and how it reads the answer.
// Pure, so the tests can see the exact request. The free Nemotron model does
// not accept `response_format` (OpenRouter's catalogue lists no
// structured_outputs for it) but does accept tools, so the schema is sent as
// the parameters of one function the model is required to call. The arguments
// it returns are the answer; they are still validated with Zod in llm-core.ts,
// so a model that ignores the tool cannot slip anything unchecked through.

export const OPENROUTER_LIMITS = {
	/** A large free model is slower than a paid one; still bounded. */
	timeoutMs: 60_000,
	/** Two retries after the first try, for 429 and 5xx only. 402 is never retried. */
	maxRetries: 2,
	baseDelayMs: 1_500,
	temperature: 0.2
} as const

export function openRouterParams(request: LlmRequest): ChatParams {
	return {
		messages: [
			{ role: 'system', content: request.system },
			{ role: 'user', content: request.user }
		],
		max_tokens: request.maxOutputTokens,
		temperature: OPENROUTER_LIMITS.temperature,
		tools: [
			{
				type: 'function',
				function: {
					name: request.schemaName,
					description: 'Return the answer. Call this exactly once, with every required field.',
					parameters: request.jsonSchema
				}
			}
		],
		tool_choice: { type: 'function', function: { name: request.schemaName } },
		// Keep hidden reasoning short and out of the response: it costs output
		// tokens against the cap and the answer does not need it.
		reasoning: { effort: 'low', exclude: true }
	}
}

/** Strips a ```json fence a model sometimes wraps around a plain-text answer. */
function unfence(text: string): string {
	const match = /^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/i.exec(text)
	return (match?.[1] ?? text).trim()
}

/**
 * The answer text: the arguments of the required tool call, or, if the model
 * answered in plain content instead, that content. Validation decides whether
 * either is usable.
 */
export function openRouterAnswer(completion: ChatCompletion, toolName: string): LlmResponse {
	const choice = completion.choices[0]
	const call =
		choice?.message.tool_calls?.find((each) => each.function.name === toolName) ??
		choice?.message.tool_calls?.[0]
	const content = call?.function.arguments ?? unfence(choice?.message.content ?? '')
	return { content, model: completion.model, finishReason: choice?.finish_reason ?? null }
}
