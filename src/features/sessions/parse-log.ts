import { MAX_SESSION_ID_LENGTH } from './limits'
import type { Agent, LogEntry, ParseFailure, ParsedSession, Turn } from './types'

// Reads both writers of the `.claude-logs/` format: the repo's
// scripts/session-log.mjs (has `agent:` and escapes forged markers) and the
// original guide's extract-log.py (neither). Per-entry statistics in the file
// are ignored; metrics are recomputed from the text, so an edited or older
// log cannot misreport them.

const FRONTMATTER = /^---\n([\s\S]*?)\n---(?:\n|$)/
const ENTRY_MARKER = /^\[CLAUDE_LOG_ENTRY type=(PROMPT|RESPONSE) num=\d+ session=\S+\]$/
const ENTRY_META_LINE = /^[a-z_]+: ?/
const ESCAPED_MARKER = /^(\\+)\[CLAUDE_LOG_ENTRY/gm
const KNOWN_AGENTS: readonly Agent[] = ['claude', 'codex']

export type ParseResult =
	| { readonly ok: true; readonly session: ParsedSession }
	| { readonly ok: false; readonly reason: ParseFailure }

function readFrontmatter(markdown: string): Map<string, string> | null {
	const match = FRONTMATTER.exec(markdown)
	if (match?.[1] == null) return null
	const fields = new Map<string, string>()
	for (const line of match[1].split('\n')) {
		const at = line.indexOf(': ')
		if (at > 0) fields.set(line.slice(0, at).trim(), line.slice(at + 2).trim())
	}
	return fields
}

function toAgent(value: string | undefined): Agent {
	return KNOWN_AGENTS.find((agent) => agent === value) ?? 'unknown'
}

function toEntry(lines: string[]): LogEntry {
	let timestamp = ''
	let bodyStart = 0
	while (bodyStart < lines.length && ENTRY_META_LINE.test(lines[bodyStart] ?? '')) {
		const line = lines[bodyStart] ?? ''
		if (line.startsWith('timestamp:')) timestamp = line.slice('timestamp:'.length).trim()
		bodyStart++
	}
	const text = lines
		.slice(bodyStart)
		.join('\n')
		.trim()
		.replace(ESCAPED_MARKER, (_, slashes: string) => `${slashes.slice(1)}[CLAUDE_LOG_ENTRY`)
	return { timestamp, text }
}

function readTurns(markdown: string): Turn[] {
	const turns: { prompt: LogEntry | null; response: LogEntry | null }[] = []
	let current: { type: string; lines: string[] } | null = null

	const flush = () => {
		if (current == null) return
		const entry = toEntry(current.lines)
		const last = turns.at(-1)
		if (current.type === 'PROMPT') turns.push({ prompt: entry, response: null })
		else if (last != null && last.response == null) last.response = entry
		else turns.push({ prompt: null, response: entry })
		current = null
	}

	for (const line of markdown.split('\n')) {
		const match = ENTRY_MARKER.exec(line)
		if (match?.[1] != null) {
			flush()
			current = { type: match[1], lines: [] }
		} else if (current != null) {
			current.lines.push(line)
		}
	}
	flush()
	return turns.filter((turn) => turn.prompt?.text || turn.response?.text)
}

export function parseSessionLog(raw: string): ParseResult {
	const markdown = raw.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
	const fields = readFrontmatter(markdown)
	if (fields == null) return { ok: false, reason: 'no-frontmatter' }

	const sessionId = fields.get('session_id') ?? ''
	if (sessionId === '' || sessionId.length > MAX_SESSION_ID_LENGTH || /\s/.test(sessionId)) {
		return { ok: false, reason: 'no-session-id' }
	}

	const turns = readTurns(markdown)
	if (turns.length === 0) return { ok: false, reason: 'no-entries' }

	return {
		ok: true,
		session: {
			sessionId,
			agent: toAgent(fields.get('agent')),
			project: fields.get('project') || null,
			generatedAt: fields.get('generated_at') || null,
			turns
		}
	}
}
