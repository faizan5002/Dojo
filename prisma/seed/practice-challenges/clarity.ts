import type { ChallengeDefinition } from '@/features/practice/types'
import {
	acceptanceCriteria,
	constraints,
	expectedBehaviour,
	objective,
	technicalContext,
	vaguePitfall
} from './shared'

const LOGIN = [/\b(?:log ?in|sign[- ]?in|authenticat\w*|credentials?|password|session|token)\b/i]
const DASHBOARD = [/\b(?:dashboard|page|render\w*|load\w*|chart|widget|query|queries|request)\b/i]
const PAYMENTS = [
	/\b(?:payments?|charge[sd]?|refund\w*|invoice|checkout|card|currency|amount|stripe)\b/i
]

export const CLARITY_CHALLENGES: readonly ChallengeDefinition[] = [
	{
		slug: 'clarity-login-api',
		version: 1,
		title: 'Sharpen a login request',
		description: 'Turn a one-line request into one an agent can act on without guessing.',
		skill: 'promptClarity',
		type: 'improveVaguePrompt',
		difficulty: 'beginner',
		scenario:
			'Your team runs a Node.js API (Express, PostgreSQL). Users exist in a `users` table with hashed passwords. You want a login endpoint.',
		instructions:
			'Rewrite the prompt below so a coding agent knows what to build, where, how it should behave and how you will check it.',
		given: { label: 'The vague prompt', text: 'Build a login API.' },
		criteria: [
			objective(25, LOGIN),
			technicalContext(20),
			expectedBehaviour(20, LOGIN),
			constraints(15),
			acceptanceCriteria(20, LOGIN)
		],
		pitfalls: [vaguePitfall],
		exemplar:
			'Add a POST /api/auth/login endpoint to our Express API. It takes { email, password }, looks the user up in the `users` table and compares the password with bcrypt. On success, return 200 with a signed JWT (1 hour expiry); on a wrong email or password, return 401 with the same generic message for both. Do not change the users schema or the existing /api/auth/register route. Done when: unit tests cover success, wrong password, unknown email and a missing field, and they pass.',
		explanation:
			'It names the route, the stack and the data, says what success and failure return, fences off what must not change, and ends with checks anyone can run.',
		minutes: 5,
		tags: ['api', 'auth', 'introduction'],
		isActive: true
	},
	{
		slug: 'clarity-slow-dashboard',
		version: 1,
		title: 'Make "faster" measurable',
		description: 'A performance request needs a target, a measurement and a boundary.',
		skill: 'promptClarity',
		type: 'improveVaguePrompt',
		difficulty: 'intermediate',
		scenario:
			'The analytics dashboard in a Next.js app takes about 6 seconds to show its charts. Each chart fetches its own data on mount.',
		instructions:
			'Rewrite the prompt so the agent knows what "faster" means, where to look, what must not change and how success is measured.',
		given: { label: 'The vague prompt', text: 'Make the dashboard faster.' },
		criteria: [
			objective(20, DASHBOARD),
			technicalContext(20),
			{
				id: 'measure',
				label: 'Sets a measurable target',
				weight: 25,
				anyOf: [
					/\b\d+(?:\.\d+)?\s?(?:ms|milliseconds?|s|seconds?|%|percent)\b/i,
					/\b(?:lighthouse|lcp|ttfb|web vitals|profiler|benchmark|p9[59])\b/i
				],
				hint: 'Give a number to hit and how it is measured.',
				template:
					'Target: [a measured number, e.g. charts visible in under 2 s, and the tool used].'
			},
			constraints(15),
			acceptanceCriteria(20, DASHBOARD)
		],
		pitfalls: [vaguePitfall],
		exemplar:
			"The analytics dashboard (app/dashboard/page.tsx) takes about 6 s to show its charts because each chart fetches on mount. Reduce the time until all charts are visible to under 2 s on a cold load, measured with the Lighthouse LCP on the staging build. Fetch the chart data in one server request instead of one per chart. Do not change the chart components' visual design or the API response shapes. Done when: a before and after Lighthouse run shows the target met and the existing dashboard tests pass.",
		explanation:
			'"Faster" became a number with a way to measure it, the likely cause was named, and the boundary keeps the fix from turning into a redesign.',
		minutes: 6,
		tags: ['performance', 'frontend'],
		isActive: true
	},
	{
		slug: 'clarity-payments-bug',
		version: 1,
		title: 'Report a bug an agent can fix',
		description: 'A bug report needs steps, expected versus actual, and evidence.',
		skill: 'promptClarity',
		type: 'improveVaguePrompt',
		difficulty: 'advanced',
		scenario:
			'Refunds for orders paid in EUR are recorded in USD amounts. The payments service converts currency in `src/payments/refund.ts`. Customers have noticed.',
		instructions:
			'Rewrite the prompt as a bug report: how to reproduce it, what should happen, what happens instead, where to look, and how to prove it is fixed without breaking other currencies.',
		given: { label: 'The vague prompt', text: 'Fix the bug in payments.' },
		criteria: [
			objective(15, PAYMENTS),
			{
				id: 'reproduce',
				label: 'Gives steps to reproduce',
				weight: 20,
				anyOf: [/\b(?:steps?|reproduc\w*|to trigger|when (?:i|you|a user)|repro)\b/i],
				near: PAYMENTS,
				hint: 'Say exactly how to make the bug happen.',
				template: 'Steps to reproduce: [the exact actions or data that trigger it].'
			},
			{
				id: 'expectedActual',
				label: 'Says what is expected and what happens',
				weight: 20,
				anyOf: [
					/\b(?:expected|should (?:be|record|refund)|instead|actual(?:ly)?|but (?:it|we) (?:get|see|record))\b/i
				],
				near: PAYMENTS,
				hint: 'State the expected result and the actual result side by side.',
				template: 'Expected: [the correct result]. Actual: [what happens now].'
			},
			technicalContext(15),
			constraints(10),
			{
				...acceptanceCriteria(20, PAYMENTS),
				id: 'regression',
				label: 'Asks for a regression test',
				anyOf: [
					/\b(?:regression|tests?)\b.{0,80}\b(?:eur|usd|currenc\w*|refund\w*|fail\w* before)\b/i,
					/\b(?:eur|usd|currenc\w*|refund\w*)\b.{0,80}\btests?\b/i
				],
				hint: 'Ask for a test that fails before the fix and passes after, across currencies.',
				template: 'Regression test: [a test that fails today and passes after the fix].'
			}
		],
		pitfalls: [vaguePitfall],
		exemplar:
			'Refunds for EUR orders are recorded in USD amounts. Steps to reproduce: pay an order of 50.00 EUR, then refund it from the admin page. Expected: a refund of 50.00 EUR in the refunds table. Actual: a refund of 50.00 recorded as USD. The conversion happens in `src/payments/refund.ts`. Fix the currency handling there only; do not change the refunds table schema or how USD orders are refunded. Add a regression test that fails before the fix and passes after, covering EUR, USD and GBP refunds.',
		explanation:
			'An agent can reproduce it, knows the right answer, knows where to look, and has a test that proves the fix without breaking the currencies that work today.',
		minutes: 8,
		tags: ['bug', 'payments'],
		isActive: true
	}
]
