import { LOG_FILE_EXTENSION, MAX_LOG_FILE_BYTES, MAX_LOG_FILES } from './limits'
import { parseSessionLog } from './parse-log'
import type { ParsedSession, RejectionReason } from './types'

/** The parts of a browser `File` intake needs, so it runs under `node --test`. */
export interface LogFileSource {
	readonly name: string
	readonly size: number
	readonly read: () => Promise<string>
}

export interface RejectedFile {
	readonly fileName: string
	readonly reason: RejectionReason
}

export interface IntakeResult {
	readonly sessions: readonly ParsedSession[]
	readonly rejected: readonly RejectedFile[]
}

interface Accepted {
	readonly fileName: string
	readonly session: ParsedSession
}

function precheck(file: LogFileSource): RejectionReason | null {
	if (!file.name.toLowerCase().endsWith(LOG_FILE_EXTENSION)) return 'not-markdown'
	if (file.size === 0) return 'empty'
	if (file.size > MAX_LOG_FILE_BYTES) return 'too-large'
	return null
}

async function readOne(file: LogFileSource): Promise<Accepted | RejectedFile> {
	const failed = precheck(file)
	if (failed != null) return { fileName: file.name, reason: failed }
	let text: string
	try {
		text = await file.read()
	} catch {
		return { fileName: file.name, reason: 'unreadable' }
	}
	const parsed = parseSessionLog(text)
	return parsed.ok
		? { fileName: file.name, session: parsed.session }
		: { fileName: file.name, reason: parsed.reason }
}

const entryCount = (session: ParsedSession) =>
	session.turns.reduce(
		(count, turn) => count + (turn.prompt == null ? 0 : 1) + (turn.response == null ? 0 : 1),
		0
	)

// A log only grows while its session runs, so of two copies of one session the
// one with more entries is the later; generated_at breaks a tie.
function isNewer(candidate: ParsedSession, current: ParsedSession): boolean {
	const candidateEntries = entryCount(candidate)
	const currentEntries = entryCount(current)
	if (candidateEntries !== currentEntries) return candidateEntries > currentEntries
	return Date.parse(candidate.generatedAt ?? '') > Date.parse(current.generatedAt ?? '')
}

/**
 * Validates, parses and de-duplicates the picked files. Nothing is stored or
 * sent anywhere: the result lives only as long as the caller keeps it.
 */
export async function intakeLogFiles(files: readonly LogFileSource[]): Promise<IntakeResult> {
	const rejected: RejectedFile[] = files
		.slice(MAX_LOG_FILES)
		.map((file): RejectedFile => ({ fileName: file.name, reason: 'too-many-files' }))
	const results = await Promise.all(files.slice(0, MAX_LOG_FILES).map(readOne))

	const kept = new Map<string, Accepted>()
	for (const result of results) {
		if (!('session' in result)) {
			rejected.push(result)
			continue
		}
		const current = kept.get(result.session.sessionId)
		if (current == null) {
			kept.set(result.session.sessionId, result)
		} else if (isNewer(result.session, current.session)) {
			kept.set(result.session.sessionId, result)
			rejected.push({ fileName: current.fileName, reason: 'duplicate-session' })
		} else {
			rejected.push({ fileName: result.fileName, reason: 'duplicate-session' })
		}
	}

	return { sessions: [...kept.values()].map((entry) => entry.session), rejected }
}
