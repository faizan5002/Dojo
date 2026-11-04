import type { ChallengeDefinition, Criterion } from '@/features/practice/types'
import { asksForTests, edgeCases, sweepingPitfall } from './shared'

// Planning criteria: the agent should look, then propose, then wait.

export const inspect = (near: readonly RegExp[]): Criterion => ({
	id: 'inspect',
	label: 'Asks the agent to inspect the existing code first',
	weight: 20,
	anyOf: [
		/\b(?:inspect|explore|read|review|look (?:at|through)|investigate|study|examine|understand|map out)\b.{0,60}\b(?:codebase|code|existing|architecture|implementation|modules?|structure|repo(?:sitory)?|current|controllers?|services?|quer(?:y|ies)|schema|tables?|routes?|endpoints?|flow|(?:auth )?layer)\b/i
	],
	near,
	hint: 'Ask the agent to read how the existing code works before proposing anything.',
	template: 'First, inspect [the modules and flow involved] and explain how they work today.'
})

export const identifyFiles: Criterion = {
	id: 'identify',
	label: 'Asks it to identify the files and dependencies involved',
	weight: 15,
	anyOf: [
		/\b(?:identify|list|find|locate|which)\b.{0,60}\b(?:files?|modules?|dependenc\w*|services?|components?|tables?|call ?sites?|places?|clients?|callers?|consumers?|usages?|code paths?)\b/i
	],
	hint: 'Ask for the list of files, modules and dependencies the change touches.',
	template: 'List [the files, modules and dependencies] the change will touch.'
}

export const proposePlan: Criterion = {
	id: 'plan',
	label: 'Asks for a plan before code',
	weight: 20,
	anyOf: [
		/\b(?:propose|outline|write|give me|draft|suggest|describe)\b.{0,40}\b(?:plan|approach|steps|design|options)\b/i,
		/\bplan (?:first|before)\b/i,
		/\bstep[- ]by[- ]step plan\b/i
	],
	hint: 'Ask for a written plan: the steps, in order, before any code.',
	template: 'Then propose a step-by-step plan before writing any code.'
}

export const risks: Criterion = {
	id: 'risks',
	label: 'Asks about risks',
	weight: 15,
	anyOf: [
		/\b(?:risks?|trade-?offs?|pitfalls?|security|what could (?:go wrong|break)|breaking changes?|downsides?)\b/i
	],
	hint: 'Ask what could go wrong: security, data and compatibility risks.',
	template: 'Call out the risks: [security, data loss, compatibility].'
}

export const waitForApproval: Criterion = {
	id: 'wait',
	label: 'Asks it to wait for approval before changing code',
	weight: 15,
	anyOf: [
		/\b(?:wait for|until i|before (?:you )?(?:make|start|write|implement|change)\w*|get my (?:approval|go-?ahead|ok)|don'?t (?:write|change|implement|modify|touch) (?:any )?(?:code|files|anything) (?:yet|until))\b/i,
		/\b(?:do not|don'?t) (?:start|begin) (?:implementing|coding)\b/i
	],
	hint: 'Ask the agent to stop after the plan and wait for your go-ahead.',
	template: 'Do not change any code until I approve the plan.'
}

const PASSWORD_RESET = [/\b(?:password|reset|token|email|forgot)\b/i]
const PAGINATION = [
	/\b(?:paginat\w*|pages?|cursor|limit|offset|clients?|callers?|mobile|endpoints?|orders)\b/i
]
const TENANCY = [/\b(?:tenant\w*|organi[sz]ations?|accounts?|isolat\w*|schema|migrat\w*|rows?)\b/i]

export const PLANNING_CHALLENGES: readonly ChallengeDefinition[] = [
	{
		slug: 'planning-password-reset',
		version: 1,
		title: 'Plan a password reset',
		description: 'Get the agent to understand the code and propose a plan before it writes any.',
		skill: 'planning',
		type: 'planBeforeCoding',
		difficulty: 'beginner',
		scenario:
			'You need to add a password reset feature to an existing NestJS application. It already has an auth module, a users table and an email service.',
		instructions:
			'Write the prompt you would send to a coding agent so it investigates and plans first. Do not ask it to start coding straight away.',
		given: null,
		criteria: [
			inspect(PASSWORD_RESET),
			identifyFiles,
			proposePlan,
			risks,
			{ ...asksForTests(15, PASSWORD_RESET), label: 'Defines what to test' },
			waitForApproval
		],
		pitfalls: [sweepingPitfall],
		exemplar:
			'We need a password reset flow in our NestJS app. Before writing any code, inspect the existing auth module, the users table and the email service, and explain how login works today. List the files and modules the reset flow will touch. Then propose a step-by-step plan: request a reset, email a single-use token, set a new password. Call out the security risks (token expiry, token reuse, user enumeration) and say which tests you will add for each step. Do not change any code until I approve the plan.',
		explanation:
			'The agent has to learn the existing code, show you its plan and its risks, and stop for approval, so the first review happens before any code exists.',
		minutes: 6,
		tags: ['planning', 'auth'],
		isActive: true
	},
	{
		slug: 'planning-pagination',
		version: 1,
		title: 'Plan a breaking-change-free API change',
		description: 'Plan a change that live clients depend on.',
		skill: 'planning',
		type: 'planBeforeCoding',
		difficulty: 'intermediate',
		scenario:
			'GET /api/orders returns every order at once and is getting slow. Two mobile app versions in the wild call it and expect the current array response.',
		instructions:
			'Write a prompt asking the agent to plan pagination for this endpoint without breaking the apps already in use.',
		given: null,
		criteria: [
			inspect(PAGINATION),
			identifyFiles,
			proposePlan,
			{
				...risks,
				label: 'Plans for backward compatibility',
				anyOf: [
					/\b(?:backward[- ]compat\w*|breaking|existing (?:clients|apps|callers)|old (?:clients|versions|apps)|versioned?|v2|deprecat\w*)\b/i
				],
				hint: 'Ask how existing clients keep working while pagination is added.',
				template: 'Explain how [the existing clients] keep working during and after the change.'
			},
			{ ...asksForTests(15, PAGINATION), label: 'Defines what to test' },
			waitForApproval
		],
		pitfalls: [sweepingPitfall],
		exemplar:
			'GET /api/orders returns every order and is slow; two mobile app versions call it and expect a plain array. Before changing anything, inspect the orders controller, service and query, and find every client that calls this endpoint. Propose a plan for cursor-based pagination that keeps existing clients working, for example an opt-in query parameter or a new versioned route, with the trade-offs of each. Include the tests you would add for old and new callers. Wait for my approval before writing code.',
		explanation:
			'Pagination is easy; not breaking two shipped apps is the real problem, so the plan has to start from who calls the endpoint today.',
		minutes: 7,
		tags: ['planning', 'api'],
		isActive: true
	},
	{
		slug: 'planning-multi-tenancy',
		version: 1,
		title: 'Plan a risky data migration',
		description: 'Plan a schema change on live data, in phases, with a way back.',
		skill: 'planning',
		type: 'planBeforeCoding',
		difficulty: 'advanced',
		scenario:
			"A single-tenant app must become multi-tenant: every table needs an organization_id, existing rows belong to one default organization, and no request may ever read another organization's rows.",
		instructions:
			'Write a prompt asking the agent to plan this migration: phases, data backfill, isolation, rollback and testing, before anything is changed.',
		given: null,
		criteria: [
			inspect(TENANCY),
			identifyFiles,
			{
				...proposePlan,
				label: 'Asks for a phased plan',
				anyOf: [
					/\b(?:phases?|phased|stages?|incremental\w*|step[- ]by[- ]step|in order)\b/i,
					...proposePlan.anyOf
				],
				hint: 'Ask for the plan in phases that can ship one at a time.'
			},
			{
				id: 'rollback',
				label: 'Asks for a rollback plan',
				weight: 15,
				anyOf: [/\b(?:roll ?back|revert|undo|backup|down migration|restore)\b/i],
				hint: 'Ask how each phase is undone if it goes wrong.',
				template: 'For each phase, describe how to roll it back.'
			},
			{
				...edgeCases(10, TENANCY),
				label: 'Names isolation risks',
				anyOf: [
					/\b(?:isolation|leak\w*|cross[- ]tenant|another (?:organi[sz]ation|tenant)'?s?|forgets? the (?:filter|organi[sz]ation)|edge cases?|background jobs?)\b/i
				]
			},
			{ ...asksForTests(10, TENANCY), label: 'Defines isolation tests' },
			waitForApproval
		],
		pitfalls: [sweepingPitfall],
		exemplar:
			"We are making this app multi-tenant. Before changing anything, inspect the schema, every query and the auth layer, and list the tables and code paths that read or write tenant data. Propose a phased plan: add a nullable organization_id, backfill existing rows into a default organization, make it required, then enforce it in every query. For each phase give a rollback. Name the isolation risks (a query that forgets the filter, background jobs, admin tools) and the tests that prove one organization can never read another's rows. Do not run or write any migration until I approve the plan.",
		explanation:
			'A live data change needs phases you can ship and undo one at a time, and tests aimed at the one failure that matters most: data leaking across tenants.',
		minutes: 10,
		tags: ['planning', 'database'],
		isActive: true
	}
]
