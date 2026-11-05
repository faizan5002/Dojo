import 'server-only'
import { env } from '@/lib/env'
import { trackAiCall } from '@/server/lib/ai-usage/sink'
import { OPENROUTER_SLUGS, type TrackedModel } from '@/server/lib/ai-usage/models'
import { AiError, type AiFailure, type LlmProvider, type LlmRequest } from './llm-core'
import {
	ChatCompletionError,
	createChatClient,
	type ChatCompletion,
	type ChatFailure
} from './chat-completions-client'

// The only place xAI is called from (docs/rules/ai-usage.md): configuration
// from the environment, one tracked call per request, and xAI's failures
// translated into the provider-neutral AiError. Feature code never imports
// this file; it goes through src/server/ai/llm.ts. An alternative provider
// (AI_PROVIDER=xai): OpenRouter is the default (openrouter.ts). xAI needs
// paid credits; on a team without them every call fails as 403, i.e. `auth`.

/** Per-request ceilings. A generation that needs more than this is a bug, not a slow day. */
export const XAI_LIMITS = {
	timeoutMs: 30_000,
	/** Two retries after the first try, for 429 and 5xx only. */
	maxRetries: 2,
	baseDelayMs: 1_000,
	/** Low, so the same input reads the same way twice. */
	temperature: 0.2
} as const

const isTrackedModel = (model: string): model is TrackedModel =>
	Object.hasOwn(OPENROUTER_SLUGS, model)

const FAILURES: Record<ChatFailure, AiFailure> = {
	auth: 'auth',
	payment_required: 'payment_required',
	rate_limited: 'rate_limited',
	timeout: 'timeout',
	unavailable: 'unavailable',
	bad_request: 'unavailable',
	bad_response: 'invalid_output'
}

/**
 * The configured xAI provider, or null when it cannot run: no key, or
 * XAI_MODEL is not a registered model (an unregistered model could not be
 * priced, so it is refused, not guessed).
 */
export function xaiProvider(): LlmProvider | null {
	const model = env.XAI_MODEL
	if (!env.XAI_API_KEY || !isTrackedModel(model)) return null
	const client = createChatClient({
		apiKey: env.XAI_API_KEY,
		baseUrl: env.XAI_BASE_URL,
		timeoutMs: XAI_LIMITS.timeoutMs,
		maxRetries: XAI_LIMITS.maxRetries,
		baseDelayMs: XAI_LIMITS.baseDelayMs
	})

	return {
		id: 'xai',
		model,
		acceptsSchemaLimits: false,
		async complete(request: LlmRequest) {
			let completion: ChatCompletion
			try {
				completion = await trackAiCall(
					{ provider: 'xai', model, feature: request.feature, meta: request.meta },
					() =>
						client.chat(
							model,
							{
								messages: [
									{ role: 'system', content: request.system },
									{ role: 'user', content: request.user }
								],
								max_completion_tokens: request.maxOutputTokens,
								temperature: XAI_LIMITS.temperature,
								response_format: {
									type: 'json_schema',
									json_schema: {
										name: request.schemaName,
										schema: request.jsonSchema,
										strict: true
									}
								}
							},
							{ timeoutMs: request.timeoutMs }
						)
				)
			} catch (error) {
				if (error instanceof ChatCompletionError) {
					throw new AiError(FAILURES[error.failure], { cause: error })
				}
				throw new AiError('unavailable', { cause: error })
			}
			const choice = completion.choices[0]
			return {
				content: choice?.message.content ?? '',
				model: completion.model,
				finishReason: choice?.finish_reason ?? null
			}
		}
	}
}
