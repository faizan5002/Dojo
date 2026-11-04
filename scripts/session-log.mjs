#!/usr/bin/env node
// Writes a clean conversation digest of the current agent session to
// `<repo>/.claude-logs/<timestamp>_<session-id>.md`: user prompts and FINAL
// assistant responses only, never tool calls, tool results, file reads,
// thinking or sidechain output. One implementation for every agent, so a repo
// holds one log location and one format (spec: agent-session-logs-setup.md).
//
//   node scripts/session-log.mjs claude   # Claude Code hook (JSON on stdin)
//   node scripts/session-log.mjs codex    # Codex hook      (JSON on stdin)
//   node scripts/session-log.mjs <agent> --transcript <file>   # manual backfill
//
// Hooks are wired in .claude/settings.json and .codex/hooks.json. A logger must
// never break the agent it observes: every failure is swallowed and the process
// exits 0 (exit 2 would BLOCK the prompt / the stop).
//
// Redaction runs before anything is written (docs/rules/secrets.md). It is a
// backstop, like scripts/check-secrets.mjs, which it also consults: whatever
// that scanner would still flag in the output is replaced line by line, so a
// log this script writes cannot fail `pnpm check:secrets`.

import { spawnSync } from 'node:child_process'
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	renameSync,
	writeFileSync
} from 'node:fs'
import * as zlib from 'node:zlib'
import { basename, dirname, join, resolve } from 'node:path'
import { homedir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { scanText } from './check-secrets.mjs'

export const LOG_DIR = '.claude-logs'
const UNKNOWN = 'unknown'
const EXEC_TIMEOUT_MS = 5000
const MAX_SESSION_ID_LENGTH = 128
const MS_PER_MINUTE = 60000
const LONG_PROMPT_CHARS = 500
// A message that stops on `tool_use` is narration before a tool call, not an
// answer. Older Claude Code versions wrote no stop reason at all, so the
// absence of one is not disqualifying; a later tool_use block settles it.
const NON_FINAL_STOP_REASONS = new Set(['tool_use', 'pause_turn'])

// ---------------------------------------------------------------------------
// Redaction
// ---------------------------------------------------------------------------

const REFERENCE_VALUE = /^(\$|%|<|\{\{)|process\.env|import\.meta|os\.environ|getenv|\[REDACTED/i

// Span-based first pass; each hit becomes `[REDACTED:<id>]`.
const REDACTIONS = [
	{
		id: 'private-key',
		regex: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z0-9 ]*PRIVATE KEY-----|$)/g
	},
	{ id: 'aws-key', regex: /\b(?:AKIA|ASIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA)[0-9A-Z]{16}\b/g },
	{
		id: 'github-token',
		regex: /\b(?:gh[pousr]_[A-Za-z0-9]{30,255}|github_pat_[0-9A-Za-z_]{22,255})\b/g
	},
	{ id: 'slack-token', regex: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/g },
	{ id: 'stripe-key', regex: /\b(?:sk|rk|pk)_live_[0-9A-Za-z]{16,}\b/g },
	{ id: 'ai-api-key', regex: /\bsk-(?:ant-|proj-|svcacct-|or-v1-)?[A-Za-z0-9_-]{20,}\b/g },
	{ id: 'google-key', regex: /\bAIza[0-9A-Za-z_-]{35}\b/g },
	{ id: 'sendgrid-key', regex: /\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/g },
	{ id: 'supabase-key', regex: /\bsb_secret_[A-Za-z0-9_-]{20,}\b/g },
	{ id: 'posthog-key', regex: /\bph[cx]_[A-Za-z0-9]{30,}\b/g },
	{ id: 'npm-token', regex: /\bnpm_[A-Za-z0-9]{36}\b/g },
	{ id: 'jwt', regex: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{6,}\b/g },
	// proto://user:PASSWORD@host — keep the shape, drop the password.
	{ id: 'url-password', regex: /(\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:)([^\s/@]+)(@)/g, keep: [1, 3] },
	{
		id: 'auth-header',
		regex: /\b((?:Bearer|Basic)\s+)([A-Za-z0-9._~+/=-]{16,})/g,
		keep: [1],
		guard: 2
	},
	{
		// MY_SERVICE_KEY=…, "apiKey": "…", password: … — a credential-named key with a
		// token-shaped value. Over-redacting prose is the safe direction for a log.
		id: 'credential-assignment',
		regex:
			// Name length is capped so a long run of letters cannot make the scan quadratic.
			/(\b[A-Za-z_][A-Za-z0-9_.-]{0,59}(?:key|token|secret|password|passwd|pwd|credential|authorization)[A-Za-z0-9_.-]{0,59}["']?\s*[:=]\s*["'`]?)([A-Za-z0-9._+/=~-]{8,})/gi,
		keep: [1],
		guard: 2,
		accept: (value) => /\d/.test(value) || value.length >= 20
	}
]

/**
 * Remove credentials from `text` before it is persisted. Pass 1 rewrites known
 * shapes in place; pass 2 asks the repo's own secret scanner what is still
 * flagged and blanks those lines outright (fail closed).
 * @returns {{ text: string, count: number }}
 */
export function redact(text) {
	let count = 0
	let out = String(text ?? '')
	for (const rule of REDACTIONS) {
		out = out.replace(rule.regex, (...args) => {
			const groups = args.slice(0, -2)
			const guarded = rule.guard != null ? groups[rule.guard] : undefined
			if (
				guarded != null &&
				(REFERENCE_VALUE.test(guarded) || (rule.accept && !rule.accept(guarded)))
			) {
				return groups[0]
			}
			count++
			const marker = `[REDACTED:${rule.id}]`
			if (!rule.keep) return marker
			const kept = rule.keep.map((i) => groups[i])
			return kept.length === 1 ? kept[0] + marker : kept.join(marker)
		})
	}
	const flagged = new Map()
	for (const finding of scanText(out)) flagged.set(finding.line, finding.ruleId)
	if (flagged.size > 0) {
		out = out
			.split('\n')
			.map((line, index) => {
				const ruleId = flagged.get(index + 1)
				if (ruleId === undefined) return line
				count++
				return `[REDACTED LINE: possible ${ruleId}]`
			})
			.join('\n')
	}
	return { text: out, count }
}

// ---------------------------------------------------------------------------
// Prompt cleaning shared by both agents
// ---------------------------------------------------------------------------

// Context the harness injects around what the human typed.
const INJECTED_BLOCKS = [
	/<system-reminder>[\s\S]*?<\/system-reminder>/g,
	/<ide_opened_file>[\s\S]*?<\/ide_opened_file>/g,
	/<ide_selection>[\s\S]*?<\/ide_selection>/g,
	/<in-app-browser-context[\s\S]*?<\/in-app-browser-context>/g,
	/<environment_context>[\s\S]*?<\/environment_context>/g,
	/<codex_internal_context[\s\S]*?<\/codex_internal_context>/g
]

const NON_PROMPT_PREFIXES = [
	'<command-name>',
	'<command-message>',
	'<command-args>',
	'<local-command',
	'<task-notification',
	'<bash-input>',
	'<bash-stdout>',
	'Caveat:',
	'[Request interrupted'
]

/** The human-typed text of a user message, or '' if it is not a real prompt. */
export function cleanPrompt(raw) {
	let text = String(raw ?? '')
	for (const block of INJECTED_BLOCKS) text = text.replace(block, '')
	text = text.trim()
	if (NON_PROMPT_PREFIXES.some((prefix) => text.startsWith(prefix))) return ''
	// Codex wraps attachments around the request: keep only what the user wrote.
	const marker = text.indexOf('## My request:')
	if (text.startsWith('# Files mentioned by the user') && marker !== -1) {
		text = text.slice(marker + '## My request:'.length).trim()
	}
	return text
}

function textOfBlocks(content, types) {
	if (typeof content === 'string') return content
	if (!Array.isArray(content)) return ''
	return content
		.filter((block) => block && types.includes(block.type) && typeof block.text === 'string')
		.map((block) => block.text)
		.join('\n\n')
}

function parseJsonLines(text) {
	const records = []
	for (const line of String(text).split('\n')) {
		if (!line.trim()) continue
		try {
			const parsed = JSON.parse(line)
			if (parsed && typeof parsed === 'object') records.push(parsed)
		} catch {
			// A torn or partial line (the agent is mid-write) is skipped, never fatal.
		}
	}
	return records
}

// ---------------------------------------------------------------------------
// Transcript parsers — a turn is { prompt, response }, each { timestamp, text }
// ---------------------------------------------------------------------------

/** The model a transcript names for a response, if it names a real one. */
const modelOf = (model) =>
	typeof model === 'string' && model.trim() !== '' && model !== '<synthetic>'
		? { model: model.trim() }
		: {}

/**
 * Claude Code transcript (~/.claude/projects/<cwd>/<session>.jsonl). Real shape,
 * verified against the installed version: one JSONL line per content block, the
 * blocks of one API message share `message.id` and `stop_reason`; narration
 * before a tool call carries `stop_reason: "tool_use"`; real prompts are either
 * a string or a list of text blocks (pasted images arrive as a list). When the
 * context fills up, Claude Code writes its summary of the conversation as a
 * `user` entry flagged `isCompactSummary`, often in the middle of a turn: it is
 * not something the human typed, so it is skipped and the answer that follows
 * stays with the prompt that asked for it. Each response keeps the `model` the
 * transcript records for it.
 */
export function parseClaudeTranscript(jsonl) {
	const turns = []
	let responseId = null
	for (const entry of parseJsonLines(jsonl)) {
		if (entry.isSidechain || entry.isMeta || entry.isCompactSummary) continue
		const message = entry.message ?? {}
		if (entry.type === 'user') {
			if (Array.isArray(message.content) && message.content.some((b) => b?.type === 'tool_result'))
				continue
			const text = cleanPrompt(textOfBlocks(message.content, ['text']))
			if (!text) continue
			turns.push({ prompt: { timestamp: entry.timestamp ?? '', text }, response: null })
			responseId = null
		} else if (entry.type === 'assistant' && turns.length > 0) {
			if (message.model === '<synthetic>' || entry.isApiErrorMessage) continue
			const turn = turns[turns.length - 1]
			// Tool activity after text proves the text was narration, whatever its stop reason.
			if (Array.isArray(message.content) && message.content.some((b) => b?.type === 'tool_use')) {
				turn.response = null
				responseId = null
				continue
			}
			if (NON_FINAL_STOP_REASONS.has(message.stop_reason)) continue
			const text = textOfBlocks(message.content, ['text']).trim()
			if (!text) continue
			if (turn.response && message.id && message.id === responseId) {
				turn.response.text += `\n\n${text}`
			} else {
				turn.response = { timestamp: entry.timestamp ?? '', text, ...modelOf(message.model) }
			}
			responseId = message.id ?? null
		}
	}
	return { turns }
}

/**
 * Codex rollout (~/.codex/sessions/**\/rollout-*.jsonl[.zst]). Prompts are the
 * `UserMessage` items (the `response_item` user messages are mostly injected
 * context); the final answer is the assistant message with phase `final_answer`,
 * falling back to `task_complete.last_agent_message`. `commentary` is dropped.
 */
export function parseCodexRollout(jsonl) {
	const records = parseJsonLines(jsonl)
	const turns = []
	let sessionId = null
	let cwd = null
	let weak = null
	let model = {}
	const closeTurn = () => {
		const turn = turns[turns.length - 1]
		if (turn && !turn.response && weak) turn.response = weak
		weak = null
	}
	const hasUserMessages = records.some(
		(r) => r.type === 'event_msg' && r.payload?.item?.type === 'UserMessage'
	)
	for (const record of records) {
		const payload = record.payload ?? {}
		const timestamp = record.timestamp ?? ''
		if (record.type === 'session_meta') {
			sessionId = payload.id ?? payload.session_id ?? sessionId
			cwd = payload.cwd ?? cwd
			continue
		}
		if (record.type === 'turn_context') {
			model = modelOf(payload.model)
			continue
		}
		let prompt = null
		if (record.type === 'event_msg' && payload.type === 'item_completed') {
			if (payload.item?.type === 'UserMessage') {
				prompt = cleanPrompt(textOfBlocks(payload.item.content, ['text', 'input_text']))
			}
		} else if (
			!hasUserMessages &&
			record.type === 'response_item' &&
			payload.type === 'message' &&
			payload.role === 'user'
		) {
			prompt = cleanPrompt(textOfBlocks(payload.content, ['input_text', 'text']))
		}
		if (prompt) {
			closeTurn()
			turns.push({ prompt: { timestamp, text: prompt }, response: null })
			continue
		}
		const turn = turns[turns.length - 1]
		if (!turn) continue
		if (
			record.type === 'response_item' &&
			payload.type === 'message' &&
			payload.role === 'assistant'
		) {
			const text = textOfBlocks(payload.content, ['output_text', 'text']).trim()
			if (!text || payload.phase === 'commentary') continue
			if (payload.phase === 'final_answer') turn.response = { timestamp, text, ...model }
			else weak = { timestamp, text, ...model }
		} else if (record.type === 'event_msg' && payload.type === 'task_complete') {
			const text = String(payload.last_agent_message ?? '').trim()
			if (text && !turn.response) turn.response = { timestamp, text, ...model }
		}
	}
	closeTurn()
	return { turns, sessionId, cwd }
}

/** Read a rollout/transcript from disk; Codex stores rollouts zstd-compressed. */
export function readTranscriptFile(path) {
	const raw = readFileSync(path)
	if (path.endsWith('.zst')) {
		// A named import would stop the whole script loading on a Node without zstd.
		if (typeof zlib.zstdDecompressSync !== 'function') throw new Error('zstd needs Node >= 22.15')
		return zlib.zstdDecompressSync(raw).toString('utf8')
	}
	return raw.toString('utf8')
}

// ---------------------------------------------------------------------------
// The log file format
// ---------------------------------------------------------------------------

const ENTRY_MARKER = /^\[CLAUDE_LOG_ENTRY type=(PROMPT|RESPONSE) num=(\d+) session=(\S+)\]$/

// Body lines that look like an entry marker are escaped so a prompt can neither
// forge an entry nor break the round trip through parseLog().
const escapeBody = (text) => text.replace(/^(\\*)\[CLAUDE_LOG_ENTRY/gm, '$1\\[CLAUDE_LOG_ENTRY')
const unescapeBody = (text) =>
	text.replace(/^(\\+)\[CLAUDE_LOG_ENTRY/gm, (_, s) => `${s.slice(1)}[CLAUDE_LOG_ENTRY`)

/** Turns recovered from a log this script wrote (the Codex hook path appends to it). */
export function parseLog(markdown) {
	const turns = []
	let current = null
	const flush = () => {
		if (!current) return
		const lines = current.lines
		const meta = {}
		while (lines.length > 0 && /^[a-z_]+: /.test(lines[0])) {
			const [key, ...rest] = lines.shift().split(': ')
			meta[key] = rest.join(': ')
		}
		const text = unescapeBody(lines.join('\n').trim())
		const entry = { timestamp: meta.timestamp ?? '', text, ...modelOf(meta.model) }
		if (current.type === 'PROMPT') turns.push({ prompt: entry, response: null })
		else if (turns.length > 0 && !turns[turns.length - 1].response)
			turns[turns.length - 1].response = entry
		else turns.push({ prompt: null, response: entry })
		current = null
	}
	for (const line of markdown.split('\n')) {
		const match = ENTRY_MARKER.exec(line)
		if (match) {
			flush()
			current = { type: match[1], lines: [] }
		} else if (current) current.lines.push(line)
	}
	flush()
	return turns
}

export function readFrontmatter(markdown) {
	const match = /^---\n([\s\S]*?)\n---/.exec(markdown)
	const meta = {}
	if (!match) return meta
	for (const line of match[1].split('\n')) {
		const at = line.indexOf(': ')
		if (at > 0) meta[line.slice(0, at)] = line.slice(at + 2)
	}
	return meta
}

function pasteIndicators(text) {
	const has_code_block = text.includes('```')
	const has_file_paths =
		/[\w\-/]+\.(ts|js|mjs|py|tsx|jsx|json|md|txt|yml|yaml):\d+/.test(text) ||
		/(?:^|[\s(])\/[\w\-/]+\.\w+/m.test(text)
	const has_urls = /https?:\/\//.test(text)
	const is_long = text.length > LONG_PROMPT_CHARS
	const has_stack_trace = /at \w+.*:\d+:\d+/.test(text) || /File ".*", line \d+/.test(text)
	const has_structured_data = /^\s*[{[]/m.test(text) && text.includes('{') && text.includes('}')
	const score = [
		has_code_block,
		has_file_paths,
		has_urls,
		is_long,
		has_stack_trace,
		has_structured_data
	]
	return {
		has_code_block,
		has_file_paths,
		has_urls,
		is_long,
		likely_pasted: score.filter(Boolean).length >= 2 || is_long
	}
}

const minutesBetween = (a, b) => {
	const x = Date.parse(a)
	const y = Date.parse(b)
	return Number.isNaN(x) || Number.isNaN(y) ? null : (y - x) / MS_PER_MINUTE
}

function sessionStats(turns) {
	const prompts = turns.filter((t) => t.prompt).map((t) => t.prompt)
	const responses = turns.filter((t) => t.response).map((t) => t.response)
	if (prompts.length === 0) return {}
	const stats = {
		first_prompt_time: prompts[0].timestamp,
		last_prompt_time: prompts[prompts.length - 1].timestamp
	}
	const duration = minutesBetween(prompts[0].timestamp, prompts[prompts.length - 1].timestamp)
	if (duration !== null) {
		stats.session_duration_minutes = Math.round(duration * 10) / 10
		if (prompts.length > 1)
			stats.avg_time_between_prompts_minutes =
				Math.round((duration / (prompts.length - 1)) * 10) / 10
	}
	const chars = prompts.map((p) => p.text.length)
	const words = prompts.map((p) => p.text.split(/\s+/).filter(Boolean).length)
	const sum = (xs) => xs.reduce((a, b) => a + b, 0)
	stats.total_prompt_chars = sum(chars)
	stats.total_prompt_words = sum(words)
	stats.avg_prompt_length_chars = Math.round((sum(chars) / prompts.length) * 10) / 10
	stats.avg_prompt_length_words = Math.round((sum(words) / prompts.length) * 10) / 10
	stats.longest_prompt_words = Math.max(...words)
	stats.shortest_prompt_words = Math.min(...words)
	if (responses.length > 0) {
		const responseChars = responses.map((r) => r.text.length)
		stats.total_response_chars = sum(responseChars)
		stats.avg_response_length_chars = Math.round((sum(responseChars) / responses.length) * 10) / 10
		if (stats.total_prompt_chars > 0) {
			stats.response_to_prompt_ratio =
				Math.round((stats.total_response_chars / stats.total_prompt_chars) * 100) / 100
		}
	}
	const paste = prompts.map((p) => pasteIndicators(p.text))
	stats.prompts_with_code_blocks = paste.filter((p) => p.has_code_block).length
	stats.prompts_with_file_paths = paste.filter((p) => p.has_file_paths).length
	stats.prompts_with_urls = paste.filter((p) => p.has_urls).length
	stats.prompts_with_long_content = paste.filter((p) => p.is_long).length
	stats.likely_pasted_count = paste.filter((p) => p.likely_pasted).length
	return stats
}

const oneLine = (value) =>
	String(value ?? UNKNOWN)
		.replace(/[\r\n]+/g, ' ')
		.trim() || UNKNOWN

/**
 * Render the log. Pure: redaction happens here, on the text that is about to be
 * persisted, so no caller can forget it. `now` is injected for stable output.
 */
export function renderLog({
	turns,
	sessionId,
	agent,
	project,
	attribution,
	now = new Date(),
	date
}) {
	const clean = (entry) =>
		entry
			? { timestamp: entry.timestamp, text: redact(entry.text).text, ...modelOf(entry.model) }
			: null
	const safeTurns = turns
		.map((turn) => ({ prompt: clean(turn.prompt), response: clean(turn.response) }))
		.filter((turn) => turn.prompt || turn.response)
	const entries = safeTurns
		.flatMap((t) => [t.prompt && ['PROMPT', t.prompt], t.response && ['RESPONSE', t.response]])
		.filter(Boolean)
	// Counted from the markers, not from this pass, so a log grown across hook runs
	// (Codex re-reads its own earlier, already-redacted entries) keeps its total.
	const redactions = entries.reduce(
		(total, [, entry]) => total + (entry.text.match(/\[REDACTED[: ]/g) ?? []).length,
		0
	)
	const lastType = entries.length > 0 ? entries[entries.length - 1][0] : UNKNOWN
	// Every model that answered, in first-use order; `unknown` when no source named one.
	const models = [...new Set(safeTurns.map((t) => t.response?.model).filter(Boolean))]
	const day = date ?? now.toISOString().slice(0, 10)
	const author = oneLine(attribution.author)
	const githubUser = oneLine(attribution.githubUser)
	const head = [
		'---',
		`session_id: ${sessionId}`,
		`agent: ${agent}`,
		`date: ${day}`,
		`author: ${author}`,
		`github_user: ${githubUser}`,
		`git_email: ${oneLine(attribution.email)}`,
		`project: ${oneLine(project)}`,
		`models: ${models.length > 0 ? models.map(oneLine).join(', ') : UNKNOWN}`,
		`session_status: ${lastType === 'RESPONSE' ? 'complete' : 'awaiting_response'}`,
		`last_entry_type: ${lastType === 'RESPONSE' ? 'assistant' : lastType === 'PROMPT' ? 'user' : UNKNOWN}`,
		`total_exchanges: ${safeTurns.filter((t) => t.prompt).length}`,
		`generated_at: ${now.toISOString()}`,
		`redactions: ${redactions}`
	]
	for (const [key, value] of Object.entries(sessionStats(safeTurns))) head.push(`${key}: ${value}`)
	head.push('---', '')
	const lines = [
		...head,
		`# ${agent === 'codex' ? 'Codex' : 'Claude'} Session Log - ${day}`,
		'',
		`Session: \`${sessionId}\` | Project: \`${oneLine(project)}\` | Author: \`${author}\` | GitHub: \`${githubUser}\``,
		'',
		'---',
		''
	]
	let exchange = 0
	for (const [type, entry] of entries) {
		if (type === 'PROMPT') exchange++
		lines.push(`\n[CLAUDE_LOG_ENTRY type=${type} num=${exchange} session=${sessionId}]`)
		lines.push(`timestamp: ${entry.timestamp}`)
		lines.push(`time: ${entry.timestamp ? entry.timestamp.slice(0, 16).replace('T', ' ') : ''}`)
		lines.push(`chars: ${entry.text.length}`)
		if (type === 'PROMPT') {
			const paste = pasteIndicators(entry.text)
			lines.push(`words: ${entry.text.split(/\s+/).filter(Boolean).length}`)
			lines.push(`has_code_block: ${paste.has_code_block}`)
			lines.push(`has_file_paths: ${paste.has_file_paths}`)
			lines.push(`has_urls: ${paste.has_urls}`)
			lines.push(`likely_pasted: ${paste.likely_pasted}`)
		} else {
			lines.push(`model: ${entry.model ? oneLine(entry.model) : UNKNOWN}`)
		}
		lines.push(`\n${escapeBody(entry.text)}\n`)
	}
	return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Attribution
// ---------------------------------------------------------------------------

function defaultExec(command, args, cwd) {
	try {
		const result = spawnSync(command, args, {
			cwd,
			encoding: 'utf8',
			timeout: EXEC_TIMEOUT_MS,
			windowsHide: true
		})
		return result.status === 0 ? result.stdout.trim() : ''
	} catch {
		return ''
	}
}

/**
 * Who submitted the session. Env overrides win; `gh` being missing, logged out
 * or offline yields `unknown`, never an error. A login already recorded in this
 * session's log is reused, so `gh` (a network call) runs once per session.
 */
export function resolveAttribution({ cwd, env = process.env, exec = defaultExec, previous = {} }) {
	const author = env.CLAUDE_AUTHOR || exec('git', ['config', 'user.name'], cwd) || UNKNOWN
	const email = exec('git', ['config', 'user.email'], cwd) || UNKNOWN
	const remembered =
		previous.github_user && previous.github_user !== UNKNOWN ? previous.github_user : ''
	const githubUser =
		env.GITHUB_USER ||
		remembered ||
		exec('git', ['config', 'github.user'], cwd) ||
		exec('gh', ['api', 'user', '--jq', '.login'], cwd) ||
		UNKNOWN
	return { author, email, githubUser }
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

/** Nearest ancestor holding `.git`, so a session started in a subfolder still logs to the repo root. */
export function findProjectRoot({ cwd, projectDir }) {
	if (projectDir && existsSync(projectDir)) return resolve(projectDir)
	let dir = resolve(cwd)
	for (;;) {
		if (existsSync(join(dir, '.git'))) return dir
		const parent = dirname(dir)
		if (parent === dir) return resolve(cwd)
		dir = parent
	}
}

const safeId = (id) =>
	String(id)
		.replace(/[^A-Za-z0-9._-]/g, '_')
		.slice(0, MAX_SESSION_ID_LENGTH)

/** Claude Code keys its project folder by the cwd with every non-alphanumeric turned into `-`. */
export function claudeTranscriptCandidates({ cwd, sessionId, home = homedir() }) {
	const folder = resolve(cwd).replace(/[^A-Za-z0-9]/g, '-')
	return [join(home, '.claude', 'projects', folder, `${sessionId}.jsonl`)]
}

function stamp(iso) {
	const parsed = new Date(iso)
	const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed
	return date.toISOString().slice(0, 19).replace('T', '_').replaceAll(':', '-')
}

/**
 * Handle one hook invocation (or a manual backfill) and write the log.
 * @param {{ agent: 'claude'|'codex', payload?: object, transcriptPath?: string, cwd?: string, env?: object, exec?: Function, now?: Date, home?: string }} options
 * @returns {string|null} the log path, or null when there was nothing to log
 */
export function logSession({
	agent,
	payload = {},
	transcriptPath,
	cwd,
	env = process.env,
	exec,
	now = new Date(),
	home
}) {
	const event = payload.hook_event_name ?? ''
	const sessionCwd = cwd ?? payload.cwd ?? process.cwd()
	// CLAUDE_PROJECT_DIR is only meaningful to Claude Code: a Codex started from a
	// Claude Code terminal inherits it for a different project.
	const root = findProjectRoot({
		cwd: sessionCwd,
		projectDir: agent === 'claude' ? env.CLAUDE_PROJECT_DIR : undefined
	})
	let sessionId = payload.session_id ?? null
	let turns = []

	// Claude Code's transcript is its own record, read from the path the hook is
	// handed. Codex hooks use their payloads (its rollout format is explicitly not a
	// stable interface); a rollout is only read when asked for with --transcript.
	let source = transcriptPath ?? (agent === 'claude' ? payload.transcript_path : null)
	let fromTranscript = null
	if (!source && agent === 'claude' && sessionId) {
		source = claudeTranscriptCandidates({
			cwd: sessionCwd,
			sessionId: safeId(sessionId),
			home
		}).find((candidate) => existsSync(candidate))
	}
	if (source && existsSync(source)) {
		try {
			const text = readTranscriptFile(source)
			fromTranscript = agent === 'codex' ? parseCodexRollout(text) : parseClaudeTranscript(text)
			sessionId ??= fromTranscript.sessionId ?? basename(source).replace(/\.jsonl(\.zst)?$/, '')
		} catch {
			fromTranscript = null
		}
	}
	if (!sessionId) return null
	sessionId = safeId(sessionId)

	const outDir = join(root, LOG_DIR)
	const existing = existsSync(outDir)
		? readdirSync(outDir)
				.filter((name) => name.endsWith(`_${sessionId}.md`))
				.sort()[0]
		: undefined
	const previousText = existing ? readFileSync(join(outDir, existing), 'utf8') : ''

	// Codex without --transcript: grow the log we already wrote from hook payloads.
	turns = fromTranscript ? fromTranscript.turns : agent === 'codex' ? parseLog(previousText) : []
	applyPayload({ turns, payload, event, agent, now })
	if (turns.length === 0) return null
	const outPath = join(
		outDir,
		existing ??
			`${stamp(turns.find((t) => t.prompt)?.prompt.timestamp || now.toISOString())}_${sessionId}.md`
	)

	const previous = readFrontmatter(previousText)
	const attribution = resolveAttribution({ cwd: root, env, exec, previous })
	const markdown = renderLog({
		turns,
		sessionId,
		agent,
		project: basename(root),
		attribution,
		now,
		date: previous.date
	})
	mkdirSync(outDir, { recursive: true })
	const tmp = `${outPath}.${process.pid}.tmp`
	writeFileSync(tmp, markdown)
	renameSync(tmp, outPath)
	return outPath
}

// The transcript can lag the hook (the prompt or final answer is not flushed
// yet), and Codex has no transcript here at all, so the payload is authoritative
// for the event that just happened.
function applyPayload({ turns, payload, event, agent, now }) {
	const at = now.toISOString()
	const last = turns[turns.length - 1]
	if (event === 'UserPromptSubmit' && typeof payload.prompt === 'string') {
		const text = cleanPrompt(payload.prompt)
		// Same text as an unanswered last prompt is the same event seen twice; the same
		// text after an answer ("continue") is a new turn.
		const isRepeatDelivery = last?.prompt?.text === text && !last.response
		if (text && !isRepeatDelivery) turns.push({ prompt: { timestamp: at, text }, response: null })
	} else if (event === 'Stop' && typeof payload.last_assistant_message === 'string') {
		const text = payload.last_assistant_message.trim()
		if (!text) return
		if (!last) turns.push({ prompt: null, response: { timestamp: at, text } })
		// Claude's transcript already holds the full answer; only fill a gap. A Codex
		// turn can stop more than once (a Stop hook may continue it): the latest wins.
		else if (!last.response || (agent === 'codex' && last.response.text !== text)) {
			last.response = { timestamp: at, text }
		}
	}
}

function readStdin() {
	try {
		const raw = readFileSync(0, 'utf8').trim()
		return raw ? JSON.parse(raw) : {}
	} catch {
		return {}
	}
}

function main() {
	const [agent, ...rest] = process.argv.slice(2)
	if (agent !== 'claude' && agent !== 'codex') {
		console.error(
			'Usage: session-log.mjs claude|codex [--transcript <file>] [--session-id <id>] [--cwd <dir>]'
		)
		return
	}
	const flag = (name) => {
		const at = rest.indexOf(`--${name}`)
		return at === -1 ? undefined : rest[at + 1]
	}
	const manual = flag('transcript')
	const payload = manual ? { session_id: flag('session-id') } : readStdin()
	try {
		const path = logSession({ agent, payload, transcriptPath: manual, cwd: flag('cwd') })
		if (manual) console.error(path ? `session-log: wrote ${path}` : 'session-log: nothing to log')
	} catch (error) {
		console.error(`session-log: skipped (${error instanceof Error ? error.message : error})`)
	}
	// Codex requires JSON on stdout for Stop; `{}` means "no objection".
	if (!manual && agent === 'codex' && payload.hook_event_name === 'Stop') process.stdout.write('{}')
}

if (process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main()
}
