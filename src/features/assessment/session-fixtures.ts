// Synthetic sessions for tests. Never real logs (docs/SESSION_LOGGING.md).
import type { ParsedSession } from '@/features/sessions/types'

const at = (minute: number) => new Date(Date.UTC(2026, 10, 1, 10, minute)).toISOString()

/** A session from prompts; each prompt is answered unless listed in `unanswered`. */
export function sessionOf({
	sessionId,
	prompts,
	unanswered = []
}: {
	sessionId: string
	prompts: readonly string[]
	unanswered?: readonly number[]
}): ParsedSession {
	return {
		sessionId,
		agent: 'claude',
		project: 'fixture',
		generatedAt: at(0),
		turns: prompts.map((text, index) => ({
			prompt: { timestamp: at(index * 2), text },
			response: unanswered.includes(index) ? null : { timestamp: at(index * 2 + 1), text: 'Done.' }
		}))
	}
}

export const STRONG_PROMPTS = [
	"Before you write any code, propose a plan for adding CSV export to src/features/sessions/session-metrics-view.tsx: the steps, the files you'd touch and the edge cases (empty uploads, very large files).",
	"Implement the plan. Only change src/features/sessions/. Don't touch the landing page. Done when the export button downloads a CSV with one row per session and the tests pass.",
	'The export fails on Windows: `TypeError: Cannot read properties of undefined` in csv.ts. I expected an empty file for zero sessions instead.',
	'Run the unit tests and show me the output so I can confirm it works.',
	'Add a `Clear` button next to Export in session-intake.tsx and make sure the existing tests still pass.',
	'The CSV header is wrong: it says `sessionid` but should be `session_id`, matching the table.',
	'Now build the import page from the same plan: only src/app/[locale]/(app)/import/, done when a test covers a malformed file.',
	'Did you run the e2e suite? Show me the result.'
] as const

export const WEAK_PROMPTS = [
	'build the whole app dashboard with everything',
	'fix it',
	'still not working',
	'still not working',
	'now make the settings page and the profile page and add login',
	'add dark mode',
	'ok'
] as const

export const STRONG_SESSION = sessionOf({ sessionId: 'strong', prompts: STRONG_PROMPTS })
export const WEAK_SESSION = sessionOf({ sessionId: 'weak', prompts: WEAK_PROMPTS })
