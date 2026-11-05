import type { Scenario } from './types'

// Fifteen scenarios: three difficulties for each of the five assessed skills.
// Content is invented for practice, about no real person or project. A test holds
// each one to the rubric: its effective choice is never flagged by the assessment
// rules, and its ineffective choices are never credited by them.

export const SCENARIOS: readonly Scenario[] = [
	// ---- Prompt clarity: vagueReference ----------------------------------------------
	{
		id: 'clarity-1',
		skill: 'promptClarity',
		criterion: 'vagueReference',
		difficulty: 1,
		title: 'A failing test, described with "it"',
		setup: 'A login test started failing after your last change. You open a new request.',
		conversation: [
			{ role: 'agent', text: 'Finished the signup form. All checks passed on my side.' },
			{ role: 'you', text: 'Thanks. Now the login test is red.' }
		],
		question: 'What do you send next?',
		options: [
			{
				id: 'a',
				label: 'fix it',
				quality: 'ineffective',
				why: '"it" could be the test, the login code or the signup form. The agent has to guess what you mean and where to look.'
			},
			{
				id: 'b',
				label:
					'Fix the failing test in tests/login.test.ts: it expects a 401 but gets a 500 when the password is empty. Do not change the other tests.',
				quality: 'effective',
				why: 'It names the file, the exact symptom and a limit, so the agent can act without guessing.'
			},
			{
				id: 'c',
				label: 'The login test fails, please look into it.',
				quality: 'partial',
				why: 'It names the area, which helps, but gives no file, error or expected result, so the agent still has to search.'
			}
		],
		matters:
			'A request that points at something unnamed makes the agent guess. A wrong guess costs a round trip and often a change you did not want.',
		better:
			'Name the file or function, say what happens and what you expected, and add one limit if something must not change.',
		takeaway: 'Replace "it" and "this" with the file, the error and the expected result.'
	},
	{
		id: 'clarity-2',
		skill: 'promptClarity',
		criterion: 'vagueReference',
		difficulty: 2,
		title: 'A feature with no anchor',
		setup: 'You want a date filter on the expenses table in a project the agent has never seen.',
		conversation: [{ role: 'agent', text: 'Ready. What would you like to work on?' }],
		question: 'What do you send?',
		options: [
			{
				id: 'a',
				label: 'make it better',
				quality: 'ineffective',
				why: '"It" and "better" leave the target, the change and the finish line for the agent to decide.'
			},
			{
				id: 'b',
				label:
					'Add a date range filter to the expenses table in src/app/expenses/table.tsx, using the existing Select style. Done when picking a range hides rows outside it and the table tests pass.',
				quality: 'effective',
				why: 'It states the goal, the place, the pattern to follow and how you will know it works.'
			},
			{
				id: 'c',
				label: 'Add a date range filter to the expenses table.',
				quality: 'partial',
				why: 'The goal and the table are clear. Without a file, a pattern to follow or a finish line, the agent may build it in an odd place or stop early.'
			}
		],
		matters:
			'A goal alone leaves context and a finish line to chance. Two sentences more usually save a rework.',
		better:
			'State the goal, anchor it to a file or component, mention a pattern to reuse, and say what done looks like.',
		takeaway: 'Goal, place, pattern, done-when: four short pieces make most requests clear.'
	},
	{
		id: 'clarity-3',
		skill: 'promptClarity',
		criterion: 'vagueReference',
		difficulty: 3,
		title: 'The agent guessed the wrong component',
		setup: 'You asked to "fix the spacing in that card". The agent changed a different card.',
		conversation: [
			{ role: 'you', text: 'fix the spacing in that card' },
			{ role: 'agent', text: 'Updated the spacing in ProductCard.' }
		],
		question: 'You meant the pricing card. What do you send?',
		options: [
			{
				id: 'a',
				label: 'no, the other one',
				quality: 'ineffective',
				why: '"the other one" repeats the problem: the agent still has no name or file to go on.'
			},
			{
				id: 'b',
				label:
					'Wrong card. I meant PricingCard in src/components/pricing-card.tsx: reduce the gap between the price and the button from 24px to 12px, and leave ProductCard as it was.',
				quality: 'effective',
				why: 'It corrects the target by name and file, states the exact change, and says what to leave alone.'
			},
			{
				id: 'c',
				label: 'That is the wrong card. I meant the pricing one, please redo it.',
				quality: 'partial',
				why: 'It names the right card, but without the file or the exact change the agent may repeat the guess.'
			}
		],
		matters: 'Ambiguous references compound: each wrong guess adds changes you then have to undo.',
		better: 'Name the right target and the change, and say to leave the wrong one as it was.',
		takeaway:
			'When the agent picked the wrong thing, correct with the name, the file and the change.'
	},

	// ---- Planning: straightToBuild ---------------------------------------------------
	{
		id: 'planning-1',
		skill: 'planning',
		criterion: 'straightToBuild',
		difficulty: 1,
		title: 'A big feature, asked in one line',
		setup: 'You need user roles added to an app with sign-in already working.',
		conversation: [{ role: 'agent', text: 'Ready for the next task.' }],
		question: 'What do you send?',
		options: [
			{
				id: 'a',
				label: 'Build user roles for the app.',
				quality: 'ineffective',
				why: 'A large build with no plan: the agent will choose the design, the files and the data changes, and you see them only afterwards.'
			},
			{
				id: 'b',
				label:
					'Build user roles for the app. Before writing code, propose a plan: the steps, the files you will touch and the risks. Wait for my go-ahead.',
				quality: 'effective',
				why: 'You get the design to review before any code exists, so a wrong direction costs a sentence, not a rewrite.'
			},
			{
				id: 'c',
				label:
					'Build user roles for the app with admin and member roles, and tell me which files you changed.',
				quality: 'partial',
				why: 'The roles are specified, which helps, but you only learn the design after it is built.'
			}
		],
		matters:
			'The cost of changing direction is lowest before code is written. A plan is the cheapest review you will get.',
		better: 'Ask for the plan first: steps, files, risks, and an explicit pause for your go-ahead.',
		takeaway: 'For anything that touches several files, ask for a plan and approve it first.'
	},
	{
		id: 'planning-2',
		skill: 'planning',
		criterion: 'straightToBuild',
		difficulty: 2,
		title: 'A migration with edge cases',
		setup: 'You want to move expense categories from a text column to their own table.',
		conversation: [{ role: 'agent', text: 'Ready. What is the next change?' }],
		question: 'What do you send?',
		options: [
			{
				id: 'a',
				label: 'Migrate the expense categories to a separate table.',
				quality: 'ineffective',
				why: 'A data migration with no plan and no edge cases: existing rows, rollbacks and null values are all left to chance.'
			},
			{
				id: 'b',
				label:
					'Migrate the expense categories to a separate table. First propose a plan with the steps and the edge cases: rows with no category, duplicate names and how to roll back. Do not write code until I approve.',
				quality: 'effective',
				why: 'It asks for the plan, names the risky cases up front and keeps you in control of when code starts.'
			},
			{
				id: 'c',
				label:
					'Migrate the expense categories to a separate table and handle rows that have no category.',
				quality: 'partial',
				why: 'One edge case is named, which is good, but there is no plan to review and rollback is not considered.'
			}
		],
		matters:
			'Migrations are hard to undo. The questions you ask before the first line are the ones that protect your data.',
		better:
			'Ask for a plan that lists the edge cases and rollback, and hold the code until you approve it.',
		takeaway:
			'Name the risky cases in the request, and pause for approval before anything irreversible.'
	},
	{
		id: 'planning-3',
		skill: 'planning',
		criterion: 'straightToBuild',
		difficulty: 3,
		title: 'A plan arrives with a risky step',
		setup: 'You asked for a plan to add an import page. Step 4 rewrites the shared parser.',
		conversation: [
			{
				role: 'agent',
				text: 'Plan: 1. Add the import page. 2. Add a file picker. 3. Validate rows. 4. Rewrite the shared CSV parser to support quoted fields. 5. Add tests.'
			}
		],
		question: 'What do you send?',
		options: [
			{
				id: 'a',
				label: 'Looks good, go ahead and build it all.',
				quality: 'ineffective',
				why: 'Step 4 changes shared code that other pages use. Approving without questioning it hands the agent a risky change unreviewed.'
			},
			{
				id: 'b',
				label:
					'Build the import page and steps 1 to 3 and 5 only. Step 4 rewrites the shared parser, so before touching it, show me which pages use it and the edge cases a change could break.',
				quality: 'effective',
				why: 'You approve the safe steps, hold the risky one, and ask the specific question that decides whether it is safe.'
			},
			{
				id: 'c',
				label: 'Is step 4 safe? Then build it.',
				quality: 'partial',
				why: 'Asking is right, but "is it safe?" invites a yes. A concrete question (who uses it, what could break) gets an answer you can check.'
			}
		],
		matters:
			'A plan is only a safeguard if you read it. The risky step is exactly where a skim goes wrong.',
		better:
			'Approve what is safe, hold what is risky, and ask a question the agent has to answer with facts.',
		takeaway: 'Read the plan for the step that touches shared code, and question that one first.'
	},

	// ---- Verification: acceptedWithoutCheck ------------------------------------------
	{
		id: 'verification-1',
		skill: 'verification',
		criterion: 'acceptedWithoutCheck',
		difficulty: 1,
		title: '"All done" and a next task',
		setup:
			'The agent says the CSV export is finished and all checks passed. You have a next change ready.',
		conversation: [
			{ role: 'you', text: 'Add a CSV export to the reports page.' },
			{ role: 'agent', text: 'Done! I added the export and all checks passed.' }
		],
		question: 'What do you send?',
		options: [
			{
				id: 'a',
				label: 'Add a category filter to the reports page.',
				quality: 'ineffective',
				why: 'You moved on without seeing any evidence the export works. If it does not, the filter is now built on top of it.'
			},
			{
				id: 'b',
				label:
					'Add a category filter to the reports page, then run the tests and show me the output so I can confirm the export and the filter work.',
				quality: 'effective',
				why: 'It asks for the real output, not a claim, and covers both the finished work and the new work.'
			},
			{
				id: 'c',
				label: 'Add a category filter to the reports page. Did you test the export?',
				quality: 'partial',
				why: 'Asking is better than silence, but "did you test it?" can be answered "yes" with no proof. Ask to see the output.'
			}
		],
		matters:
			'An agent reports what it believes happened. Only a check you can see tells you what did.',
		better: 'Ask the agent to run the checks and show the output, then read it.',
		takeaway: 'Replace "did you test it?" with "run it and show me the output".'
	},
	{
		id: 'verification-2',
		skill: 'verification',
		criterion: 'acceptedWithoutCheck',
		difficulty: 2,
		title: 'A bug "fixed" without a repro',
		setup:
			'The agent says the empty-month crash is fixed. You want the next change in the same file.',
		conversation: [
			{ role: 'you', text: 'Fix the crash when a month has no expenses.' },
			{ role: 'agent', text: 'Fixed. The export no longer crashes on empty months.' }
		],
		question: 'What do you send?',
		options: [
			{
				id: 'a',
				label: 'Rename formatAmount to formatCurrency in the same file.',
				quality: 'ineffective',
				why: 'The fix was never shown to work, and the next edit is in the same file, so a problem would now be harder to trace.'
			},
			{
				id: 'b',
				label:
					'Rename formatAmount to formatCurrency in the same file. Before that, run the tests and show me the output for the empty-month case so I can confirm it is fixed.',
				quality: 'effective',
				why: 'It asks for the exact scenario that crashed, run again, with output you can read, before further changes pile up.'
			},
			{
				id: 'c',
				label: 'Rename formatAmount to formatCurrency and make sure nothing else broke.',
				quality: 'partial',
				why: '"Make sure nothing broke" is a hope, not a check. It does not name the case or ask for evidence.'
			}
		],
		matters:
			'The scenario that failed is the best test of the fix. If you do not rerun it, you are trusting a sentence.',
		better: 'Ask for the failing case to be reproduced and rerun, with the output shown.',
		takeaway: 'Verify a fix with the exact case that broke, before building on it.'
	},
	{
		id: 'verification-3',
		skill: 'verification',
		criterion: 'acceptedWithoutCheck',
		difficulty: 3,
		title: 'A change across five files',
		setup: 'The agent reports a refactor that touched five files. It says the tests pass.',
		conversation: [
			{ role: 'you', text: 'Refactor the money helpers into src/lib/money.' },
			{ role: 'agent', text: 'Done. Updated five files and the unit tests pass.' }
		],
		question: 'What do you send?',
		options: [
			{
				id: 'a',
				label: 'Update the README to describe the new money helpers.',
				quality: 'ineffective',
				why: 'Documentation was written for a refactor nobody checked. If the refactor is wrong, the docs now describe a mistake.'
			},
			{
				id: 'b',
				label:
					'Update the README for the new money helpers. First run the end-to-end tests too, list the five files you changed, and show me the test output.',
				quality: 'effective',
				why: 'Unit tests alone rarely cover a five-file change. This asks for the wider check, the list of files and the output.'
			},
			{
				id: 'c',
				label: 'Update the README for the new money helpers and confirm all the tests pass.',
				quality: 'partial',
				why: 'It asks for confirmation, but not for output, and it does not widen the check beyond the unit tests the agent already ran.'
			}
		],
		matters:
			'The wider the change, the less a narrow test proves. The check should grow with the change.',
		better:
			'Ask for the broader tests, the list of touched files and the real output before building on it.',
		takeaway: 'Match the check to the change: a wide refactor needs a wide test and the output.'
	},

	// ---- Iteration: vagueFeedback ----------------------------------------------------
	{
		id: 'iteration-1',
		skill: 'iteration',
		criterion: 'vagueFeedback',
		difficulty: 1,
		title: 'The fix did not work',
		setup: 'The agent changed the cart total, but the test still fails.',
		conversation: [
			{ role: 'agent', text: 'I updated the cart total calculation. It should work now.' }
		],
		question: 'What do you reply?',
		options: [
			{
				id: 'a',
				label: 'still broken',
				quality: 'ineffective',
				why: 'The agent learns nothing new: not what failed, where, or what you expected. The next attempt is another guess.'
			},
			{
				id: 'b',
				label:
					'Still failing: expected the total to be 12 but got 10, in tests/cart.test.ts line 30. The coupon is applied before tax in the code.',
				quality: 'effective',
				why: 'The exact expected and actual values, the place, and a clue. The agent can go straight to the cause.'
			},
			{
				id: 'c',
				label: 'The total is still wrong in the cart test.',
				quality: 'partial',
				why: 'It says where, which helps, but not what you expected or what you got.'
			}
		],
		matters:
			'Feedback is the only new information the agent gets between attempts. Vague feedback means a vague next attempt.',
		better: 'Give expected versus actual, with the exact message or value and where it appears.',
		takeaway: 'Reply with "expected X, got Y, here", not "still broken".'
	},
	{
		id: 'iteration-2',
		skill: 'iteration',
		criterion: 'vagueFeedback',
		difficulty: 2,
		title: 'The same message, again',
		setup: 'You have sent "still not working" twice. The agent changed something both times.',
		conversation: [
			{ role: 'you', text: 'still not working' },
			{ role: 'agent', text: 'Tried a different approach to the date parsing.' },
			{ role: 'you', text: 'still not working' },
			{ role: 'agent', text: 'Adjusted the timezone handling.' }
		],
		question: 'What do you send now?',
		options: [
			{
				id: 'a',
				label: 'still not working, try again',
				quality: 'ineffective',
				why: 'The third identical message gives the agent nothing more than the first two did.'
			},
			{
				id: 'b',
				label:
					'The error is `Invalid time value` in parseDate at src/lib/dates.ts line 18, when the input is "2026-13-01". I expected it to return null. Here is the stack trace: ...',
				quality: 'effective',
				why: 'A real error message, a location, the input that triggers it and the expected behaviour. It changes what the agent knows.'
			},
			{
				id: 'c',
				label: 'It crashes on a bad date. I expected it to return null instead.',
				quality: 'partial',
				why: 'It states expected behaviour, which is good, but no error text, file or example input.'
			}
		],
		matters:
			'Repeating a message does not add information. Each attempt without new facts is likely to fail the same way.',
		better: 'Paste the error, name the input that triggers it, and say what you expected.',
		takeaway:
			'If you are about to send the same message again, add the error, the input or the expectation.'
	},
	{
		id: 'iteration-3',
		skill: 'iteration',
		criterion: 'vagueFeedback',
		difficulty: 3,
		title: 'Mostly right, one detail wrong',
		setup: 'The new settings page works, except the save button saves twice.',
		conversation: [
			{ role: 'agent', text: 'The settings page is done. The form saves and shows a toast.' }
		],
		question: 'What do you reply?',
		options: [
			{
				id: 'a',
				label: 'good but there is a bug',
				quality: 'ineffective',
				why: 'It says something is wrong without saying what. The agent cannot tell which part to change.'
			},
			{
				id: 'b',
				label:
					'The page is right except one thing: clicking Save sends two requests to /api/settings (see the network tab). Expected one request, and the button disabled while it saves. Only change the save handler.',
				quality: 'effective',
				why: 'It keeps what works, pinpoints the one fault with evidence, states the expectation and limits the change.'
			},
			{
				id: 'c',
				label: 'Save seems to run twice, can you fix that?',
				quality: 'partial',
				why: 'It names the fault, but gives no evidence, no expected behaviour and no limit on what to change.'
			}
		],
		matters:
			'When most of the work is good, precise feedback protects it. Vague feedback invites a rewrite of the good parts too.',
		better: 'Say what is right, name the single fault with evidence, and limit the change.',
		takeaway: 'Keep what works: point at the one fault, give evidence and limit the edit.'
	},

	// ---- Scope control: broadRequest -------------------------------------------------
	{
		id: 'scope-1',
		skill: 'scopeControl',
		criterion: 'broadRequest',
		difficulty: 1,
		title: 'The whole app, in one request',
		setup: 'You want an expense tracker. You are about to describe all of it.',
		conversation: [{ role: 'agent', text: 'Ready. What are we building?' }],
		question: 'What do you send?',
		options: [
			{
				id: 'a',
				label: 'Build the whole expense tracker with login, charts and reports.',
				quality: 'ineffective',
				why: 'A sweeping request with no limits. The result is large, hard to review and unlikely to match what you had in mind.'
			},
			{
				id: 'b',
				label:
					'In src/app/expenses/, add a page that lists expenses from the existing API. Only that page: no login, no charts. Done when the list renders and its test passes.',
				quality: 'effective',
				why: 'One piece, one place, explicit limits, a finish line. You can review it in minutes and build the next piece on it.'
			},
			{
				id: 'c',
				label: 'Start with the expenses page. We will do the rest later.',
				quality: 'partial',
				why: 'It narrows the request, but names no files, limits or finish line, so "the expenses page" can still grow.'
			}
		],
		matters:
			'Small, bounded requests are easier to review, easier to undo and easier to get right.',
		better:
			'Pick one piece, name where it lives, say what to leave out and how you will know it is done.',
		takeaway: 'One piece at a time: name it, place it, limit it.'
	},
	{
		id: 'scope-2',
		skill: 'scopeControl',
		criterion: 'broadRequest',
		difficulty: 2,
		title: 'Five tasks in one message',
		setup: 'You have a list of small changes and are tempted to send them together.',
		conversation: [{ role: 'agent', text: 'The export is merged. What is next?' }],
		question: 'What do you send?',
		options: [
			{
				id: 'a',
				label:
					'Now add the monthly chart and the budget page and the settings page and email reports and dark mode.',
				quality: 'ineffective',
				why: 'Five features bundled: the agent will interleave them, and one wrong decision affects all five.'
			},
			{
				id: 'b',
				label:
					'Add the monthly chart in src/components/month-chart.tsx. Only the chart: leave the budget, settings and email work for separate requests. Done when it renders the existing totals.',
				quality: 'effective',
				why: 'One task from the list, with the others named and explicitly deferred.'
			},
			{
				id: 'c',
				label: 'Add the monthly chart first, then the budget page, one after the other.',
				quality: 'partial',
				why: 'The order helps, but it is still one message holding two tasks, so the agent may do both before you can review the first.'
			}
		],
		matters:
			'Bundled requests remove your chance to review between steps. Errors compound across the bundle.',
		better: 'Send one task, name what you are deferring, and review before the next.',
		takeaway: 'If your message has "and" between tasks, split it.'
	},
	{
		id: 'scope-3',
		skill: 'scopeControl',
		criterion: 'broadRequest',
		difficulty: 3,
		title: 'A rename that must not spread',
		setup: 'You want one helper renamed. The agent tends to tidy things as it goes.',
		conversation: [
			{ role: 'agent', text: 'I can also clean up nearby code while I am in there if you like.' }
		],
		question: 'What do you send?',
		options: [
			{
				id: 'a',
				label: 'Sure, go ahead and clean up everything while you are in there.',
				quality: 'ineffective',
				why: '"Whatever else needs it" is open-ended. You will get changes you did not ask for and must now review.'
			},
			{
				id: 'b',
				label:
					'Rename formatAmount to formatCurrency in src/lib/money.ts and update its imports. Nothing else: do not reformat, move or clean up any other code.',
				quality: 'effective',
				why: 'It names the target and the file, and draws a hard boundary around everything else.'
			},
			{
				id: 'c',
				label: 'Rename formatAmount to formatCurrency, but keep the changes small.',
				quality: 'partial',
				why: '"Small" is relative. Without a boundary, the agent decides how small.'
			}
		],
		matters: 'Unrequested changes are the hardest to review because you were not expecting them.',
		better: 'Name the exact change and say what not to touch.',
		takeaway: 'State the boundary as well as the task: what must stay exactly as it is.'
	}
]

export function scenarioById(id: string): Scenario | undefined {
	return SCENARIOS.find((scenario) => scenario.id === id)
}
