import 'server-only'
import { env } from '@/lib/env'
import { trackAiCall } from '@/server/lib/ai-usage/sink'
import { OPENROUTER_SLUGS, type TrackedModel } from '@/server/lib/ai-usage/models'
import {
	ChatCompletionError,
	createChatClient,
	type ChatCompletion,
	type ChatFailure
} from './chat-completions-client'
import { AiError, type AiFailure, type LlmProvider, type LlmRequest } from './llm-core'
import { OPENROUTER_LIMITS, openRouterAnswer, openRouterParams } from './openrouter-core'

// The only place OpenRouter is called from (docs/rules/ai-usage.md):
// configuration from the environment, one tracked call per request, and
// OpenRouter's failures translated into the provider-neutral AiError. Feature
// code never imports this file; it goes through src/server/ai/llm.ts. The
// model is whatever OPENROUTER_MODEL names (the free Nemotron by default);
// nothing here ever switches to another, paid model on failure.

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
 * The configured OpenRouter provider, or null when it cannot run: no key, or
 * OPENROUTER_MODEL is not a registered model (an unregistered model could not
 * be priced, so it is refused rather than guessed).
 */
export function openRouterProvider(): LlmProvider | null {
	const model = env.OPENROUTER_MODEL
	if (!env.OPENROUTER_API_KEY || !isTrackedModel(model)) return null
	const client = createChatClient({
		apiKey: env.OPENROUTER_API_KEY,
		baseUrl: env.OPENROUTER_BASE_URL,
		timeoutMs: OPENROUTER_LIMITS.timeoutMs,
		maxRetries: OPENROUTER_LIMITS.maxRetries,
		baseDelayMs: OPENROUTER_LIMITS.baseDelayMs,
		// OpenRouter's optional app attribution; no user data.
		headers: { 'HTTP-Referer': env.NEXT_PUBLIC_APP_URL, 'X-Title': 'Dojo' }
	})

	return {
		id: 'openrouter',
		model,
		acceptsSchemaLimits: true,
		async complete(request: LlmRequest) {
			let completion: ChatCompletion
			try {
				completion = await trackAiCall(
					{ provider: 'openrouter', model, feature: request.feature, meta: request.meta },
					() => client.chat(model, openRouterParams(request), { timeoutMs: request.timeoutMs })
				)
			} catch (error) {
				if (error instanceof ChatCompletionError) {
					throw new AiError(FAILURES[error.failure], { cause: error })
				}
				throw new AiError('unavailable', { cause: error })
			}
			return openRouterAnswer(completion, request.schemaName)
		}
	}
}
