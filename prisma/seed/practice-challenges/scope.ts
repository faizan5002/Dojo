import type { ChallengeDefinition, Criterion } from '@/features/practice/types'
import { acceptanceCriteria, asksForTests, sweepingPitfall } from './shared'

// Each scenario mixes one real task with tempting unrelated work. A good prompt
// fences the task in.

export const definesScope = (near: readonly RegExp[]): Criterion => ({
	id: 'scope',
	label: 'Defines exactly what to change',
	weight: 25,
	anyOf: [
		/\b(?:only|just|limited to|scope (?:is|of this)|single change|nothing (?:more|else) than)\b/i
	],
	near,
	hint: 'Say the one change you want, and that it is the only one.',
	template: 'Scope: change only [the one thing this task needs].'
})

export const fencesOff: Criterion = {
	id: 'fence',
	label: 'Says what must not change',
	weight: 25,
	anyOf: [
		/\b(?:don'?t|do not|must not|never) (?:change|touch|modify|edit|update|upgrade|rename|reformat|move)\b/i,
		/\b(?:leave|keep) .{1,60} (?:as (?:it )?is|unchanged|alone|untouched)\b/i
	],
	hint: 'Name what the agent must leave alone, even if it looks improvable.',
	template: 'Do not change [the files, styles or dependencies] outside this task.'
}

export const noRefactor: Criterion = {
	id: 'noRefactor',
	label: 'Rules out unrelated refactoring',
	weight: 15,
	anyOf: [
		/\b(?:no|don'?t|do not|without) (?:refactor\w*|clean ?up|tidy\w*|reformat\w*|upgrad\w*|unrelated (?:changes|fixes|improvements|refactor\w*)|fix (?:the )?(?:lint|warnings|other))\b/i,
		/\b(?:note|list|mention|flag) (?:any )?(?:other|unrelated) (?:issues|problems|improvements)\b/i,
		/\b(?:note|list|mention|flag) (?:anything|everything) (?:else|you would)\b/i
	],
	hint: 'Ask the agent to note other problems instead of fixing them now.',
	template: 'No refactoring: list any other issues you notice instead of fixing them.'
}

const REMEMBER = [/\b(?:remember me|checkbox|login form|session|sign[- ]in)\b/i]
const ROUNDING = [/\b(?:round\w*|discount|total|cents?|price|bug)\b/i]
const API_FIELD = [/\b(?:fields?|responses?|delivery|estimate|endpoints?|clients?|api)\b/i]

export const SCOPE_CHALLENGES: readonly ChallengeDefinition[] = [
	{
		slug: 'scope-remember-me',
		version: 1,
		title: 'One checkbox, nothing else',
		description: 'Keep a small feature small in a codebase full of temptations.',
		skill: 'scopeControl',
		type: 'controlScope',
		difficulty: 'beginner',
		scenario:
			'You want a "Remember me" checkbox on the login form that keeps people signed in for 30 days. The login form also uses outdated styling, two dependencies are a major version behind, and the auth module has inconsistent naming.',
		instructions:
			'Write the prompt so the agent adds the checkbox and leaves everything else alone.',
		given: null,
		criteria: [
			definesScope(REMEMBER),
			fencesOff,
			noRefactor,
			{ ...acceptanceCriteria(20, REMEMBER), label: 'Defines when it is done' },
			{ ...asksForTests(15, REMEMBER), label: 'Asks for regression tests' }
		],
		pitfalls: [sweepingPitfall],
		exemplar:
			'Add only a "Remember me" checkbox to the login form: when it is checked, the session lasts 30 days; unchecked, it stays as it is today. Do not change the form\'s styling, the dependency versions or any naming in the auth module, even where it looks inconsistent. No refactoring: list any other issues you notice instead of fixing them. Done when: both checked and unchecked sign-ins work, and the existing login tests plus a new test for the 30-day session pass.',
		explanation:
			'It states the one change, names each temptation as off limits, gives the agent somewhere to put other findings, and ends with checks.',
		minutes: 5,
		tags: ['scope', 'auth'],
		isActive: true
	},
	{
		slug: 'scope-rounding-bug',
		version: 1,
		title: 'Fix one bug in messy code',
		description: 'A targeted fix in a file that is begging to be cleaned up.',
		skill: 'scopeControl',
		type: 'controlScope',
		difficulty: 'intermediate',
		scenario:
			'Order totals are off by a cent when a percentage discount applies, because the discount is rounded before tax instead of after. The pricing file it lives in has 40 lint warnings, duplicated helpers and no types.',
		instructions:
			'Write the prompt that gets the rounding bug fixed without the agent cleaning up the whole file.',
		given: null,
		criteria: [
			definesScope(ROUNDING),
			fencesOff,
			noRefactor,
			{ ...acceptanceCriteria(20, ROUNDING), label: 'Defines the correct result' },
			{ ...asksForTests(15, ROUNDING), label: 'Asks for a regression test' }
		],
		pitfalls: [sweepingPitfall],
		exemplar:
			'Fix only the rounding bug in the order total: the percentage discount is rounded before tax, and it must be rounded after, to the nearest cent. Do not fix the lint warnings, merge the duplicated helpers or add types in this change, and do not touch any other function in the file. Note anything else you would clean up in your reply instead. Done when: a 10% discount on 19.99 with 8% tax gives the correct total, and a regression test for that case passes along with the existing pricing tests.',
		explanation:
			'Messy surroundings pull an agent into cleanup. Naming each temptation keeps the diff to the bug, so the fix is easy to review.',
		minutes: 6,
		tags: ['scope', 'bug'],
		isActive: true
	},
	{
		slug: 'scope-api-field',
		version: 1,
		title: 'Add a field three clients depend on',
		description: 'Extend a shared API response without breaking anyone.',
		skill: 'scopeControl',
		type: 'controlScope',
		difficulty: 'advanced',
		scenario:
			"GET /api/orders/:id needs a new deliveryEstimate field. Three clients (web, iOS, Android) read this response, the endpoint's serializer is shared with two other endpoints, and the orders table has columns you have wanted to rename for months.",
		instructions:
			'Write the prompt that adds the field and nothing else, with no breaking change for the existing clients or the shared serializer.',
		given: null,
		criteria: [
			definesScope(API_FIELD),
			fencesOff,
			noRefactor,
			{
				id: 'compat',
				label: 'Protects existing clients',
				weight: 15,
				anyOf: [
					/\b(?:backward[- ]compat\w*|additive|optional|no breaking|existing (?:clients|fields|responses)|other endpoints)\b/i
				],
				hint: 'Say the change must be additive, and that the other endpoints keep their responses.',
				template: 'Keep it additive: [existing fields and other endpoints] must not change.'
			},
			{ ...asksForTests(10, API_FIELD), label: 'Asks for contract tests' }
		],
		pitfalls: [sweepingPitfall],
		exemplar:
			'Add only an optional deliveryEstimate field (ISO date, or null when unknown) to the GET /api/orders/:id response. The change must be additive: every existing field keeps its name and type, and the two other endpoints that share the serializer must return exactly what they return today. Do not rename or migrate any column in the orders table, and do no unrelated refactoring; list anything you would change separately. Add contract tests for all three endpoints that pin the existing fields, and run them.',
		explanation:
			'A shared response is a contract. The prompt keeps the change additive, protects the endpoints that share code, and proves it with contract tests.',
		minutes: 8,
		tags: ['scope', 'api'],
		isActive: true
	}
]
