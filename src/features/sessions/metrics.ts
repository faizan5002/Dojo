import { promptFeatures, type PromptFeatures } from './prompt-features'
import type { Agent, LogEntry, ParsedSession } from './types'

const MS_PER_MINUTE = 60_000

/** Averages and ratios are null when there is nothing to divide by. */
export interface PromptTotals {
	readonly promptCount: number
	readonly responseCount: number
	readonly averagePromptWords: number | null
	readonly pasteRatio: number | null
	readonly promptToResponseRatio: number | null
	readonly averageGapMinutes: number | null
	readonly longestGapMinutes: number | null
	readonly codeBlocksPerPrompt: number | null
	readonly filePathsPerPrompt: number | null
	readonly urlsPerPrompt: number | null
}

export interface SessionMetrics extends PromptTotals {
	readonly sessionId: string
	readonly agent: Agent
	readonly project: string | null
	readonly startedAt: string | null
	/** First prompt to the last recorded entry, prompt or response. */
	readonly sessionMinutes: number | null
	/** Words per prompt in order: the prompt length trend inside the session. */
	readonly promptWords: readonly number[]
}

export interface MetricsOverview extends PromptTotals {
	readonly sessionCount: number
}

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0)

function perPrompt(total: number, prompts: number): number | null {
	return prompts === 0 ? null : total / prompts
}

function minutesBetween({ from, to }: { from: string; to: string }): number | null {
	const start = Date.parse(from)
	const end = Date.parse(to)
	if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null
	return (end - start) / MS_PER_MINUTE
}

function promptsOf(session: ParsedSession): LogEntry[] {
	return session.turns.flatMap((turn) => (turn.prompt == null ? [] : [turn.prompt]))
}

function responsesOf(session: ParsedSession): LogEntry[] {
	return session.turns.flatMap((turn) => (turn.response == null ? [] : [turn.response]))
}

function gapsBetweenPrompts(prompts: readonly LogEntry[]): number[] {
	return prompts.slice(1).flatMap((prompt, index) => {
		const gap = minutesBetween({ from: prompts[index]?.timestamp ?? '', to: prompt.timestamp })
		return gap == null ? [] : [gap]
	})
}

// Pooled over every prompt rather than averaging per-session averages, so a
// one-prompt session does not weigh as much as a fifty-prompt one.
function totals({
	features,
	responseChars,
	responseCount,
	gaps
}: {
	features: readonly PromptFeatures[]
	responseChars: number
	responseCount: number
	gaps: readonly number[]
}): PromptTotals {
	const prompts = features.length
	const promptChars = sum(features.map((feature) => feature.chars))
	return {
		promptCount: prompts,
		responseCount,
		averagePromptWords: perPrompt(sum(features.map((feature) => feature.words)), prompts),
		pasteRatio: perPrompt(features.filter((feature) => feature.isLikelyPasted).length, prompts),
		promptToResponseRatio: responseChars === 0 ? null : promptChars / responseChars,
		averageGapMinutes: gaps.length === 0 ? null : sum(gaps) / gaps.length,
		longestGapMinutes: gaps.length === 0 ? null : Math.max(...gaps),
		codeBlocksPerPrompt: perPrompt(sum(features.map((feature) => feature.codeBlocks)), prompts),
		filePathsPerPrompt: perPrompt(sum(features.map((feature) => feature.filePaths)), prompts),
		urlsPerPrompt: perPrompt(sum(features.map((feature) => feature.urls)), prompts)
	}
}

function sessionInputs(session: ParsedSession) {
	const prompts = promptsOf(session)
	const responses = responsesOf(session)
	return {
		prompts,
		features: prompts.map((prompt) => promptFeatures(prompt.text)),
		responseChars: sum(responses.map((response) => response.text.length)),
		responseCount: responses.length,
		gaps: gapsBetweenPrompts(prompts)
	}
}

export function sessionMetrics(session: ParsedSession): SessionMetrics {
	const { prompts, ...inputs } = sessionInputs(session)
	const stamps = session.turns.flatMap((turn) =>
		[turn.prompt?.timestamp, turn.response?.timestamp].filter(
			(stamp): stamp is string => stamp != null && stamp !== ''
		)
	)
	const startedAt = prompts.find((prompt) => prompt.timestamp !== '')?.timestamp ?? null
	const endedAt = stamps.at(-1)
	return {
		...totals(inputs),
		sessionId: session.sessionId,
		agent: session.agent,
		project: session.project,
		startedAt,
		sessionMinutes:
			startedAt == null || endedAt == null
				? null
				: minutesBetween({ from: startedAt, to: endedAt }),
		promptWords: inputs.features.map((feature) => feature.words)
	}
}

export function metricsOverview(sessions: readonly ParsedSession[]): MetricsOverview {
	const inputs = sessions.map(sessionInputs)
	return {
		...totals({
			features: inputs.flatMap((input) => input.features),
			responseChars: sum(inputs.map((input) => input.responseChars)),
			responseCount: sum(inputs.map((input) => input.responseCount)),
			gaps: inputs.flatMap((input) => input.gaps)
		}),
		sessionCount: sessions.length
	}
}

function startTime(metrics: SessionMetrics): number {
	const time = metrics.startedAt == null ? Number.NaN : Date.parse(metrics.startedAt)
	return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time
}

/** Oldest first; sessions with no usable timestamp go last. */
export function byStartTime(a: SessionMetrics, b: SessionMetrics): number {
	const left = startTime(a)
	const right = startTime(b)
	if (left === right) return a.sessionId.localeCompare(b.sessionId)
	return left - right
}
