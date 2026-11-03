import type { ChallengeDefinition, Criterion } from '@/features/practice/types'
import { sweepingPitfall } from './shared'
import { identifyFiles, inspect, proposePlan, risks, waitForApproval } from './planning'

// Five more planning exercises. Each shares the look, propose, wait spine and
// adds the one thing that situation most needs before any code is written.

const PROJECTS = [/\b(?:projects?|module|archiv\w*|nest\w*|services?|controllers?)\b/i]
const ORDERS = [/\b(?:orders?|history|endpoint|slow\w*|quer(?:y|ies)|latency|cach\w*|route)\b/i]
const NAMES = [
	/\b(?:full_name|first_name|last_name|names?|users?|migrat\w*|columns?|schema|rows?)\b/i
]
const SEARCHES = [/\b(?:saved searche?s?|search\w*|filters?|feature|front ?end|back ?end)\b/i]
const PAYMENTS = [
	/\b(?:payments?|stripe|webhooks?|orders?|charges?|intents?|checkout|fulfil\w*)\b/i
]

const explainFirst: Criterion = {
	id: 'explain',
	label: 'Asks for an explanation of how it works today',
	weight: 15,
	anyOf: [/\b(?:explain|summari[sz]e|describe|walk me through|tell me) (?:how|what|the)\b/i],
	hint: 'Ask the agent to explain the current behaviour back to you before planning.',
	template: 'Explain how [the module] works today: its flow, data and guards.'
}

const measureFirst: Criterion = {
	id: 'measure',
	label: 'Asks for a measurement before a fix',
	weight: 15,
	anyOf: [
		/\b(?:measure|profil\w*|explain analy[sz]e|query plan|trace|benchmark|baseline|timings?|p9[59])\b/i
	],
	hint: 'Ask for a baseline and a profile, so the fix targets the real cause.',
	template: 'Measure first: [a baseline and a profile of where the time goes].'
}

const rollout: Criterion = {
	id: 'rollout',
	label: 'Plans a safe rollout',
	weight: 15,
	anyOf: [
		/\b(?:backfill\w*|expand and contract|expand\/contract|zero[- ]downtime|roll ?back|rollback|in batches|dual[- ]writ\w*|reversible|later release)\b/i
	],
	hint: 'Ask how the change rolls out without downtime, and how it rolls back.',
	template: 'Rollout: [the order of steps, the backfill, and how to roll back].'
}

const bothLayers: Criterion = {
	id: 'layers',
	label: 'Plans both sides and the contract between them',
	weight: 15,
	anyOf: [
		/\b(?:api contract|request and response shapes?|front ?end and (?:the )?back ?end|back ?end and (?:the )?front ?end|order to build)\b/i
	],
	hint: 'Ask for the API contract and the order in which the frontend and backend change.',
	template: 'Cover the frontend and the backend: [the API contract and the build order].'
}

const idempotency: Criterion = {
	id: 'idempotency',
	label: 'Plans for duplicate and out-of-order events',
	weight: 15,
	anyOf: [
		/\b(?:idempoten\w*|webhook signatures?|duplicate (?:events?|webhooks?|charges?)|exactly once|at least once|out[- ]of[- ]order)\b/i
	],
	near: PAYMENTS,
	hint: 'Ask how retries, duplicates and out-of-order webhooks are made safe.',
	template: 'Make [webhook handling] idempotent: duplicates and out-of-order events change nothing.'
}

export const PLANNING_EXPANSION: readonly ChallengeDefinition[] = [
	{
		slug: 'planning-nest-module',
		version: 1,
		title: 'Read the module before changing it',
		description: 'In unfamiliar code, the first output should be understanding, not a diff.',
		skill: 'planning',
		type: 'planBeforeCoding',
		difficulty: 'beginner',
		scenario:
			'You joined a team with a NestJS API. Product wants projects to be archivable. Nobody has explained `ProjectsModule` to you yet, and several clients (web, mobile, nightly jobs) read projects.',
		instructions:
			'Write the prompt that has the agent understand the module, find everything an archived project would affect, and propose a plan before touching code.',
		given: { label: 'The vague prompt', text: 'Add an archived flag to projects.' },
		criteria: [inspect(PROJECTS), explainFirst, identifyFiles, proposePlan, risks, waitForApproval],
		pitfalls: [sweepingPitfall],
		exemplar:
			'Before changing anything, inspect the NestJS `ProjectsModule` and read its controller, service, DTOs and the Prisma model behind it. Explain how a project is created, listed and deleted today, and which guards apply. Identify every file, query and client that would need to know about an archived project, including the list endpoints and the nightly jobs. Then propose a step-by-step plan for adding an archived state, and call out the risks, such as archived projects leaking into existing lists or breaking the mobile client. Do not write any code until I approve the plan.',
		explanation:
			'The agent has to show it understands the module and everything that reads projects before it proposes a change, and you see the plan before any code exists.',
		minutes: 5,
		tags: ['nestjs', 'onboarding'],
		isActive: true
	},
	{
		slug: 'planning-slow-endpoint',
		version: 1,
		title: 'Measure before you optimise',
		description: 'Caching a slow endpoint before knowing why it is slow hides the cause.',
		skill: 'planning',
		type: 'planBeforeCoding',
		difficulty: 'beginner',
		scenario:
			'GET /api/orders/history has a p95 of about 4 seconds. A teammate suggested adding Redis caching. Nobody has profiled it, and the endpoint runs several queries against the orders tables.',
		instructions:
			'Write the prompt that makes the agent find and measure the real cause, and propose options with their trade-offs, before it optimises anything.',
		given: {
			label: 'The vague prompt',
			text: 'The order history endpoint is slow, add caching.'
		},
		criteria: [inspect(ORDERS), measureFirst, identifyFiles, proposePlan, risks, waitForApproval],
		pitfalls: [sweepingPitfall],
		exemplar:
			'Do not add caching yet. First investigate why the GET /api/orders/history route is slow, and read its service and the queries it runs against the orders tables. Measure a baseline p95 latency and run EXPLAIN ANALYZE on each query so we know where the time goes. Identify which queries, indexes and services are involved. Then propose a plan that fixes the measured cause, with the risks of each option, including stale data if we do cache. Wait for my approval before you change any code.',
		explanation:
			'It turns a guess (caching) into an investigation with numbers, so the plan fixes the actual bottleneck and the trade-offs are visible before anything changes.',
		minutes: 5,
		tags: ['performance', 'investigation'],
		isActive: true
	},
	{
		slug: 'planning-split-name-column',
		version: 1,
		title: 'Plan a migration on a live table',
		description: 'A schema change on a large, busy table needs a rollout, not one migration.',
		skill: 'planning',
		type: 'planBeforeCoding',
		difficulty: 'intermediate',
		scenario:
			'The `users` table has 2 million rows and a single `full_name` column. Product wants separate first and last names. The app is deployed several times a day and must not go down; mobile clients read `full_name` from the API.',
		instructions:
			'Write the prompt that gets a safe, staged migration plan: what reads the column, the order of steps, the backfill, the risks and how to roll back.',
		given: { label: 'The vague prompt', text: 'Split full_name into first and last name.' },
		criteria: [inspect(NAMES), identifyFiles, proposePlan, rollout, risks, waitForApproval],
		pitfalls: [sweepingPitfall],
		exemplar:
			'We need to split `users.full_name` into `first_name` and `last_name` on a table with 2 million rows, without downtime. First, inspect the schema and find every query, service and API that reads or writes full_name, including what the mobile clients receive. Then propose a step-by-step plan using expand and contract: add the new columns, backfill in batches, switch reads and writes, and drop full_name only in a later release. Call out the risks, such as names that do not split cleanly, locks on a large table, and how we roll back. Do not write the migration or change any code until I approve the plan.',
		explanation:
			'It forces a staged rollout with a backfill and a rollback path, and finds every reader of the column before the schema moves.',
		minutes: 8,
		tags: ['database', 'migration'],
		isActive: true
	},
	{
		slug: 'planning-saved-searches',
		version: 1,
		title: 'Plan a feature across both stacks',
		description: 'A full-stack feature needs the contract agreed before either side is built.',
		skill: 'planning',
		type: 'planBeforeCoding',
		difficulty: 'intermediate',
		scenario:
			'Users of a React single-page app with an Express and PostgreSQL backend want to save their search filters, name them and reopen them later. Search options change a few times a year.',
		instructions:
			'Write the prompt that has the agent study both sides, agree the API contract and the build order, and surface the risks before implementing.',
		given: { label: 'The vague prompt', text: 'Add saved searches.' },
		criteria: [inspect(SEARCHES), identifyFiles, proposePlan, bothLayers, risks, waitForApproval],
		pitfalls: [sweepingPitfall],
		exemplar:
			'We want saved searches: a user can save the current search filters, name them and reopen them later. Before writing code, inspect the existing search page in the React app and the search endpoints in our Express API, and identify the components, routes and tables involved. Propose a plan that covers the frontend and the backend: the new table, the API contract with its request and response shapes, the UI changes, and the order to build and ship them. List the risks, such as saved filters that become invalid when search options change and a limit on searches per user. Wait for my approval of the plan before implementing anything.',
		explanation:
			'Agreeing the contract and the order first means the two halves fit, and the plan already handles filters that go stale.',
		minutes: 8,
		tags: ['full-stack', 'feature'],
		isActive: true
	},
	{
		slug: 'planning-payment-intents',
		version: 1,
		title: 'Plan a payment flow across services',
		description: 'Money, webhooks and two services: the plan must make retries safe.',
		skill: 'planning',
		type: 'planBeforeCoding',
		difficulty: 'advanced',
		scenario:
			'The orders service redirects customers to Stripe Checkout today. You are moving to Payment Intents with webhooks. A separate fulfilment service consumes `order.paid` events from a queue and ships goods. Stripe retries webhooks and can deliver them out of order.',
		instructions:
			'Write the prompt that gets a plan covering both services, webhook verification, idempotency, running old and new flows side by side, and the risks.',
		given: { label: 'The vague prompt', text: 'Switch us to Stripe payment intents.' },
		criteria: [inspect(PAYMENTS), identifyFiles, proposePlan, idempotency, risks, waitForApproval],
		pitfalls: [sweepingPitfall],
		exemplar:
			'We are moving from Stripe Checkout redirects to Payment Intents with webhooks in the orders service, and the fulfilment service consumes our `order.paid` events from the queue. First, investigate the current checkout flow in the orders service, its webhook handling and how fulfilment reacts to events. List every service, queue topic and table that a payment touches. Then outline a plan: the new endpoints, how webhook signatures are verified, how duplicate or out-of-order webhooks stay idempotent so an order is never fulfilled twice, and how both flows run side by side during the switch. Call out the risks, including double charges, lost events and PCI scope. Do not start implementing until I have approved the plan.',
		explanation:
			'It maps every service a payment touches and makes idempotency a first-class part of the plan, which is what prevents double fulfilment when webhooks repeat.',
		minutes: 12,
		tags: ['payments', 'microservices'],
		isActive: true
	}
]
