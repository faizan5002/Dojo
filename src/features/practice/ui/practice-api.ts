import type { ChallengeListItemDto } from '../dto'

// The browser's side of the Prompting Guru API. Each call resolves to a plain
// outcome rather than throwing, so components can switch on it without
// try/catch (which the React Compiler cannot optimise around).

export type ApiFailure = 'signedOut' | 'notFound' | 'invalid' | 'failed'

export type ApiResult<T> = { ok: true; data: T } | { ok: false; reason: ApiFailure }

function failureOf(status: number): ApiFailure {
	if (status === 401) return 'signedOut'
	if (status === 404) return 'notFound'
	if (status === 400) return 'invalid'
	return 'failed'
}

async function call<T>(input: string, init?: RequestInit): Promise<ApiResult<T>> {
	try {
		const response = await fetch(input, { ...init, cache: 'no-store' })
		if (!response.ok) return { ok: false, reason: failureOf(response.status) }
		const data: T = await response.json()
		return { ok: true, data }
	} catch {
		return { ok: false, reason: 'failed' }
	}
}

export interface ChallengeListResponse {
	readonly items: readonly ChallengeListItemDto[]
	readonly total: number
	readonly page: number
	readonly pageSize: number
	readonly pageCount: number
}

export function fetchChallenges(query: URLSearchParams): Promise<ApiResult<ChallengeListResponse>> {
	return call(`/api/prompting-guru/challenges?${query.toString()}`)
}

export function submitAnswer(slug: string, answer: string): Promise<ApiResult<{ id: string }>> {
	return call(`/api/prompting-guru/challenges/${encodeURIComponent(slug)}/submit`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ answer })
	})
}
