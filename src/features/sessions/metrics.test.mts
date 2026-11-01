import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildLog, prompt, response } from './log-fixture'
import { byStartTime, metricsOverview, sessionMetrics } from './metrics'
import { parseSessionLog } from './parse-log'
import { promptFeatures } from './prompt-features'
import type { ParsedSession } from './types'

function session(log: string): ParsedSession {
	const result = parseSessionLog(log)
	assert.ok(result.ok, 'fixture must parse')
	return result.session
}

const at = (minute: number) => new Date(Date.UTC(2026, 10, 1, 10, minute)).toISOString()

test('counts code blocks, distinct file paths and URLs in a prompt', () => {
	const features = promptFeatures(
		[
			'See src/app/page.tsx:12 and src/app/page.tsx again, plus C:\\repo\\notes.md',
			'```ts',
			'const x = 1',
			'```',
			'Docs: https://nextjs.org/docs and http://localhost:3000/sessions',
			'```',
			'unclosed'
		].join('\n')
	)
	assert.equal(features.codeBlocks, 2)
	assert.equal(features.filePaths, 2)
	assert.equal(features.urls, 2)
})

test('a URL path is not counted as a file path', () => {
	assert.equal(promptFeatures('read https://example.com/a/b.html').filePaths, 0)
})

test('paste heuristic: a long prompt, or two signals, is likely pasted', () => {
	assert.equal(promptFeatures('a'.repeat(501)).isLikelyPasted, true)
	assert.equal(promptFeatures('a'.repeat(500)).isLikelyPasted, false)
	assert.equal(promptFeatures('see https://x.dev').isLikelyPasted, false)
	assert.equal(promptFeatures('see https://x.dev in src/a.ts').isLikelyPasted, true)
	assert.equal(promptFeatures('```\nError\n    at run (app.js:10:5)\n```').isLikelyPasted, true)
})

test('session metrics: lengths, gaps, ratios and per-prompt counts', () => {
	const metrics = sessionMetrics(
		session(
			buildLog({
				sessionId: 's1',
				entries: [
					prompt(at(0), 'one two three'),
					response(at(1), 'r'.repeat(26)),
					prompt(at(4), 'four five six seven eight https://a.dev and src/x.ts'),
					response(at(10), 'r'.repeat(26))
				]
			})
		)
	)
	assert.equal(metrics.promptCount, 2)
	assert.equal(metrics.responseCount, 2)
	assert.deepEqual(metrics.promptWords, [3, 8])
	assert.equal(metrics.averagePromptWords, 5.5)
	assert.equal(metrics.sessionMinutes, 10)
	assert.equal(metrics.averageGapMinutes, 4)
	assert.equal(metrics.longestGapMinutes, 4)
	assert.equal(metrics.pasteRatio, 0.5)
	assert.equal(metrics.urlsPerPrompt, 0.5)
	assert.equal(metrics.filePathsPerPrompt, 0.5)
	assert.equal(metrics.codeBlocksPerPrompt, 0)
	assert.equal(metrics.promptToResponseRatio, (13 + 52) / 52)
	assert.equal(metrics.startedAt, at(0))
})

test('a single unanswered prompt has no gaps and no response ratio', () => {
	const metrics = sessionMetrics(
		session(buildLog({ sessionId: 's1', entries: [prompt(at(0), 'hi')] }))
	)
	assert.equal(metrics.responseCount, 0)
	assert.equal(metrics.averageGapMinutes, null)
	assert.equal(metrics.longestGapMinutes, null)
	assert.equal(metrics.promptToResponseRatio, null)
	assert.equal(metrics.sessionMinutes, 0)
})

test('unparseable timestamps are skipped, not counted as zero', () => {
	const metrics = sessionMetrics(
		session(
			buildLog({
				sessionId: 's1',
				entries: [prompt('not-a-date', 'a'), prompt(at(2), 'b'), prompt(at(5), 'c')]
			})
		)
	)
	assert.deepEqual([metrics.averageGapMinutes, metrics.longestGapMinutes], [3, 3])
	assert.equal(metrics.startedAt, 'not-a-date')
	assert.equal(metrics.sessionMinutes, null)
})

test('the overview pools prompts across sessions instead of averaging averages', () => {
	const short = session(buildLog({ sessionId: 'a', entries: [prompt(at(0), 'one')] }))
	const long = session(
		buildLog({
			sessionId: 'b',
			entries: [prompt(at(0), 'one two three'), prompt(at(2), 'one two three')]
		})
	)
	const overview = metricsOverview([short, long])
	assert.equal(overview.sessionCount, 2)
	assert.equal(overview.promptCount, 3)
	assert.equal(overview.averagePromptWords, 7 / 3)
	assert.equal(overview.averageGapMinutes, 2)
})

test('an empty overview has counts of zero and no averages', () => {
	const overview = metricsOverview([])
	assert.equal(overview.sessionCount, 0)
	assert.equal(overview.averagePromptWords, null)
	assert.equal(overview.pasteRatio, null)
})

test('sessions sort oldest first, undated last', () => {
	const make = (id: string, stamp: string) =>
		sessionMetrics(session(buildLog({ sessionId: id, entries: [prompt(stamp, 'x')] })))
	const sorted = [make('c', ''), make('b', at(5)), make('a', at(1))].sort(byStartTime)
	assert.deepEqual(
		sorted.map((metrics) => metrics.sessionId),
		['a', 'b', 'c']
	)
})
