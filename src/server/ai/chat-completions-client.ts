import { z } from 'zod'

// A client for OpenAI-compatible Chat Completions APIs, as plain fetch: both
// providers Dojo can use (OpenRouter, xAI) speak this protocol, so no SDK is
// needed and none is installed. Pure apart from the injected fetch and sleep,
// so the tests drive timeouts, 402s, 429s and malformed bodies without a
// network. Configuration and usage tracking live in each provider module
// (openrouter.ts, xai.ts); this file only speaks HTTP. See docs/rules/ai-usage.md.
//
// OpenRouter: https://openrouter.ai/docs/api/reference/overview
// xAI:        https://docs.x.ai/developers/rest-api-reference/inference/chat-completions

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export type ChatTool = {
	type: 'function'
	function: { name: string; description: string; parameters: Record<string, unknown> }
}

export type ChatParams = {
	messages: readonly ChatMessage[]
	/** Output ceiling. OpenRouter takes `max_tokens`; xAI `max_completion_tokens`. */
	max_tokens?: number
	max_completion_tokens?: number
	temperature?: number
	response_format?:
		| { type: 'json_object' }
		| {
				type: 'json_schema'
				json_schema: { name: string; schema: Record<string, unknown>; strict: boolean }
		  }
	tools?: readonly ChatTool[]
	tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } }
	/** OpenRouter's unified reasoning control. */
	reasoning?: { effort?: 'low' | 'medium' | 'high'; exclude?: boolean }
}

export type ChatCompletion = {
	id: string
	model: string
	choices: Array<{
		message: {
			content: string | null
			tool_calls?: Array<{ function: { name: string; arguments: string } }> | null
		}
		finish_reason: string | null
	}>
	usage: {
		prompt_tokens: number
		completion_tokens: number
		prompt_tokens_details?: { cached_tokens?: number } | null
		completion_tokens_details?: { reasoning_tokens?: number } | null
		/** xAI's own cost of the call: 10,000,000,000 ticks to the dollar. */
		cost_in_usd_ticks?: number
		/** OpenRouter's own cost of the call, in USD credits. */
		cost?: number
	}
}

/** Why a call failed, in terms a caller can act on. Never carries the response body. */
export type ChatFailure =
	| 'auth' // 401/403: a missing, wrong or revoked key, or a key without access
	| 'payment_required' // 402: out of credits, or a free quota needing credits
	| 'rate_limited' // 429 after the bounded retries
	| 'timeout'
	| 'unavailable' // 5xx after retries, or the network failed
	| 'bad_request' // 400/404/422: our request is wrong (schema, model)
	| 'bad_response' // 2xx whose body is not a chat completion

export class ChatCompletionError extends Error {
	readonly failure: ChatFailure
	readonly status: number | null
	/** The Retry-After header of a 429 or 503, when the provider sent one. */
	readonly retryAfter: string | null

	constructor(
		failure: ChatFailure,
		status: number | null,
		options: { retryAfter?: string | null; cause?: unknown } = {}
	) {
		// The message names only the failure and status: error bodies can echo
		// the request, which may hold user text, so they are never read into it.
		super(`AI provider request failed: ${failure}${status == null ? '' : ` (HTTP ${status})`}`, {
			cause: options.cause
		})
		this.name = 'ChatCompletionError'
		this.failure = failure
		this.status = status
		this.retryAfter = options.retryAfter ?? null
	}
}

export interface ChatClientOptions {
	readonly apiKey: string
	readonly baseUrl: string
	readonly timeoutMs: number
	/** Retries after the first try, for 429 and 5xx only. Bounded: never loops. */
	readonly maxRetries: number
	readonly baseDelayMs: number
	/** Sent with every request, such as OpenRouter's app attribution headers. */
	readonly headers?: Readonly<Record<string, string>>
	readonly fetch?: typeof fetch
	readonly sleep?: (ms: number) => Promise<void>
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const tokens = z.number().int().nonnegative()

// What a usable response must contain. Parsed, not cast: a 200 that is not a
// chat completion is a provider fault to report, not something to render.
const chatCompletionSchema = z.object({
	id: z.string(),
	model: z.string(),
	choices: z
		.array(
			z.object({
				message: z.object({
					content: z.string().nullable(),
					tool_calls: z
						.array(z.object({ function: z.object({ name: z.string(), arguments: z.string() }) }))
						.nullish()
				}),
				finish_reason: z.string().nullable()
			})
		)
		.min(1),
	usage: z.object({
		prompt_tokens: tokens,
		completion_tokens: tokens,
		prompt_tokens_details: z.object({ cached_tokens: tokens.optional() }).nullish(),
		completion_tokens_details: z.object({ reasoning_tokens: tokens.optional() }).nullish(),
		cost_in_usd_ticks: z.number().nonnegative().optional(),
		cost: z.number().nonnegative().optional()
	})
}) satisfies z.ZodType<ChatCompletion>

// OpenRouter can answer HTTP 200 with an error object when the upstream model
// fails mid-request; its `code` follows HTTP status semantics.
const errorBodySchema = z.object({
	error: z.object({ code: z.union([z.number(), z.string()]) })
})

function failureOf(status: number): ChatFailure {
	if (status === 401 || status === 403) return 'auth'
	if (status === 402) return 'payment_required'
	if (status === 429) return 'rate_limited'
	if (status >= 500) return 'unavailable'
	return 'bad_request'
}

const isRetryable = (failure: ChatFailure) =>
	failure === 'rate_limited' || failure === 'unavailable'

/** Exponential backoff with full jitter, honouring Retry-After when the provider sends one. */
function delayFor(attempt: number, baseDelayMs: number, retryAfter: string | null): number {
	const seconds = retryAfter == null ? Number.NaN : Number(retryAfter)
	if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, baseDelayMs * 8)
	return Math.round(Math.random() * baseDelayMs * 2 ** attempt)
}

export function createChatClient(options: ChatClientOptions) {
	const send = options.fetch ?? fetch
	const sleep = options.sleep ?? defaultSleep
	const url = `${options.baseUrl.replace(/\/+$/, '')}/chat/completions`

	async function once(
		model: string,
		params: ChatParams,
		timeoutMs: number
	): Promise<ChatCompletion> {
		const controller = new AbortController()
		const timer = setTimeout(() => controller.abort(), timeoutMs)
		let response: Response
		try {
			response = await send(url, {
				method: 'POST',
				headers: {
					...options.headers,
					Authorization: `Bearer ${options.apiKey}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ ...params, model }),
				signal: controller.signal
			})
		} catch (error) {
			throw new ChatCompletionError(controller.signal.aborted ? 'timeout' : 'unavailable', null, {
				cause: error
			})
		} finally {
			clearTimeout(timer)
		}
		if (!response.ok) {
			throw new ChatCompletionError(failureOf(response.status), response.status, {
				retryAfter: response.headers.get('retry-after')
			})
		}
		let body: unknown
		try {
			body = await response.json()
		} catch {
			throw new ChatCompletionError('bad_response', response.status)
		}
		const parsed = chatCompletionSchema.safeParse(body)
		if (parsed.success) return parsed.data
		const embedded = errorBodySchema.safeParse(body)
		if (embedded.success) {
			const code = Number(embedded.data.error.code)
			throw new ChatCompletionError(
				Number.isInteger(code) && code >= 400 ? failureOf(code) : 'unavailable',
				response.status
			)
		}
		throw new ChatCompletionError('bad_response', response.status)
	}

	return {
		/** One chat completion, retried at most `maxRetries` times on 429 and 5xx. */
		async chat(
			model: string,
			params: ChatParams,
			{ timeoutMs = options.timeoutMs }: { timeoutMs?: number } = {}
		): Promise<ChatCompletion> {
			for (let attempt = 0; ; attempt++) {
				try {
					return await once(model, params, timeoutMs)
				} catch (error) {
					if (!(error instanceof ChatCompletionError) || !isRetryable(error.failure)) throw error
					if (attempt >= options.maxRetries) throw error
					await sleep(delayFor(attempt, options.baseDelayMs, error.retryAfter))
				}
			}
		}
	}
}

export type ChatClient = ReturnType<typeof createChatClient>
