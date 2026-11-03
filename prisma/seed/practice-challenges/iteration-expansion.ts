import type { ChallengeDefinition, Criterion } from '@/features/practice/types'
import { asksForEvidence, asksForTests, sweepingPitfall, vaguePitfall } from './shared'
import { context, expectedVsActual, specificProblem, targetedFix } from './iteration'

// Five more iteration exercises: a misread requirement, a test the agent
// "fixed" by editing it, a wrong query, a fix that broke old behaviour, and a
// third guess after two failed ones.

const NOTE = 'This result is fictional, written for the exercise; it is not code from your project.'

const TAX = [/\b(?:tax|vat|prices?|products?|display\w*|page|stored|database)\b/i]
const SHIPPING = [/\b(?:shipping|tests?|eu|orders?|fail\w*|expected)\b/i]
const QUERY = [/\b(?:query|revenue|totals?|customers?|rows?|join|sum)\b/i]
const PHONE = [/\b(?:phones?|numbers?|formatphone|format\w*|us|international|sms)\b/i]

const restate: Criterion = {
	id: 'restate',
	label: 'Restates what was actually asked',
	weight: 25,
	anyOf: [
		/\b(?:i (?:meant|asked|wanted)|what i (?:meant|need|asked)|the requirement (?:is|was)|to be clear|misunderstood|not what i asked)\b/i
	],
	hint: 'Say plainly what you meant, so the agent corrects its understanding, not just the code.',
	template: 'To be clear, I meant [the actual requirement].'
}

const undo: Criterion = {
	id: 'undo',
	label: 'Asks to undo the wrong change',
	weight: 20,
	anyOf: [/\b(?:revert|undo|roll ?back|restore)\b/i],
	near: TAX,
	hint: 'Ask for the wrong change to be reverted, not built upon.',
	template: 'Revert [the wrong change] first.'
}

const keepTheTest: Criterion = {
	id: 'keepTest',
	label: 'Refuses to weaken the test',
	weight: 25,
	anyOf: [
		/\b(?:revert (?:the )?(?:test|change to the test)|(?:don'?t|do not|never) (?:change|edit|update|weaken|modify) (?:the )?(?:test|assertion|expected value)|fix the code,? not the test)\b/i
	],
	hint: 'A failing test is evidence; ask for the code to be fixed, not the expectation.',
	template: 'Revert the change to the test; the expected value is right.'
}

const investigate: Criterion = {
	id: 'investigate',
	label: 'Asks for the root cause',
	weight: 25,
	anyOf: [
		/\b(?:investigate|find out|figure out|diagnos\w*|root cause|why (?:it|the test) (?:fails|failed|is failing))\b/i
	],
	near: SHIPPING,
	hint: 'Ask the agent to find why it fails before changing anything.',
	template: 'Investigate why [the test] fails and find the root cause.'
}

const reportBack: Criterion = {
	id: 'report',
	label: 'Asks it to report the cause first',
	weight: 15,
	anyOf: [/\b(?:tell me|report|explain|show me) (?:what|why|the cause|which)\b/i],
	hint: 'Ask to hear the cause before the fix, so you can check the reasoning.',
	template: 'Tell me what the cause was before you change anything else.'
}

const queryCause: Criterion = {
	id: 'cause',
	label: 'Points at the likely cause',
	weight: 20,
	anyOf: [
		/\b(?:fan[- ]?out|join (?:to|on|with) order_items|duplicat\w*|multipl(?:ied|ies)|counted (?:more than once|twice)|group(?:ing)? by (?:name|c\.name|id|c\.id))\b/i
	],
	hint: 'Say what in the query produces the wrong numbers, if you can see it.',
	template: 'The likely cause: [the join or grouping that inflates the totals].'
}

const preserve: Criterion = {
	id: 'preserve',
	label: 'Says what existing behaviour must stay',
	weight: 25,
	anyOf: [
		/\b(?:keep|preserve|existing behaviou?r|backward[- ]compatib\w*|unchanged|same (?:output|format) as before)\b/i
	],
	near: PHONE,
	hint: 'Name the behaviour callers depend on, which must not change.',
	template: 'Keep [the existing output] exactly as it was for [the callers that depend on it].'
}

const pinBehaviour: Criterion = {
	id: 'pin',
	label: 'Asks for tests that pin the old behaviour',
	weight: 20,
	anyOf: [
		/\b(?:characteri[sz]ation|snapshot|(?:tests?|cases?) (?:for|that pin|that lock|covering) (?:the )?(?:current|existing|old))\b/i
	],
	hint: "Ask for tests that capture today's output before the change.",
	template: 'Add tests that pin [the current behaviour] before changing it.'
}

const stopGuessing: Criterion = {
	id: 'stop',
	label: 'Stops the guessing',
	weight: 20,
	anyOf: [
		/\b(?:stop (?:guessing|trying)|no more (?:guesses|fixes|attempts)|before (?:another|the next) (?:fix|attempt)|step back)\b/i
	],
	hint: 'After two failed attempts, stop the agent from trying a third variation.',
	template: 'Stop guessing: no more fixes until we know the cause.'
}

const history: Criterion = {
	id: 'history',
	label: 'Summarises what already failed',
	weight: 15,
	anyOf: [
		/\b(?:(?:first|second|both|two|previous) (?:attempts?|fixes|tries)|already tried|didn'?t work|did not work)\b/i
	],
	hint: 'List what has been tried, so it is not tried again.',
	template: 'Already tried: [the previous attempts], and neither worked.'
}

const hypothesis: Criterion = {
	id: 'hypothesis',
	label: 'Asks for a hypothesis from the evidence',
	weight: 20,
	anyOf: [/\b(?:hypothes\w*|root cause|explain why|what (?:is|could be) causing|diagnos\w*)\b/i],
	hint: 'Ask for an explanation that fits the evidence, and how to confirm it.',
	template: 'From the evidence, give your hypothesis and how to confirm it.'
}

const revertAttempts: Criterion = {
	id: 'revert',
	label: 'Asks to revert the failed attempts',
	weight: 15,
	anyOf: [
		/\b(?:revert|undo|roll ?back|remove) (?:the |both |those |previous |earlier )?(?:\w+ )?(?:changes?|attempts?|fixes)\b/i
	],
	hint: 'Ask for the failed attempts to be removed, so they do not hide the real fix.',
	template: 'Revert the earlier attempts first.'
}

const oneChange: Criterion = {
	id: 'oneChange',
	label: 'Asks for one verified change at a time',
	weight: 15,
	anyOf: [/\b(?:one (?:change|thing) at a time|single change|smallest change|reproduc\w*)\b/i],
	hint: 'Ask for one change at a time, each checked against a reproduction.',
	template: 'Make one change at a time and reproduce the problem to prove each fix.'
}

export const ITERATION_EXPANSION: readonly ChallengeDefinition[] = [
	{
		slug: 'iteration-price-with-tax',
		version: 1,
		title: 'Correct a misread requirement',
		description: 'The agent did something reasonable, just not what you asked.',
		skill: 'iteration',
		type: 'improveIteration',
		difficulty: 'beginner',
		scenario:
			'You asked: "show prices with tax on the product page". You meant a display change. Checkout and invoices already add 20% VAT to the stored prices.',
		instructions:
			'Write the follow-up that corrects the misunderstanding, undoes the harmful change and gets the change you meant.',
		given: {
			label: `The agent's result. ${NOTE}`,
			text: 'Done: I updated the products table so every price now includes 20% VAT, and the product page shows the new prices.'
		},
		criteria: [
			restate,
			{ ...specificProblem(TAX), weight: 20 },
			undo,
			{ ...targetedFix, weight: 15 },
			{ ...asksForTests(20, TAX), label: 'Asks for a test of the stored and shown price' }
		],
		pitfalls: [vaguePitfall, sweepingPitfall],
		exemplar:
			'That is not what I asked: I meant the product page should display prices including 20% VAT, while the prices stored in the database stay without tax. Changing the stored prices is wrong, because checkout and invoices add VAT again, so customers would be charged tax twice. Revert the change to the products table and restore the original prices. Keep the product page layout as is and only change how the price is displayed: price times 1.2, rounded to 2 decimals. Add a test that the stored price is unchanged and the page shows the price with VAT.',
		explanation:
			'It restates the real requirement, explains why the change is harmful, undoes it, and narrows the new change to the display only.',
		minutes: 5,
		tags: ['requirements', 'pricing'],
		isActive: true
	},
	{
		slug: 'iteration-edited-test',
		version: 1,
		title: 'The test was right',
		description: 'An agent that edits a failing test to pass has hidden the bug.',
		skill: 'iteration',
		type: 'improveIteration',
		difficulty: 'beginner',
		scenario:
			'A shipping test expected 12.50 for an EU order over 100 (the reduced rate). After a refactor it failed, and the agent changed the expected value to 15.00. The business rule has not changed.',
		instructions:
			'Write the follow-up that puts the test back, gets the real cause investigated, and asks for proof.',
		given: {
			label: `The agent's result. ${NOTE}`,
			text: 'The test `calculates shipping for EU orders` was failing, so I updated the expected value from 12.50 to 15.00 and now all tests pass.'
		},
		criteria: [keepTheTest, investigate, context, reportBack, asksForEvidence(20)],
		pitfalls: [vaguePitfall],
		exemplar:
			'Revert the change to the test: the expected value of 12.50 is correct, because EU orders over 100 get the reduced rate. Investigate why `calculates shipping for EU orders` fails against the current code, find the root cause in the shipping calculation, and fix the code, not the test. Tell me what the cause was before you change anything else. Then run the full test suite and paste the output.',
		explanation:
			'It treats the failing test as evidence, puts it back, and asks for the cause before any fix, with the full suite as proof.',
		minutes: 4,
		tags: ['testing', 'debugging'],
		isActive: true
	},
	{
		slug: 'iteration-revenue-query',
		version: 1,
		title: 'A query with the wrong totals',
		description: 'Show the agent the exact wrong numbers, and what they should be.',
		skill: 'iteration',
		type: 'improveIteration',
		difficulty: 'intermediate',
		scenario:
			'You checked the generated revenue query by hand. Customer Ada Lovelace has three orders totalling 300, but the query reports 900; her orders have three items each. Two different customers named Sam Lee appear as a single row.',
		instructions:
			'Write the follow-up that shows the wrong results, states the right ones, points at the cause and asks for a test that proves the fix.',
		given: {
			label: `The agent's result. ${NOTE}`,
			text: 'Here is the revenue-per-customer query: SELECT c.name, SUM(o.total) FROM customers c JOIN orders o ON o.customer_id = c.id JOIN order_items i ON i.order_id = o.id GROUP BY c.name. It returns one row per customer with their revenue.'
		},
		criteria: [
			specificProblem(QUERY),
			expectedVsActual,
			context,
			queryCause,
			{ ...asksForTests(20, QUERY), label: 'Asks for a test with the failing data' }
		],
		pitfalls: [vaguePitfall, sweepingPitfall],
		exemplar:
			"The revenue query returns wrong totals: in the output, customer Ada Lovelace shows 900 instead of 300, and the two customers named Sam Lee come back as one row. Expected: one row per customer id with the sum of their order totals, so Ada's revenue should be 300. The cause looks like the join to order_items, which repeats each order once per item before the SUM, and grouping by name instead of id. Remove the order_items join, group by c.id and c.name, and keep the column names as they are. Add a test with a customer whose orders have three items each and two customers with the same name.",
		explanation:
			'Concrete wrong and right numbers make the fault undeniable, the suspected cause speeds up the fix, and the test uses exactly the data that exposed it.',
		minutes: 7,
		tags: ['database', 'sql'],
		isActive: true
	},
	{
		slug: 'iteration-phone-format',
		version: 1,
		title: 'Fix it, but keep what worked',
		description: 'A new capability must not change the output existing callers rely on.',
		skill: 'iteration',
		type: 'improveIteration',
		difficulty: 'intermediate',
		scenario:
			'You asked for `formatPhone()` to support international numbers. US numbers used to come out as (202) 555-0143, and SMS templates and invoices depend on that format.',
		instructions:
			'Write the follow-up that says what broke, which behaviour must stay exactly as before, and how to prove it.',
		given: {
			label: `The agent's result. ${NOTE}`,
			text: 'I updated formatPhone() to support international numbers using libphonenumber. All numbers now use the international format, for example +1 202 555 0143.'
		},
		criteria: [
			specificProblem(PHONE),
			preserve,
			{ ...expectedVsActual, weight: 15 },
			{ ...targetedFix, weight: 15 },
			pinBehaviour
		],
		pitfalls: [vaguePitfall, sweepingPitfall],
		exemplar:
			'The new formatPhone breaks US numbers: (202) 555-0143 now comes out as +1 202 555 0143, and our SMS templates and invoices depend on the old format. Expected: US numbers keep exactly the same format as before, and only non-US numbers use the international format. Keep the libphonenumber parsing and only change the output step for US numbers. Before changing it, add tests that pin the current US output for five existing numbers, plus cases for UK and German numbers, and run them before and after.',
		explanation:
			'It makes the compatibility requirement explicit and locks it in with tests before the change, so the new feature cannot quietly break old callers.',
		minutes: 7,
		tags: ['compatibility', 'refactoring'],
		isActive: true
	},
	{
		slug: 'iteration-third-attempt',
		version: 1,
		title: 'After two failed fixes',
		description: 'A third guess is not a plan. Change how you are working, not the guess.',
		skill: 'iteration',
		type: 'improveIteration',
		difficulty: 'advanced',
		scenario:
			'Chat connections drop about once a minute behind the corporate proxy. Attempt 1 sent heartbeats more often; attempt 2 added a reconnect retry loop. Neither worked. Logs show close code 1006 exactly 60 seconds after each connect; the proxy drops idle connections after 60 seconds; the server sends a ping every 90 seconds.',
		instructions:
			'Write the follow-up that stops the guessing, clears the failed attempts, and gets a diagnosis grounded in the evidence before the next change.',
		given: {
			label: `The agent's result. ${NOTE}`,
			text: 'Attempt 3: I added a longer timeout (30 s) to the WebSocket reconnect. The chat should now stay connected.'
		},
		criteria: [stopGuessing, history, context, hypothesis, revertAttempts, oneChange],
		pitfalls: [vaguePitfall],
		exemplar:
			'Stop guessing: the first two attempts, a faster heartbeat and a retry loop, did not work, and a longer timeout is a third guess. Revert those earlier changes so we are back to the original code. Here is the evidence: the log shows close code 1006 exactly 60 seconds after each connect, the proxy drops idle connections after 60 seconds, and our server only sends a ping every 90 seconds. From that evidence, give me your hypothesis for the disconnects and how to confirm it, before writing any fix. Then make one change at a time and reproduce the 60-second disconnect locally to prove it is gone.',
		explanation:
			'It resets to known code, puts the evidence in front of the agent, and demands a hypothesis and a reproduction instead of another blind variation.',
		minutes: 10,
		tags: ['debugging', 'websockets'],
		isActive: true
	}
]
