export type Agent = 'claude' | 'codex' | 'unknown'

export interface LogEntry {
	/** ISO 8601 as the logger wrote it; empty when the logger had none. */
	readonly timestamp: string
	readonly text: string
}

export interface Turn {
	readonly prompt: LogEntry | null
	readonly response: LogEntry | null
}

/**
 * One session recovered from a `.claude-logs/` digest. Identity fields the
 * logger records (author, email, GitHub login) are deliberately not kept:
 * no metric needs them.
 */
export interface ParsedSession {
	readonly sessionId: string
	readonly agent: Agent
	readonly project: string | null
	readonly generatedAt: string | null
	readonly turns: readonly Turn[]
}

export type ParseFailure = 'no-frontmatter' | 'no-session-id' | 'no-entries'

export type RejectionReason =
	| ParseFailure
	| 'not-markdown'
	| 'too-large'
	| 'empty'
	| 'unreadable'
	| 'too-many-files'
	| 'duplicate-session'
