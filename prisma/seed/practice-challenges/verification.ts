import type { ChallengeDefinition, Criterion } from '@/features/practice/types'
import { asksForEvidence, asksForTests, blindTrustPitfall } from './shared'

// Each scenario is a fictional agent reply with planted gaps. The answer is the
// follow-up that makes the agent check its own work.

export const NOTE =
	'This reply is fictional, written for the exercise; it is not code from your project.'

export const challengesClaim: Criterion = {
	id: 'challenge',
	label: 'Questions the claim instead of accepting it',
	weight: 15,
	anyOf: [
		/\b(?:before (?:i|we) (?:accept|merge|ship|run)|not (?:yet )?(?:done|ready|safe)|(?:will|do) not (?:run|merge|ship|accept) (?:this|it)|won'?t (?:run|merge|ship)|are you sure|how (?:do|did) you know|did you (?:run|test|check|verify)|prove|double[- ]check|verify (?:that|it|your))\b/i
	],
	hint: 'Do not take "done" on trust: ask the agent to prove it.',
	template: 'Before I accept this, verify [the specific claim] and show how you checked.'
}

const NOTES_API = [/\b(?:notes?|endpoint|post|request|body|api)\b/i]
const DATES = [/\b(?:dates?|time ?zones?|utc|dst|daylight|offsets?|formats?|util\w*)\b/i]

export const VERIFICATION_CHALLENGES: readonly ChallengeDefinition[] = [
	{
		slug: 'verification-notes-endpoint',
		version: 1,
		title: 'Check a "Done!" endpoint',
		description: 'The agent says the endpoint is finished. It is not.',
		skill: 'verification',
		type: 'verifyOutput',
		difficulty: 'beginner',
		scenario:
			'You asked an agent to add an endpoint for creating notes. It replied with the code and the message below. The code saves the request body straight to the database: no input validation, no check that the user is signed in, and no tests.',
		instructions:
			'Write the follow-up prompt that makes the agent verify and correct its work before you accept it.',
		given: {
			label: `The agent's reply. ${NOTE}`,
			text: 'Done! I added POST /api/notes. It saves the note from the request body to the notes table and returns 201. Everything works.'
		},
		criteria: [
			challengesClaim,
			{
				id: 'validation',
				label: 'Asks for input validation',
				weight: 20,
				anyOf: [
					/\b(?:validat\w*|sanitiz\w*|schema|zod|empty|too long|missing (?:fields?|title|body)|invalid (?:input|body|payload))\b/i
				],
				hint: 'Ask what happens with an empty, missing or oversized note.',
				template: 'Validate the input: [required fields, maximum length, wrong types].'
			},
			{
				id: 'authorization',
				label: 'Asks about authorization',
				weight: 20,
				anyOf: [
					/\b(?:auth\w*|signed[- ]in|logged[- ]in|permission\w*|owner\w*|session|401|403|another user)\b/i
				],
				hint: 'Ask who is allowed to create a note, and what happens for anyone else.',
				template: 'Check authorization: [who may call this, and the response for everyone else].'
			},
			{ ...asksForTests(25, NOTES_API), label: 'Asks for tests of the endpoint' },
			asksForEvidence(20)
		],
		pitfalls: [blindTrustPitfall],
		exemplar:
			'Before I accept this, the endpoint is not done yet. Add input validation: title and body are required, body is at most 10,000 characters, and invalid input returns 400 with the field errors. Only a signed-in user may create a note, and it must be saved with their user id; anyone else gets 401. Add tests for a valid note, a missing title, an oversized body and a signed-out request, then run them and paste the output.',
		explanation:
			'It names the three missing checks, turns each into a concrete rule and a test, and asks for proof instead of another "Everything works".',
		minutes: 5,
		tags: ['verification', 'api'],
		isActive: true
	},
	{
		slug: 'verification-date-refactor',
		version: 1,
		title: 'A refactor that "passes all tests"',
		description: 'Passing tests are not proof when the behaviour quietly changed.',
		skill: 'verification',
		type: 'verifyOutput',
		difficulty: 'intermediate',
		scenario:
			"You asked an agent to tidy up a date utilities module. Its diff also switched two functions from UTC to the server's local time zone. There are no tests for time zones, so the suite still passes.",
		instructions:
			'Write the follow-up that gets the agent to find and justify any behaviour change, not just re-run the tests.',
		given: {
			label: `The agent's reply. ${NOTE}`,
			text: 'Refactored src/utils/dates.ts for readability: merged duplicate helpers and simplified the formatting code. All 42 tests pass, so behaviour is unchanged.'
		},
		criteria: [
			challengesClaim,
			{
				id: 'behaviourChange',
				label: 'Asks whether behaviour changed',
				weight: 25,
				anyOf: [
					/\b(?:behaviou?r (?:change|differ)\w*|time ?zones?|utc|local time|dst|daylight saving|output (?:differ|change)\w*|same (?:output|results?) as before)\b/i
				],
				hint: 'Ask what the functions return now that they did not before, especially around time zones.',
				template: 'List every function whose output changed, including [time zone or DST cases].'
			},
			{
				id: 'diff',
				label: 'Asks to see what changed',
				weight: 15,
				anyOf: [
					/\b(?:show (?:me )?the diff|walk me through (?:the )?(?:diff|changes)|what (?:exactly )?changed|each change)\b/i
				],
				hint: 'Ask the agent to walk through the diff, function by function.',
				template: 'Walk me through the diff, function by function.'
			},
			{ ...asksForTests(25, DATES), label: 'Asks for tests of the changed behaviour' },
			asksForEvidence(20)
		],
		pitfalls: [blindTrustPitfall],
		exemplar:
			'Passing tests do not show the behaviour is unchanged: there are no time zone tests. Walk me through the diff function by function and tell me whether any output differs from before, especially UTC versus local time and dates around a DST change. Add tests that pin the old behaviour (UTC output, a DST boundary, a date near midnight) and run them against both the old and the new code. Paste the results before I accept the refactor.',
		explanation:
			'The claim "tests pass, so behaviour is unchanged" is only as good as the tests. The follow-up targets the gap the suite does not cover.',
		minutes: 7,
		tags: ['verification', 'refactor'],
		isActive: true
	},
	{
		slug: 'verification-migration-script',
		version: 1,
		title: 'A migration that is "safe to run"',
		description: 'Verify a data migration before it touches production.',
		skill: 'verification',
		type: 'verifyOutput',
		difficulty: 'advanced',
		scenario:
			'An agent wrote a script that merges duplicate customer records. It deletes the duplicates after copying their orders. It was never run against a copy of real data.',
		instructions:
			'Write the follow-up that makes the agent prove the script is safe before anyone runs it in production.',
		given: {
			label: `The agent's reply. ${NOTE}`,
			text: 'The merge script is ready and safe to run in production. It finds duplicate customers by email, moves their orders to the oldest record and deletes the rest.'
		},
		criteria: [
			challengesClaim,
			{
				id: 'dryRun',
				label: 'Asks for a dry run on a copy',
				weight: 20,
				anyOf: [
					/\b(?:dry[- ]run|staging|copy of (?:the )?(?:prod|production|data)|snapshot|sandbox|without (?:writing|deleting|committing))\b/i
				],
				hint: 'Ask for a dry run, or a run against a copy of production data, first.',
				template: 'Run it as a dry run against [a copy of production data] first.'
			},
			{
				id: 'counts',
				label: 'Asks for checks on the data',
				weight: 20,
				anyOf: [
					/\b(?:counts?|before and after|reconcil\w*|verification quer\w*|check (?:that )?no (?:orders?|rows?|data))\b/i
				],
				hint: 'Ask for before-and-after counts that prove no orders were lost.',
				template: 'Compare [row counts and order totals] before and after.'
			},
			{
				id: 'rollback',
				label: 'Asks for a way back',
				weight: 15,
				anyOf: [/\b(?:roll ?back|backup|restore|undo|revert|transaction|soft[- ]delete)\b/i],
				hint: 'Ask how to undo it if the merge is wrong.',
				template: 'Wrap it in a transaction and [describe the backup and rollback].'
			},
			{
				id: 'edge',
				label: 'Asks about tricky duplicates',
				weight: 10,
				anyOf: [
					/\b(?:case[- ]insensitive|uppercase|whitespace|null emails?|edge cases?|false (?:matches|positives)|same email different)\b/i
				],
				hint: 'Ask how near-duplicates and wrong matches are handled.',
				template: 'Explain how [case differences, empty emails and wrong matches] are handled.'
			},
			asksForEvidence(15)
		],
		pitfalls: [blindTrustPitfall],
		exemplar:
			'I will not run this in production yet. Run it as a dry run against a copy of production data and report how many customers it would merge and delete. Compare the order counts and totals per customer before and after, and show me that no orders are lost. Wrap the real run in a transaction, take a backup first, and tell me how we roll back. Also explain how it handles emails that differ only by case or whitespace, and customers with no email.',
		explanation:
			'A destructive script is verified on a copy, with numbers that must match, and with a way back, before anyone trusts "safe to run".',
		minutes: 9,
		tags: ['verification', 'database'],
		isActive: true
	}
]
