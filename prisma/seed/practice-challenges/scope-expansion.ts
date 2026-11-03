import type { ChallengeDefinition, Criterion } from '@/features/practice/types'
import { acceptanceCriteria, sweepingPitfall } from './shared'
import { definesScope, fencesOff, noRefactor } from './scope'

// Five more scope exercises. Each task sits next to something an agent would
// love to "improve": an old component, other modules, the design, the schema,
// and the shared configuration of a large feature.

const INVOICES = [/\b(?:csv|export|invoices?|button|download)\b/i]
const LOGIN = [/\b(?:rate[- ]limit\w*|login|attempts?|auth|throttl\w*|429)\b/i]
const TASK = [/\b(?:due date|tasks?|forms?|fields?|date ?picker)\b/i]
const SUBSCRIPTIONS = [/\b(?:cancel\w*|subscriptions?|columns?|migrations?|schema)\b/i]
const TEAMS = [/\b(?:teams?|invit\w*|roles?|billing|seats?|members?)\b/i]

const namesFiles: Criterion = {
	id: 'files',
	label: 'Names where changes are allowed',
	weight: 20,
	anyOf: [
		/\bonly (?:in|inside|within) [\w/.`-]+/i,
		/\b(?:files?|modules?|folders?) (?:you may|allowed|to (?:change|touch|edit))\b/i
	],
	hint: 'Name the folder or files the change may touch.',
	template: 'Change files only inside [the module or folder].'
}

const askFirst: Criterion = {
	id: 'askFirst',
	label: 'Asks to be consulted before going wider',
	weight: 15,
	anyOf: [
		/\b(?:ask (?:me )?(?:first|before)|check with me|stop and ask|tell me (?:first|before))\b/i
	],
	hint: 'Ask the agent to stop and ask if the change seems to need more.',
	template: 'If the change needs anything outside [the scope], stop and ask me first.'
}

const designSystem: Criterion = {
	id: 'design',
	label: 'Reuses the existing design',
	weight: 20,
	anyOf: [
		/\b(?:existing (?:components?|styles?|design|date ?picker|inputs?)|design system|same (?:style|look|spacing)|matching the (?:other|existing))\b/i
	],
	hint: 'Ask for the existing components and styles, not new ones.',
	template: 'Use [the existing components] and match the other fields.'
}

const visualCheck: Criterion = {
	id: 'visual',
	label: 'Asks for a visual check',
	weight: 10,
	anyOf: [/\b(?:screenshots?|visual(?:ly)?|before and after)\b/i],
	hint: 'Ask for before and after screenshots, so a redesign cannot slip through.',
	template: 'Send before and after screenshots of [the page].'
}

const reviewSql: Criterion = {
	id: 'reviewSql',
	label: 'Asks to see the generated SQL',
	weight: 20,
	anyOf: [
		/\b(?:show me|paste|review|read) (?:the )?(?:generated )?(?:sql|migration(?: file| sql)?)\b/i
	],
	hint: 'Ask to see the migration SQL before it runs, to catch extra changes.',
	template: 'Show me the generated migration SQL before applying it.'
}

const nullable: Criterion = {
	id: 'nullable',
	label: 'Keeps existing rows valid',
	weight: 15,
	anyOf: [/\b(?:nullable|null for existing|no default|existing rows|backfill\w*)\b/i],
	hint: 'Say how existing rows get a value for the new column.',
	template: 'The new column is [nullable]; existing rows keep [null].'
}

const phase: Criterion = {
	id: 'phase',
	label: 'Cuts the request down to one phase',
	weight: 25,
	anyOf: [
		/\b(?:phase (?:1|one)|first (?:step|phase|slice)|only (?:the )?(?:email )?invitations?|out of scope|later phases?)\b/i
	],
	near: TEAMS,
	hint: 'Choose the first slice, and say what is out of scope for now.',
	template: 'This is phase 1: only [the first slice]; [the rest] is out of scope.'
}

const sharedConfig: Criterion = {
	id: 'config',
	label: 'Protects shared configuration',
	weight: 20,
	anyOf: [
		/\b(?:shared config\w*|tsconfig|eslint|\.env|ci (?:workflows?|config)|package\.json|lockfile|config files?)\b/i
	],
	hint: 'Name the shared configuration the agent must leave alone.',
	template: 'Do not edit shared configuration: [tsconfig, lint, CI, dependencies].'
}

const checkpoint: Criterion = {
	id: 'checkpoint',
	label: 'Sets a checkpoint before the next step',
	weight: 15,
	anyOf: [
		/\b(?:stop (?:after|when)|stop and (?:ask|check)|check in|pause|before (?:moving on|the next (?:phase|step)))\b/i
	],
	hint: 'Ask the agent to stop and check in when this phase is done.',
	template: 'Stop after [this phase] works and check in with me.'
}

export const SCOPE_EXPANSION: readonly ChallengeDefinition[] = [
	{
		slug: 'scope-invoice-export',
		version: 1,
		title: 'Add a button, not a rewrite',
		description: 'An old component is tempting to modernise. That is not this task.',
		skill: 'scopeControl',
		type: 'controlScope',
		difficulty: 'beginner',
		scenario:
			'The invoices list is an old React class component (`InvoicesPage.jsx`) with inline styles and lint warnings. You need an "Export to CSV" button on it this week. Last time, an agent converted a similar page to hooks and broke its tests.',
		instructions:
			'Write the prompt that gets the button and nothing else, with a clear finish line.',
		given: { label: 'The vague prompt', text: 'Add a CSV export to the invoices page.' },
		criteria: [
			definesScope(INVOICES),
			fencesOff,
			{ ...noRefactor, weight: 25 },
			acceptanceCriteria(25, INVOICES)
		],
		pitfalls: [sweepingPitfall],
		exemplar:
			'Add only an Export to CSV button to the invoices list page that downloads the invoices currently shown, with the date, number, customer and amount columns. Do not change `InvoicesPage.jsx` beyond adding the button and its click handler: leave the class component, its styles and its data loading as they are. No refactoring, no conversion to hooks and no lint fixes; list any other issues you notice instead of fixing them. Done when: clicking the button downloads a CSV whose rows match the table, and the existing invoices tests still pass.',
		explanation:
			'It scopes the change to one button, explicitly protects the old component from modernisation, and turns other temptations into a list.',
		minutes: 4,
		tags: ['frontend', 'feature'],
		isActive: true
	},
	{
		slug: 'scope-auth-module-only',
		version: 1,
		title: 'Stay inside one module',
		description: 'A login change can sprawl into users, mail and shared code. Fence it.',
		skill: 'scopeControl',
		type: 'controlScope',
		difficulty: 'beginner',
		scenario:
			'A NestJS monorepo has `src/auth/`, `src/users/`, `src/mail/` and a shared `libs/common/`. You need rate limiting on login. The last agent "helpfully" edited the users and mail modules and a shared utility in the same change.',
		instructions:
			'Write the prompt that confines the work to the auth module and says what to do if that seems impossible.',
		given: { label: 'The vague prompt', text: 'Add rate limiting to login.' },
		criteria: [definesScope(LOGIN), namesFiles, fencesOff, askFirst, acceptanceCriteria(15, LOGIN)],
		pitfalls: [sweepingPitfall],
		exemplar:
			'Add rate limiting to POST /auth/login only: at most 5 attempts per email per 15 minutes, then 429 with a Retry-After header. Make the change only inside src/auth/, in `auth.controller.ts` and a new throttling guard next to it. Do not touch the users, mail or common modules, and do not add or upgrade dependencies. If the change seems to need anything outside src/auth/, stop and ask me first. Done when: tests show the sixth login attempt gets 429 and a login after the window works.',
		explanation:
			'It names the one folder that may change, protects the neighbouring modules by name, and makes "I need to go wider" a question rather than a decision.',
		minutes: 5,
		tags: ['backend', 'security'],
		isActive: true
	},
	{
		slug: 'scope-due-date-field',
		version: 1,
		title: 'One field, no redesign',
		description: 'Adding a field is not an invitation to restyle the form.',
		skill: 'scopeControl',
		type: 'controlScope',
		difficulty: 'intermediate',
		scenario:
			'The task edit form (`TaskForm.tsx`) uses your design system: inputs, labels and a DatePicker. A previous agent added one field and also changed the spacing, fonts and button styles of the whole form.',
		instructions:
			'Write the prompt that adds the field with the existing components and proves nothing else changed visually.',
		given: { label: 'The vague prompt', text: 'Add a due date to the task form.' },
		criteria: [
			{ ...definesScope(TASK), weight: 20 },
			{ ...fencesOff, weight: 20 },
			designSystem,
			noRefactor,
			visualCheck,
			acceptanceCriteria(15, TASK)
		],
		pitfalls: [sweepingPitfall],
		exemplar:
			"Add just a due date field to the task edit form in `TaskForm.tsx`, saved as `dueDate` on the task. Use the existing DatePicker from our design system and place it under the title field, matching the other fields' spacing and labels. Do not change the layout, colours, fonts or any other field of the form. No restyling and no refactoring; mention anything else you would improve instead. Send me before and after screenshots of the form. Done when: a due date can be set, saved and cleared, and the task form looks the same apart from the new field.",
		explanation:
			'It requires the existing components, forbids visual drift, and asks for screenshots that would show a redesign immediately.',
		minutes: 6,
		tags: ['frontend', 'design-system'],
		isActive: true
	},
	{
		slug: 'scope-minimal-migration',
		version: 1,
		title: 'A migration with one change in it',
		description: 'Schema migrations attract "while we are here" changes. Keep it to one.',
		skill: 'scopeControl',
		type: 'controlScope',
		difficulty: 'intermediate',
		scenario:
			'You need to record when a subscription is cancelled. The Prisma schema has several things an agent might "tidy": snake_case column names, a missing index, and inconsistent formatting. Migrations run automatically on deploy.',
		instructions:
			'Write the prompt that produces a migration with only the one required change, safe for existing rows, that you review before it runs.',
		given: { label: 'The vague prompt', text: 'Add cancellation tracking to subscriptions.' },
		criteria: [
			definesScope(SUBSCRIPTIONS),
			{ ...fencesOff, weight: 20 },
			reviewSql,
			nullable,
			{ ...noRefactor, weight: 20 }
		],
		pitfalls: [sweepingPitfall],
		exemplar:
			'The migration should only add a nullable `cancelled_at` timestamp column to the subscriptions table, set when a subscription is cancelled. Existing rows keep it null. Do not rename columns, change other tables, add or drop indexes, or reformat `schema.prisma` in this change. No unrelated changes: note any other problems you spot in the schema for a separate change. Show me the generated migration SQL before applying it, so I can check it contains only that one column.',
		explanation:
			'It limits the migration to one nullable column, rules out every tempting tidy-up by name, and puts a human review in front of an automatic deploy.',
		minutes: 6,
		tags: ['database', 'migration'],
		isActive: true
	},
	{
		slug: 'scope-team-accounts',
		version: 1,
		title: 'Slice a large feature',
		description: 'A big request becomes safe when the first slice and its edges are explicit.',
		skill: 'scopeControl',
		type: 'controlScope',
		difficulty: 'advanced',
		scenario:
			'Product asked for team accounts: invitations, custom roles and per-seat billing. It touches auth, billing and the sign-up flow, and an agent working on all of it at once would also be tempted to adjust shared config (tsconfig, ESLint, dependencies, CI) to make things compile.',
		instructions:
			'Write the prompt for the first slice only: what is in, what is out, what must not be touched, where to stop, and how you know it is done.',
		given: {
			label: 'The vague prompt',
			text: 'Add team accounts with invitations, roles and per-seat billing.'
		},
		criteria: [
			phase,
			{ ...fencesOff, weight: 20 },
			sharedConfig,
			checkpoint,
			acceptanceCriteria(20, TEAMS)
		],
		pitfalls: [sweepingPitfall],
		exemplar:
			'This is phase 1 of team accounts: build only the email invitations, so an owner can invite a member by email and the member joins the team by accepting the link. Custom roles and per-seat billing are out of scope for this change. Do not change the billing module or the existing sign-up flow. Do not edit shared configuration either: tsconfig, the ESLint config, package.json dependencies and the CI workflows stay as they are; if you think one must change, ask me first. Stop after the invitation flow works and check in with me before the next phase. Done when: tests cover sending, accepting, expiring and re-sending an invitation, and they pass.',
		explanation:
			'It turns an epic into a first slice with explicit edges, protects the configuration everyone shares, and sets a checkpoint before scope can grow.',
		minutes: 10,
		tags: ['feature', 'planning'],
		isActive: true
	}
]
