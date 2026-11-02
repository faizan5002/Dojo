import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifyPrompt, prepareSessions } from './interactions'
import { redactSecrets } from './redact'
import { clippedEdges, sentenceSpan } from './signals'
import { evaluateClarity } from './skills/clarity'
import { evaluateIteration } from './skills/iteration'
import { evaluatePlanning } from './skills/planning'
import { evaluateScope } from './skills/scope'
import { evaluateVerification } from './skills/verification'
import { sessionOf } from './session-fixtures'

const prepared = (prompts: readonly string[], unanswered: readonly number[] = []) =>
	prepareSessions([sessionOf({ sessionId: 's', prompts, unanswered })]).sessions

const criteria = (observation: { signals: readonly { criterion: string; polarity: string }[] }) =>
	observation.signals.map((signal) => `${signal.polarity}:${signal.criterion}`)

test('prompts are classified by what they ask, in context', () => {
	assert.equal(classifyPrompt({ text: 'yes go ahead', followsResponse: true }), 'approval')
	assert.equal(classifyPrompt({ text: 'still not working', followsResponse: true }), 'feedback')
	assert.equal(classifyPrompt({ text: 'still not working', followsResponse: false }), 'other')
	assert.equal(
		classifyPrompt({ text: 'Why is the log not committed?', followsResponse: false }),
		'question'
	)
	assert.equal(classifyPrompt({ text: 'Can you add a footer?', followsResponse: false }), 'task')
	assert.equal(
		classifyPrompt({ text: 'Add a footer to the page.', followsResponse: false }),
		'task'
	)
})

test('harness context is stripped and prompts are numbered from what remains', () => {
	const [session] = prepared([
		'<ide_opened_file>The user opened x.ts</ide_opened_file>Fix the build',
		'<system-reminder>only injected</system-reminder>',
		'Run the tests'
	])
	assert.deepEqual(
		session?.map((interaction) => [interaction.promptNumber, interaction.text]),
		[
			[1, 'Fix the build'],
			[2, 'Run the tests']
		]
	)
})

test('redaction removes credential shapes and keeps references to them', () => {
	const token = `ghp_${'a1B2c3D4e5'.repeat(4)}`
	const { text, count } = redactSecrets(
		`token ${token}, db postgres://app:hunter22@db:5432/x, key $CRON_SECRET, API_KEY=abc123def456`
	)
	assert.equal(count, 3)
	assert.ok(!text.includes(token) && !text.includes('hunter22') && !text.includes('abc123def456'))
	assert.ok(text.includes('postgres://app:[REDACTED:url-password]@db'))
	assert.ok(text.includes('$CRON_SECRET'))
})

test('clarity is not length: a short precise prompt beats a long vague one', () => {
	const [precise, rambling] = evaluateClarity(
		prepared([
			'Fix the off-by-one in src/lib/paginate.ts so page 2 starts at item 11.',
			'I want you to make the thing better because right now it is not really what I had in mind and it feels a bit off in a lot of ways, so please make it better overall and think about what would be nicer for people who use it and how it could feel more polished and complete.'
		])
	)
	assert.ok(precise && rambling)
	assert.equal(precise.value, 1)
	assert.ok(rambling.value < 0.5, `rambling scored ${rambling.value}`)
	assert.ok(criteria(rambling).includes('opportunity:givesContext'))
})

test('clarity caps a bare "fix it" with nothing named', () => {
	const [vague] = evaluateClarity(prepared(['fix it']))
	assert.ok(vague && vague.value <= 0.2)
	assert.ok(criteria(vague).includes('opportunity:vagueReference'))
})

test('clarity expects constraints and a done condition only of larger requests', () => {
	const [small, large] = evaluateClarity(
		prepared([
			'Rename `total` to `sum` in math.ts.',
			'Implement CSV export in src/features/sessions/csv.ts. Only touch that folder. Done when a download has one row per session.'
		])
	)
	assert.equal(small?.value, 1)
	assert.equal(large?.value, 1)
	assert.ok(criteria(large ?? { signals: [] }).includes('strength:statesConstraints'))
	assert.ok(criteria(large ?? { signals: [] }).includes('strength:definesDone'))
})

test('planning credits a plan requested before a larger build, and skips small fixes', () => {
	const planned = evaluatePlanning(
		prepared(['Propose a plan for the import page first.', 'Now implement the import page.'])
	)
	assert.equal(planned.length, 1)
	assert.equal(planned[0]?.value, 1)
	assert.equal(planned[0]?.signals[0]?.interaction.promptNumber, 1)

	const unplanned = evaluatePlanning(prepared(['Build the whole billing system.']))
	assert.equal(unplanned[0]?.value, 0.2)
	assert.ok(criteria(unplanned[0] ?? { signals: [] }).includes('opportunity:straightToBuild'))

	assert.equal(evaluatePlanning(prepared(['Fix the typo in README.md.'])).length, 0)
})

test('verification credits a check, flags moving on, and ignores a change that ends the log', () => {
	const checked = evaluateVerification(
		prepared(['Add a retry to fetchUser in api.ts.', 'Did you run the tests? Show me the output.'])
	)
	assert.equal(checked[0]?.value, 1)
	assert.ok(criteria(checked[0] ?? { signals: [] }).includes('strength:challengesClaims'))

	const unchecked = evaluateVerification(
		prepared(['Add a retry to fetchUser in api.ts.', 'Now add dark mode.'])
	)
	assert.equal(unchecked[0]?.value, 0)

	const atEnd = evaluateVerification(prepared(['Now add dark mode.']))
	assert.equal(atEnd.length, 0)
})

test('iteration rewards specific follow-ups and marks vague or repeated ones', () => {
	const results = evaluateIteration(
		prepared([
			'Add the export button.',
			'It fails with `TypeError: x is undefined` in csv.ts, but it should return an empty file.',
			'still broken',
			'It fails with `TypeError: x is undefined` in csv.ts, but it should return an empty file.'
		])
	)
	assert.deepEqual(
		results.map((result) => result.value),
		[1, 0.25, 0]
	)
	assert.ok(criteria(results[2] ?? { signals: [] }).includes('opportunity:repeatedPrompt'))
})

test('scope credits named targets and limits, and flags sweeping or bundled requests', () => {
	const [focused, sweeping, bundled] = evaluateScope(
		prepared([
			"Change only the header in src/app/layout.tsx; don't touch the footer.",
			'Rewrite the entire app from scratch.',
			'Add login. Add billing. Add a dashboard. Add teams. Add audit logs.'
		])
	)
	assert.equal(focused?.value, 1)
	assert.ok((sweeping?.value ?? 1) < 0.5)
	assert.ok(criteria(bundled ?? { signals: [] }).includes('opportunity:bundledRequest'))
})

test('a quote runs to the end of its sentence, not to the dot in a file name', () => {
	const text = 'Change only src/app/layout.tsx and keep the footer. Then stop.'
	const span = sentenceSpan(text, text.indexOf('layout'))
	assert.equal(
		text.slice(span.start, span.end),
		'Change only src/app/layout.tsx and keep the footer.'
	)
	assert.deepEqual(clippedEdges(text, span), { before: false, after: false })
})

test('a long sentence is clipped on word boundaries and marked as clipped', () => {
	const text = `Please ${'really '.repeat(40)}fix the parser in src/parse.ts ${'now '.repeat(40)}today.`
	const span = sentenceSpan(text, text.indexOf('src/parse.ts'))
	const quote = text.slice(span.start, span.end)
	assert.ok(quote.includes('src/parse.ts'))
	assert.equal(text[span.start - 1], ' ', 'the quote starts on a whole word')
	assert.equal(text[span.end], ' ', 'the quote ends on a whole word')
	assert.deepEqual(clippedEdges(text, span), { before: true, after: true })
})
