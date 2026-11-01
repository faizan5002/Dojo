// Builds synthetic `.claude-logs/` digests for tests. Real logs must never be
// used as fixtures: they are local-only and sharing them is prohibited
// (docs/SESSION_LOGGING.md).

export interface FixtureEntry {
	readonly type: 'PROMPT' | 'RESPONSE'
	readonly timestamp: string
	readonly text: string
}

export function buildLog({
	sessionId,
	entries,
	agent = 'claude',
	generatedAt = '2026-11-01T12:00:00.000Z'
}: {
	sessionId: string
	entries: readonly FixtureEntry[]
	agent?: string | null
	generatedAt?: string
}): string {
	const head = [
		'---',
		`session_id: ${sessionId}`,
		...(agent == null ? [] : [`agent: ${agent}`]),
		'date: 2026-11-01',
		'author: fixture',
		'github_user: fixture',
		'git_email: fixture@example.com',
		'project: fixture-project',
		`generated_at: ${generatedAt}`,
		'---',
		'',
		'# Claude Session Log - 2026-11-01',
		'',
		'---',
		''
	]
	let exchange = 0
	const body = entries.flatMap((entry) => {
		if (entry.type === 'PROMPT') exchange++
		return [
			'',
			`[CLAUDE_LOG_ENTRY type=${entry.type} num=${exchange} session=${sessionId}]`,
			`timestamp: ${entry.timestamp}`,
			`time: ${entry.timestamp.slice(0, 16).replace('T', ' ')}`,
			`chars: ${entry.text.length}`,
			'',
			entry.text,
			''
		]
	})
	return [...head, ...body].join('\n')
}

export const prompt = (timestamp: string, text: string): FixtureEntry => ({
	type: 'PROMPT',
	timestamp,
	text
})

export const response = (timestamp: string, text: string): FixtureEntry => ({
	type: 'RESPONSE',
	timestamp,
	text
})
