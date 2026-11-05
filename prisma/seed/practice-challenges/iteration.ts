import type { ChallengeDefinition, Criterion } from '@/features/practice/types'
import { asksForTests, sweepingPitfall, vaguePitfall } from './shared'

// Each scenario is a result that is partly right. A good follow-up says exactly
// what is wrong, keeps what works, and asks for a targeted fix that is checked.

const NOTE = 'This result is fictional, written for the exercise; it is not code from your project.'

export const specificProblem = (near: readonly RegExp[]): Criterion => ({
	id: 'problem',
	label: 'Names the specific problem',
	weight: 25,
	anyOf: [
		/\b(?:when i|after (?:i|clicking|submitting)|nothing happens|doesn'?t|does not|fails?|breaks?|wrong|error|instead of|is (?:missing|broken|empty|split|stale|off)|except (?:for|when)|spills?|ends up|extra (?:columns?|rows?))\b/i
	],
	near,
	hint: 'Say exactly what goes wrong and when, not just that it "doesn\'t work".',
	template: 'The problem: when [action], [what happens].'
})

export const expectedVsActual: Criterion = {
	id: 'expected',
	label: 'Says what should happen',
	weight: 20,
	anyOf: [
		/\b(?:expected|should|instead|it needs to|the (?:correct|right) (?:result|output|behaviou?r))\b/i
	],
	hint: 'State the result you expected next to the one you got.',
	template: 'Expected: [the correct behaviour].'
}

export const context: Criterion = {
	id: 'context',
	label: 'Gives the evidence: error, output or file',
	weight: 15,
	anyOf: [
		/`[^`\n]+`/,
		/\b(?:console|network tab|log|stack ?trace|error message|status \d{3}|\b[45]\d\d\b|output|sample|example (?:row|data|input))\b/i,
		/\b[\w-]+\.(?:tsx?|jsx?|csv|json|py)\b/
	],
	hint: 'Include the exact error, output or file the agent needs to see.',
	template: 'Evidence: [the exact error, output or example data].'
}

export const targetedFix: Criterion = {
	id: 'targeted',
	label: 'Asks for a targeted fix, not a restart',
	weight: 20,
	anyOf: [
		/\b(?:only (?:fix|change)|just (?:fix|change)|keep (?:the |what )|don'?t (?:rewrite|redo|start over|change the rest)|without (?:rewriting|changing the rest|touching)|leave .{1,40} (?:as is|alone|unchanged))\b/i
	],
	hint: 'Say what to keep, so the agent fixes the fault instead of starting again.',
	template: 'Keep [what already works]; change only [the faulty part].'
}

const SIGNUP = [/\b(?:submit|button|form|sign ?up|request|click\w*)\b/i]
const CSV = [/\b(?:csv|export|columns?|commas?|quot\w*|escap\w*|rows?)\b/i]
const PERF = [/\b(?:cache|caching|slow\w*|faster|latency|flaky|stale|tests?|ms|seconds?)\b/i]

export const ITERATION_CHALLENGES: readonly ChallengeDefinition[] = [
	{
		slug: 'iteration-signup-form',
		version: 1,
		title: 'The form that does nothing',
		description: 'Turn "it doesn\'t work" into a follow-up an agent can act on.',
		skill: 'iteration',
		type: 'improveIteration',
		difficulty: 'beginner',
		scenario:
			'An agent built a sign-up form in React. The fields look right, but clicking "Create account" does nothing: no request appears in the browser\'s network tab, and the console shows "TypeError: handleSubmit is not a function".',
		instructions:
			'Write the follow-up prompt you would send. Keep what works, and ask for a targeted fix that is checked.',
		given: {
			label: `The agent's last message. ${NOTE}`,
			text: 'The sign-up form is complete: email, password and confirm-password fields with styling that matches the rest of the app.'
		},
		criteria: [
			specificProblem(SIGNUP),
			expectedVsActual,
			context,
			targetedFix,
			{ ...asksForTests(20, SIGNUP), label: 'Asks for the fix to be checked' }
		],
		pitfalls: [vaguePitfall, sweepingPitfall],
		exemplar:
			'The form renders correctly, but when I click "Create account" nothing happens: no request in the network tab, and the console shows `TypeError: handleSubmit is not a function`. Expected: the form posts to /api/auth/sign-up and shows the field errors it returns. Keep the fields and styling as they are and fix only the submit handler wiring. Add a test that submitting a valid form sends exactly one request, then run it.',
		explanation:
			'It gives the agent the exact symptom and error, says what should happen, protects the parts that work, and ends with a check.',
		minutes: 5,
		tags: ['iteration', 'frontend'],
		isActive: true
	},
	{
		slug: 'iteration-csv-export',
		version: 1,
		title: 'Broken columns in an export',
		description: 'Give the agent the data that breaks, not a description of it.',
		skill: 'iteration',
		type: 'improveIteration',
		difficulty: 'intermediate',
		scenario:
			'An agent added a CSV export of orders. It mostly works, but any order whose note contains a comma spills into extra columns when opened in a spreadsheet, because values are not quoted.',
		instructions:
			'Write the follow-up that gets this fixed without the agent rebuilding the export.',
		given: {
			label: `The agent's last message. ${NOTE}`,
			text: 'CSV export is done: GET /api/orders/export.csv returns id, customer, total and note for every order.'
		},
		criteria: [
			specificProblem(CSV),
			expectedVsActual,
			context,
			targetedFix,
			{ ...asksForTests(20, CSV), label: 'Asks for a test with the breaking data' }
		],
		pitfalls: [vaguePitfall, sweepingPitfall],
		exemplar:
			'The export works except for notes that contain commas: an order with the note `Leave at door, ring twice` spills into an extra column in Excel. Expected: values are quoted and escaped per RFC 4180, so every row has exactly four columns. Keep the endpoint and the column order as they are; change only how values are written. Add tests with a comma, a double quote and a newline inside a note, and run them.',
		explanation:
			'An example row that breaks is worth more than any description; the test cases then pin the fix to that exact data.',
		minutes: 6,
		tags: ['iteration', 'data'],
		isActive: true
	},
	{
		slug: 'iteration-cache-regression',
		version: 1,
		title: 'A fix that made things worse',
		description: 'Keep the good part of a change and undo the harmful one.',
		skill: 'iteration',
		type: 'improveIteration',
		difficulty: 'advanced',
		scenario:
			'You asked an agent to speed up a product listing. It added an in-memory cache: the page went from 900 ms to 120 ms, but prices now stay stale for up to an hour after an update, and one integration test has become flaky.',
		instructions:
			'Write the follow-up that keeps the speed-up, fixes the stale data, and deals with the flaky test, without throwing the change away.',
		given: {
			label: `The agent's last message. ${NOTE}`,
			text: 'Added a 60-minute in-memory cache to the product listing. Average response time dropped from 900 ms to 120 ms.'
		},
		criteria: [
			specificProblem(PERF),
			expectedVsActual,
			{ ...context, label: 'Gives measurements and the failing test' },
			targetedFix,
			{
				id: 'rootCause',
				label: 'Asks for the cause, not a workaround',
				weight: 10,
				anyOf: [/\b(?:root cause|why (?:it|the test|prices)|cause of|invalidat\w*|explain why)\b/i],
				hint: 'Ask why the test is flaky and how the cache should be invalidated.',
				template: 'Find the root cause of [the flaky test] and explain it.'
			},
			{ ...asksForTests(10, PERF), label: 'Asks to measure and test again' }
		],
		pitfalls: [vaguePitfall, sweepingPitfall],
		exemplar:
			'The cache cut the listing from 900 ms to 120 ms; keep that. But prices stay stale for up to an hour after an update, and `products.listing.test.ts` is now flaky. Expected: a price change shows on the next request. Keep the cache and invalidate the affected entries when a product is updated, instead of removing it. Find the root cause of the flaky test (likely shared cache state between tests) and fix that, not the test. Then rerun the suite five times and re-measure the response time.',
		explanation:
			'It keeps the measured win, names both regressions with evidence, asks for the cause rather than a retry, and re-measures so the speed-up is not lost.',
		minutes: 8,
		tags: ['iteration', 'performance'],
		isActive: true
	}
]
