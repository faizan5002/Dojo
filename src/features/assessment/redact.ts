// Credential shapes removed from prompt text before it is scored or quoted
// (product spec: "secret redaction before anything is stored or scored"). The
// repo's logger already redacts what it writes; this pass also covers logs from
// other writers, and hand-edited ones. It mirrors the span rules in
// scripts/session-log.mjs, which runs under Node and cannot be imported here.
// Like that one, it is a backstop for credential shapes, not for private
// names, paths or code.

const REFERENCE_VALUE = /^(\$|%|<|\{\{)|process\.env|import\.meta|os\.environ|getenv|\[REDACTED/i
const MIN_ASSIGNED_SECRET_LENGTH = 20

interface Rule {
	readonly id: string
	readonly regex: RegExp
	/** Capture groups kept around the marker, in order. */
	readonly keep?: readonly number[]
	/** The capture group holding the value, checked before redacting. */
	readonly guard?: number
	readonly accept?: (value: string) => boolean
}

const RULES: readonly Rule[] = [
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
	{ id: 'url-password', regex: /(\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:)([^\s/@]+)(@)/g, keep: [1, 3] },
	{
		id: 'auth-header',
		regex: /\b((?:Bearer|Basic)\s+)([A-Za-z0-9._~+/=-]{16,})/g,
		keep: [1],
		guard: 2
	},
	{
		id: 'credential-assignment',
		regex:
			/(\b[A-Za-z_][A-Za-z0-9_.-]{0,59}(?:key|token|secret|password|passwd|pwd|credential|authorization)[A-Za-z0-9_.-]{0,59}["']?\s*[:=]\s*["'`]?)([A-Za-z0-9._+/=~-]{8,})/gi,
		keep: [1],
		guard: 2,
		accept: (value) => /\d/.test(value) || value.length >= MIN_ASSIGNED_SECRET_LENGTH
	}
]

export function redactSecrets(text: string): { text: string; count: number } {
	let count = 0
	let out = text
	for (const rule of RULES) {
		out = out.replace(rule.regex, (...args: unknown[]) => {
			// The match and its groups come first; the offset is the first number after them.
			const groups = args.slice(
				0,
				args.findIndex((arg) => typeof arg === 'number')
			)
			const at = (index: number) => {
				const group = groups[index]
				return typeof group === 'string' ? group : ''
			}
			if (rule.guard != null) {
				const value = at(rule.guard)
				if (REFERENCE_VALUE.test(value) || (rule.accept != null && !rule.accept(value))) {
					return at(0)
				}
			}
			count++
			const marker = `[REDACTED:${rule.id}]`
			if (rule.keep == null) return marker
			const kept = rule.keep.map(at)
			return kept.length === 1 ? `${kept[0]}${marker}` : kept.join(marker)
		})
	}
	return { text: out, count }
}
