// The demonstration session behind "Try a sample session": one invented
// coding-agent session, written in the same `.claude-logs/` digest format a real
// upload uses, so it goes through the same intake, redaction and assessment as a
// visitor's own files. Not a real log and about no real person or project
// (docs/SESSION_LOGGING.md). The prompts are plain, mixed in quality on purpose;
// nothing here is tuned to reach a score, and the score is whatever `rules-1.0`
// finds.
import { assessSessions } from '@/features/assessment/assess'
import { buildLog, prompt, type FixtureEntry } from '@/features/sessions/log-fixture'
import { intakeLogFiles } from '@/features/sessions/intake'
import { metricsOverview } from '@/features/sessions/metrics'
import type { ParsedSession } from '@/features/sessions/types'
import type { StoredAssessment } from '@/features/workspace/repository'
import { redactSessions } from '@/features/workspace/redact-sessions'

export const SAMPLE_FILE_NAME = 'sample-expense-tracker-session.md'
export const SAMPLE_SESSION_ID = 'sample-expense-tracker'
/** Never a database id: nothing looks this up. */
export const SAMPLE_ASSESSMENT_ID = 'sample'

const MINUTES_BETWEEN_PROMPTS = 3
const START = Date.parse('2026-11-02T09:00:00Z')
const at = (minute: number) => new Date(START + minute * 60_000).toISOString()

const PROMPTS = [
	'build the whole expense tracker with login, charts and reports',
	"Before you write any code, propose a plan for adding a CSV export to src/reports/export.ts: the steps, the files you'd touch and the edge cases (an empty month, a very large month).",
	"Implement the plan. Only change src/reports/. Don't touch the login code. Done when the export downloads a CSV with one row per expense and the tests pass.",
	"it's broken",
	"The export fails with `TypeError: Cannot read properties of undefined (reading 'amount')` in export.ts. I expected an empty file when there are no expenses.",
	'add a filter by category',
	'now add the monthly chart and the budget page and the settings page and email reports',
	'still not working',
	'Run the tests and show me the output so I can confirm the filter works.',
	'Rename the helper formatAmount in src/lib/money.ts to formatCurrency and update its imports. Nothing else.',
	'fix it',
	'Did you run the end-to-end tests? Show me the result.'
] as const

const ANSWER = 'Done. I made the change and ran the checks.'

const ENTRIES: readonly FixtureEntry[] = PROMPTS.flatMap((text, index) => [
	prompt(at(index * MINUTES_BETWEEN_PROMPTS), text),
	{
		type: 'RESPONSE' as const,
		timestamp: at(index * MINUTES_BETWEEN_PROMPTS + 1),
		text: ANSWER
	}
])

/** The digest text exactly as a file chosen on the upload page would contain it. */
export function sampleDigest(): string {
	return buildLog({
		sessionId: SAMPLE_SESSION_ID,
		entries: ENTRIES,
		generatedAt: at(0)
	})
}

export interface SampleRun {
	readonly fileName: string
	readonly sessions: readonly ParsedSession[]
	readonly stored: StoredAssessment
	readonly promptCount: number
}

let cached: Promise<SampleRun> | null = null

async function run(): Promise<SampleRun> {
	const digest = sampleDigest()
	const intake = await intakeLogFiles([
		{
			name: SAMPLE_FILE_NAME,
			size: new TextEncoder().encode(digest).length,
			read: () => Promise.resolve(digest)
		}
	])
	if (intake.rejected.length > 0 || intake.sessions.length === 0) {
		// The sample is a fixed file; if intake ever rejects it, say so loudly in tests.
		throw new Error('The sample session was rejected by intake')
	}
	// The digest format fixes the project name of the shared test builder; show a clear one.
	const sessions = redactSessions(intake.sessions).map((session) => ({
		...session,
		project: 'expense-tracker (sample)'
	}))
	const assessment = assessSessions(sessions)
	const overview = metricsOverview(sessions)
	return {
		fileName: SAMPLE_FILE_NAME,
		sessions,
		promptCount: overview.promptCount,
		stored: {
			id: SAMPLE_ASSESSMENT_ID,
			uploadId: SAMPLE_ASSESSMENT_ID,
			createdAt: new Date(START),
			overallScore: assessment.overall.score,
			rubricVersion: assessment.rubricVersion,
			assessment,
			overview
		}
	}
}

/**
 * Runs the sample through the real pipeline: digest, intake validation,
 * redaction, then the rules. Pure and deterministic; it touches no database,
 * no account and no network, and the result is the same on every call.
 */
export function loadSample(): Promise<SampleRun> {
	cached ??= run()
	return cached
}
