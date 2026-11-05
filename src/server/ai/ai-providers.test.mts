import { test } from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'
import { extractUsage } from '@/server/lib/ai-usage/usage'
import { openRouterSlug } from '@/server/lib/ai-usage/models'
import { createAiTracker, type AiUsageRow } from '@/server/lib/ai-usage/track'
import {
	createChatClient,
	ChatCompletionError,
	type ChatCompletion
} from './chat-completions-client'
import {
	AiError,
	fitToLimits,
	generateStructured,
	parseStructured,
	responseSchemaOf,
	type LlmProvider,
	type LlmRequest
} from './llm-core'
import { openRouterAnswer, openRouterParams } from './openrouter-core'

// The OpenAI-compatible client, OpenRouter's request and answer handling, the
// provider-neutral generation layer and usage accounting, all against fakes:
// no network, no key, no credits.

const MODEL = 'nvidia/nemotron-3-ultra-550b-a55b:free'

const COMPLETION: ChatCompletion = {
	id: 'gen-1',
	model: MODEL,
	choices: [
		{
			message: {
				content: null,
				tool_calls: [{ function: { name: 'answer', arguments: '{"answer":"ok","points":[]}' } }]
			},
			finish_reason: 'tool_calls'
		}
	],
	usage: {
		prompt_tokens: 1000,
		completion_tokens: 700,
		prompt_tokens_details: { cached_tokens: 300 },
		completion_tokens_details: { reasoning_tokens: 500 },
		cost: 0
	}
}

const PARAMS = { messages: [{ role: 'user' as const, content: 'hi' }], max_tokens: 100 }

type Call = { url: string; init: RequestInit }

/** A fetch that answers from a script of responses and records every call. */
function scriptedFetch(responses: Array<() => Promise<Response>>) {
	const calls: Call[] = []
	const fake: typeof fetch = async (url, init) => {
		calls.push({ url: String(url), init: init ?? {} })
		const next = responses[calls.length - 1] ?? responses[responses.length - 1]
		if (next == null) throw new Error('no scripted response')
		return next()
	}
	return { fetch: fake, calls }
}

const jsonResponse =
	(body: unknown, status = 200, headers: Record<string, string> = {}) =>
	() =>
		Promise.resolve(
			new Response(JSON.stringify(body), {
				status,
				headers: { 'Content-Type': 'application/json', ...headers }
			})
		)

function client(fetch: typeof globalThis.fetch, overrides: { timeoutMs?: number } = {}) {
	const sleeps: number[] = []
	return {
		sleeps,
		client: createChatClient({
			apiKey: 'test-key',
			baseUrl: 'https://openrouter.ai/api/v1/',
			timeoutMs: overrides.timeoutMs ?? 1_000,
			maxRetries: 2,
			baseDelayMs: 10,
			headers: { 'HTTP-Referer': 'http://localhost:3000', 'X-Title': 'Dojo' },
			fetch,
			sleep: async (ms) => {
				sleeps.push(ms)
			}
		})
	}
}

const failsWith = (failure: string) => (error: unknown) =>
	error instanceof ChatCompletionError && error.failure === failure

// --- the client ----------------------------------------------------------------

test('a call posts to OpenRouter chat/completions with the key, attribution and model', async () => {
	const { fetch, calls } = scriptedFetch([jsonResponse(COMPLETION)])
	const result = await client(fetch).client.chat(MODEL, PARAMS)
	assert.equal(result.id, 'gen-1')
	assert.equal(calls.length, 1)
	assert.equal(calls[0]?.url, 'https://openrouter.ai/api/v1/chat/completions')
	const headers = new Headers(calls[0]?.init.headers)
	assert.equal(headers.get('authorization'), 'Bearer test-key')
	assert.equal(headers.get('x-title'), 'Dojo')
	assert.equal(headers.get('content-type'), 'application/json')
	const body = JSON.parse(String(calls[0]?.init.body))
	assert.equal(body.model, MODEL)
	assert.equal(body.max_tokens, 100)
})

test('an invalid key fails at once as auth, without retrying or echoing the body', async () => {
	const { fetch, calls } = scriptedFetch([
		jsonResponse({ error: { code: 401, message: 'No auth credentials found sk-or-SECRET' } }, 401)
	])
	await assert.rejects(client(fetch).client.chat(MODEL, PARAMS), (error: unknown) => {
		assert.ok(error instanceof ChatCompletionError && error.failure === 'auth')
		assert.ok(!error.message.includes('SECRET'))
		return true
	})
	assert.equal(calls.length, 1)
})

test('402 (no credits, or a free quota needing credits) is payment_required, never retried', async () => {
	const { fetch, calls } = scriptedFetch([jsonResponse({ error: { code: 402 } }, 402)])
	await assert.rejects(client(fetch).client.chat(MODEL, PARAMS), failsWith('payment_required'))
	assert.equal(calls.length, 1)
})

test('a 429 is retried with bounded backoff, honouring Retry-After, then succeeds', async () => {
	const { fetch, calls } = scriptedFetch([
		jsonResponse({}, 429, { 'retry-after': '0.05' }),
		jsonResponse({}, 429),
		jsonResponse(COMPLETION)
	])
	const { client: chat, sleeps } = client(fetch)
	assert.equal((await chat.chat(MODEL, PARAMS)).id, 'gen-1')
	assert.equal(calls.length, 3)
	assert.equal(sleeps[0], 50, 'Retry-After is used when given')
})

test('retries stop after the limit: a persistent 429 is rate_limited, a persistent 5xx unavailable', async () => {
	for (const [status, failure] of [
		[429, 'rate_limited'],
		[502, 'unavailable']
	] as const) {
		const { fetch, calls } = scriptedFetch([jsonResponse({}, status)])
		await assert.rejects(client(fetch).client.chat(MODEL, PARAMS), failsWith(failure))
		assert.equal(calls.length, 3, 'one try and two retries, never more')
	}
})

test('an error OpenRouter sends inside an HTTP 200 is mapped by its code', async () => {
	for (const [code, failure] of [
		[429, 'rate_limited'],
		[402, 'payment_required'],
		[502, 'unavailable']
	] as const) {
		const { fetch } = scriptedFetch([jsonResponse({ error: { code, message: 'upstream' } })])
		await assert.rejects(client(fetch).client.chat(MODEL, PARAMS), failsWith(failure))
	}
})

test('a request that outlasts the timeout is aborted and reported as timeout', async () => {
	const hanging: typeof fetch = (_url, init) =>
		new Promise<Response>((_resolve, reject) => {
			init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
		})
	await assert.rejects(
		client(hanging, { timeoutMs: 20 }).client.chat(MODEL, PARAMS),
		failsWith('timeout')
	)
})

test('a network failure is unavailable (retried); a 200 that is not a completion is bad_response', async () => {
	const down = scriptedFetch([() => Promise.reject(new TypeError('fetch failed'))])
	await assert.rejects(client(down.fetch).client.chat(MODEL, PARAMS), failsWith('unavailable'))
	assert.equal(down.calls.length, 3)
	for (const body of [{ choices: [] }, { hello: 'world' }]) {
		const odd = scriptedFetch([jsonResponse(body)])
		await assert.rejects(client(odd.fetch).client.chat(MODEL, PARAMS), failsWith('bad_response'))
	}
	const notJson = scriptedFetch([() => Promise.resolve(new Response('<html>oops</html>'))])
	await assert.rejects(client(notJson.fetch).client.chat(MODEL, PARAMS), failsWith('bad_response'))
})

test('a 400 is our mistake: not retried', async () => {
	const { fetch, calls } = scriptedFetch([jsonResponse({}, 400)])
	await assert.rejects(client(fetch).client.chat(MODEL, PARAMS), failsWith('bad_request'))
	assert.equal(calls.length, 1)
})

// --- OpenRouter's structured output by tool call ------------------------------------

const Answer = z.object({ answer: z.string().min(1).max(20), points: z.array(z.string()).max(2) })

const REQUEST: LlmRequest = {
	feature: 'ai_test',
	system: 'system rules',
	user: '<data>{}</data>',
	schemaName: 'answer',
	jsonSchema: responseSchemaOf(Answer, { withLimits: true }),
	maxOutputTokens: 900
}

test('the request forces one tool call carrying the schema, with no response_format', () => {
	const params = openRouterParams(REQUEST)
	assert.deepEqual(params.messages, [
		{ role: 'system', content: 'system rules' },
		{ role: 'user', content: '<data>{}</data>' }
	])
	assert.equal(params.max_tokens, 900)
	assert.equal(params.response_format, undefined, 'the free model does not accept it')
	assert.equal(params.tools?.length, 1)
	assert.equal(params.tools?.[0]?.function.name, 'answer')
	assert.deepEqual(params.tools?.[0]?.function.parameters, REQUEST.jsonSchema)
	assert.deepEqual(params.tool_choice, { type: 'function', function: { name: 'answer' } })
	assert.deepEqual(params.reasoning, { effort: 'low', exclude: true })
})

test('the answer is the tool call arguments, or JSON in the content when the model skipped the tool', () => {
	assert.equal(openRouterAnswer(COMPLETION, 'answer').content, '{"answer":"ok","points":[]}')
	const inContent: ChatCompletion = {
		...COMPLETION,
		choices: [
			{ message: { content: '```json\n{"answer":"ok","points":[]}\n```' }, finish_reason: 'stop' }
		]
	}
	assert.equal(openRouterAnswer(inContent, 'answer').content, '{"answer":"ok","points":[]}')
	const empty: ChatCompletion = {
		...COMPLETION,
		choices: [{ message: { content: null }, finish_reason: 'stop' }]
	}
	assert.equal(openRouterAnswer(empty, 'answer').content, '')
})

// --- generation -----------------------------------------------------------------------

const fakeProvider = (content: string, finishReason: string | null = 'stop'): LlmProvider => ({
	id: 'fake',
	model: 'fake-1',
	acceptsSchemaLimits: true,
	complete: async () => ({ content, model: 'fake-1', finishReason })
})

const GENERATE = {
	feature: REQUEST.feature,
	system: REQUEST.system,
	user: REQUEST.user,
	schemaName: REQUEST.schemaName,
	maxOutputTokens: REQUEST.maxOutputTokens,
	schema: Answer
}

test('a valid answer is parsed and returned with the model that gave it', async () => {
	const result = await generateStructured({
		...GENERATE,
		provider: fakeProvider('{"answer":"yes","points":["a"]}', 'tool_calls')
	})
	assert.deepEqual(result, { data: { answer: 'yes', points: ['a'] }, model: 'fake-1' })
})

test('an overlong answer is fitted to the limits, never padded or invented', async () => {
	const long = `${'word '.repeat(10)}end`
	const result = await generateStructured({
		...GENERATE,
		provider: fakeProvider(JSON.stringify({ answer: long, points: ['a', 'b', 'c'] }))
	})
	assert.ok(result.data.answer.length <= 20 && result.data.answer.endsWith('…'))
	assert.ok(long.startsWith(result.data.answer.slice(0, -1).trimEnd()))
	assert.deepEqual(result.data.points, ['a', 'b'])
	const fitted = fitToLimits(
		{ keep: 'short', nested: [{ text: 'x'.repeat(30) }], extra: 'untouched' },
		{
			type: 'object',
			properties: {
				keep: { type: 'string', maxLength: 10 },
				nested: {
					type: 'array',
					items: { type: 'object', properties: { text: { type: 'string', maxLength: 5 } } }
				}
			}
		}
	)
	assert.deepEqual(fitted, { keep: 'short', nested: [{ text: 'xxxx…' }], extra: 'untouched' })
})

test('empty, malformed, mis-shaped, cut-off and refused answers are never returned', async () => {
	const cases: Array<[LlmProvider, string]> = [
		[fakeProvider(''), 'invalid_output'],
		[fakeProvider('not json'), 'invalid_output'],
		[fakeProvider('{"answer":42,"points":[]}'), 'invalid_output'],
		[fakeProvider('{"points":[]}'), 'invalid_output'],
		[fakeProvider('{"answer":"","points":[]}'), 'invalid_output'],
		[fakeProvider('{"answer":"ye', 'length'), 'invalid_output'],
		[fakeProvider('{"answer":"yes","points":[]}', 'content_filter'), 'refused']
	]
	for (const [provider, failure] of cases) {
		await assert.rejects(
			generateStructured({ ...GENERATE, provider }),
			(error: unknown) => error instanceof AiError && error.failure === failure
		)
	}
})

test('OpenRouter gets counts and soft length targets; xAI strict mode gets no limits', () => {
	const strict = JSON.stringify(responseSchemaOf(Answer))
	assert.ok(
		!strict.includes('maxLength') && !strict.includes('maxItems') && !strict.includes('$schema')
	)
	const guided = responseSchemaOf(Answer, { withLimits: true })
	assert.ok(
		!JSON.stringify(guided).includes('maxLength'),
		'a hard length makes models stop mid-word'
	)
	assert.match(JSON.stringify(guided), /under 16 characters/)
	assert.match(JSON.stringify(guided), /"maxItems":2/)
	assert.ok(!JSON.stringify(guided).includes('$schema'))
	assert.equal(guided.type, 'object')
	assert.throws(
		() => parseStructured('{"answer":"","points":[]}', Answer),
		(error: unknown) => error instanceof AiError
	)
})

// --- usage and cost ---------------------------------------------------------------------

test('OpenRouter usage follows OpenAI: reasoning is already in output, cached comes out of input', () => {
	const extracted = extractUsage('openrouter', COMPLETION)
	assert.deepEqual(extracted?.tokens, {
		inputTokens: 700,
		outputTokens: 700,
		cacheWriteTokens: 0,
		cacheReadTokens: 300
	})
	assert.equal(extracted?.requestId, 'gen-1')
})

test('xAI usage still adds reasoning back, as its completion_tokens exclude it', () => {
	const extracted = extractUsage('xai', {
		...COMPLETION,
		usage: { ...COMPLETION.usage, completion_tokens: 200 }
	})
	assert.equal(extracted?.tokens.outputTokens, 700)
})

test('the free Nemotron model is registered and priced; a tracked call records one row', async () => {
	assert.equal(openRouterSlug(MODEL), MODEL)
	assert.equal(openRouterSlug('grok-4.7'), 'x-ai/grok-4.7')
	const rows: AiUsageRow[] = []
	const track = createAiTracker((row) => rows.push(row))
	await track(
		{ provider: 'openrouter', model: MODEL, feature: 'ai_test', meta: { user_id: 'u1' } },
		() => Promise.resolve(COMPLETION)
	)
	assert.equal(rows.length, 1)
	assert.equal(rows[0]?.provider, 'openrouter')
	assert.equal(rows[0]?.status, 'ok')
	assert.deepEqual(rows[0]?.meta, { user_id: 'u1' })
})
