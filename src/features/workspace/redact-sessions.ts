import { redactSecrets } from '@/features/assessment/redact'
import type { LogEntry, ParsedSession } from '@/features/sessions/types'

const REDACTION_MARKER = /\[REDACTED[: ]/g

function redactEntry(entry: LogEntry | null): LogEntry | null {
	return entry == null ? null : { timestamp: entry.timestamp, text: redactSecrets(entry.text).text }
}

/**
 * Redacts every prompt and response. Run in the browser before anything is
 * sent, and again on the server before anything is stored: redacting
 * redacted text changes nothing, so the second pass costs nothing and the
 * server never has to trust the first.
 */
export function redactSessions(sessions: readonly ParsedSession[]): ParsedSession[] {
	return sessions.map((session) => ({
		...session,
		turns: session.turns.map((turn) => ({
			prompt: redactEntry(turn.prompt),
			response: redactEntry(turn.response)
		}))
	}))
}

/**
 * Credentials removed so far, counted from the markers left in their place —
 * by this redactor, by the browser's pass or by the logger that wrote the file.
 */
export function countRedactions(sessions: readonly ParsedSession[]): number {
	return sessions
		.flatMap((session) => session.turns)
		.flatMap((turn) => [turn.prompt?.text ?? '', turn.response?.text ?? ''])
		.reduce((total, text) => total + (text.match(REDACTION_MARKER)?.length ?? 0), 0)
}
