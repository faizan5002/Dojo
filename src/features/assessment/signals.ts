// Wording patterns the skill evaluators read, and the helpers that turn a match
// into a quotable span. These are rules, not understanding: each pattern stands
// for one observable behaviour in the rubric, and every credit or opportunity
// is recorded with the exact text that triggered it so a person can judge it.

export interface Span {
	readonly start: number
	readonly end: number
}

const MAX_EXCERPT_CHARS = 180
const EXCERPT_LEAD_CHARS = 60
const MAX_BASE_CHARS = 140

/** `!`, `?` or a line break; a `.` only before whitespace, so `a.tsx` is not a sentence end. */
function isSentenceEnd(text: string, at: number): boolean {
	const char = text[at] ?? ''
	if (char === '.') return at + 1 >= text.length || /\s/.test(text[at + 1] ?? '')
	return /[!?\n]/.test(char)
}

/** Whether a quote of `span` starts or ends partway through its sentence. */
export function clippedEdges(text: string, span: Span): { before: boolean; after: boolean } {
	const lead = text.slice(0, span.start)
	return {
		before: span.start > 0 && !/(?:^|[.!?\n])\s*$/.test(lead),
		after: span.end < text.length && !isSentenceEnd(text, span.end - 1) && text[span.end] !== '\n'
	}
}

const TASK_VERBS =
	'add|build|create|implement|fix|change|update|remove|delete|rename|refactor|move|write|make|run|install|set ?up|configure|deploy|push|pull|commit|merge|test|debug|investigate|check|review|audit|explain|show|give|find|list|replace|migrate|integrate|design|develop|generate|convert|optimi[sz]e|improve|clean ?up|document|start|stop|open|read|analy[sz]e|plan|draft|summari[sz]e|compare|verify|restyle|redesign|connect|wire|style|match|stage|publish|upload|propose|suggest|outline|describe|tell|rewrite|overhaul'
const IMPLEMENTATION_VERBS =
	'add|build|create|implement|fix|change|update|remove|delete|rename|refactor|move|write|make|replace|migrate|integrate|develop|redesign|restyle|wire|connect|convert|generate|set ?up|install|configure|style|match|rewrite|overhaul'
const LEAD_IN =
	"(?:^|[.!?,;:\\n]\\s*|\\b(?:please|pls|now|then|also|just|and|so)\\s+|\\b(?:can|could|would|will) you\\s+|\\bi (?:want|need|would like) (?:you )?to\\s+|\\blet'?s\\s+)"

export const TASK_REQUEST = new RegExp(`${LEAD_IN}(${TASK_VERBS})\\b`, 'i')
export const IMPLEMENTATION_REQUEST = new RegExp(`${LEAD_IN}(${IMPLEMENTATION_VERBS})\\b`, 'i')
const SUBSTANTIAL_WORK =
	/\b(build|implement|develop|design|redesign|refactor|migrate|integrate|rewrite|set ?up|create (?:a|an|the) (?:new )?\w+|add (?:a |an |the )?(?:new )?(?:feature|page|endpoint|component|system|module|dashboard|flow|route))\b/i
const SUBSTANTIAL_WORDS = 40

export const APPROVAL =
	/^\W*(?:yes|yeah|yep|ok|okay|sure|go ahead|proceed|continue|do it|done|thanks|thank you|lgtm|looks good|great|perfect|approved?|confirm(?:ed)?|please do|go|y)\b/i
const APPROVAL_MAX_WORDS = 6
const QUESTION_START =
	/^\W*(?:what|why|how|when|where|which|who|can|could|does|do|did|is|are|should|will|would)\b/i
export const FEEDBACK =
	/\b(?:still|again|didn'?t|doesn'?t|does not|not working|isn'?t|wrong|error|failed|fails|failing|broken|bug|stuck|same (?:issue|problem|error)|nothing happen\w*|it shows|i see|i got|i'?m getting|getting)\b/i

// Concrete anchors: something the agent can find rather than guess.
const CONTEXT_PATTERNS: readonly RegExp[] = [
	/```/,
	/`[^`\n]+`/,
	/(?:^|[\s(`'"])(?:\.{0,2}\/)?(?:[\w.-]+[/\\])+[\w.-]+\.[A-Za-z]\w{0,5}\b/,
	/(?:^|[\s(`'"])(?:[\w.[\]()-]+\/){2,}[\w.-]*/,
	/\b[\w-]+\.(?:tsx?|jsx?|mjs|cjs|py|json|md|css|html|ya?ml|toml|sql|prisma|sh|go|rs|java|rb)\b/,
	/(?:^|\s)\.[a-z][\w-]+/,
	/(?:^|\s)\/[a-z][\w-]*(?:\/[\w-]+)*/,
	/\b[a-z]+[A-Z][A-Za-z0-9]*\b/,
	/\b[A-Z][a-z]+[A-Z]\w*\b/,
	/\b[a-z0-9]+_[a-z0-9_]+\b/,
	/https?:\/\/\S+/,
	/\b(?:error|exception|traceback|stack trace|exit code|status \d{3}|ENOENT|EPERM|TypeError|SyntaxError|ReferenceError)\b/i,
	/"[^"\n]{3,80}"|“[^”\n]{3,80}”/
]
// The subset that names a place in the code: what scope control credits.
const TARGET_PATTERNS: readonly RegExp[] = CONTEXT_PATTERNS.slice(1, 10)

export const CONSTRAINT =
	/\b(?:don'?t|do not|never|without|only|must|keep|avoid|no need|nothing else|unchanged|instead of|rather than|limit(?:ed)? to|at most|no more than|exactly)\b/i
export const DONE =
	/\b(?:should|so that|expected|expect|acceptance|done when|definition of done|results? in|returns?|until|make sure|ensure|the goal|success(?:ful)? when|output)\b/i
export const BOUNDARY =
	/\b(?:only|just (?:the|this)|don'?t (?:touch|change|modify|edit)|do not (?:touch|change|modify|edit)|without changing|leave [\w\s]{1,30} alone|nothing else|unchanged|limit(?:ed)? to|scope)\b/i
export const BROAD =
	/\b(?:everything|entire|whole (?:app|codebase|project|repo|thing|site)|all (?:the )?(?:files|code|pages|features)|complete(?:ly)? (?:rewrite|redesign|overhaul)|from scratch|rewrite|overhaul|full(?:y)? (?:app|application|system|platform))\b/i
export const PLAN_REQUEST =
	/\b(?:plan|planning|approach|strategy|options|trade-?offs?|outline|propose|proposal|roadmap|before (?:you )?(?:start|implement|cod|chang|writ)\w*|don'?t (?:implement|code|change|write|start)|do not (?:implement|code|change|modify|write)|read-?only|audit|analy[sz]e|investigate|think through|walk me through|what would you)\b/i
export const EDGE_CASES =
	/\b(?:edge cases?|corner cases?|what if|what happens (?:if|when)|malformed|invalid|empty state|null|undefined|timeouts?|race conditions?|duplicates?|failure cases?|error states?)\b/i
const LIST_LINE = /^\s*(?:[-*•]|\d+[.)])\s+\S/gm
const MIN_LIST_LINES = 3
export const VERIFY_REQUEST =
	/\b(?:tests?|unit tests?|e2e|verify|validate|check (?:that|it|if|whether)|make sure|ensure|run (?:the )?(?:tests?|lint|build|typecheck|checks?)|prove|confirm|screenshot)\b/i
export const CHALLENGE =
	/\b(?:are you sure|how do you know|did you (?:test|run|check|verify)|show me|evidence|why did you|double[- ]check|is that (?:right|true|correct))\b/i
export const OBSERVED =
	/\b(?:i (?:tried|ran|tested|checked|clicked|opened|see|saw|get|got)|it (?:shows|says|prints|returns|throws|crashes|fails)|the output|console (?:says|shows)|logs? (?:show|say))\b/i
export const EXPECTATION =
	/\b(?:expected|should(?:n'?t)? (?:be|have|show|return|work|route|open|go)|instead|rather than|but (?:it|i|got|the)|actual)\b/i
export const REFINEMENT =
	/^\W*(?:actually|instead|no[,.]|not quite|almost|close[,.])|\b(?:instead of|rather than|change (?:it|that|this) to)\b/i
const VAGUE_REFERENCE =
	/^\W*(?:please\s+)?(?:fix|do|change|update|make|check|try|redo|handle)\s+(?:it|this|that|them|these|those)\b/i
const VAGUE_MAX_WORDS = 8
const VAGUE_FEEDBACK_MAX_WORDS = 12

export const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length

export function isApproval(text: string): boolean {
	return APPROVAL.test(text) && wordCount(text) <= APPROVAL_MAX_WORDS
}

export function isQuestion(text: string): boolean {
	return text.trim().endsWith('?') || QUESTION_START.test(text)
}

export function isSubstantial(text: string): boolean {
	return SUBSTANTIAL_WORK.test(text) || wordCount(text) > SUBSTANTIAL_WORDS
}

export function hasList(text: string): boolean {
	return (text.match(LIST_LINE)?.length ?? 0) >= MIN_LIST_LINES
}

export function isVagueReference(text: string): boolean {
	return VAGUE_REFERENCE.test(text) && wordCount(text) <= VAGUE_MAX_WORDS
}

export function isShortFeedback(text: string): boolean {
	return wordCount(text) <= VAGUE_FEEDBACK_MAX_WORDS
}

/** Where `pattern` first matches, as an index into `text`. */
function matchAt(text: string, pattern: RegExp): { index: number; length: number } | null {
	const match = pattern.exec(text)
	if (match == null) return null
	// A pattern's leading boundary (start, space, punctuation) is not the quote.
	const group = match[1]
	const offset = group != null ? match[0].lastIndexOf(group) : 0
	return { index: match.index + Math.max(offset, 0), length: (group ?? match[0]).length }
}

/** The sentence around `index`, trimmed and capped so a quote stays readable. */
export function sentenceSpan(text: string, index: number, length = 0): Span {
	let start = index
	while (start > 0 && !isSentenceEnd(text, start - 1)) start--
	let end = index + length
	while (end < text.length && !isSentenceEnd(text, end)) end++
	if (end < text.length && text[end] !== '\n') end++
	if (end - start > MAX_EXCERPT_CHARS) {
		const sentenceStart = start
		const sentenceEnd = end
		start = Math.max(start, index - EXCERPT_LEAD_CHARS)
		end = Math.min(end, start + MAX_EXCERPT_CHARS)
		// A clipped edge falls on a word boundary, never inside a word.
		if (start > sentenceStart) start = text.indexOf(' ', start) + 1 || start
		if (end < sentenceEnd) end = Math.max(text.lastIndexOf(' ', end), start)
	}
	while (start < end && /\s/.test(text[start] ?? '')) start++
	while (end > start && /\s/.test(text[end - 1] ?? '')) end--
	return { start, end }
}

/** The span of the first match of any pattern, or null. */
export function find(text: string, patterns: RegExp | readonly RegExp[]): Span | null {
	for (const pattern of Array.isArray(patterns) ? patterns : [patterns]) {
		const at = matchAt(text, pattern)
		if (at != null) return sentenceSpan(text, at.index, at.length)
	}
	return null
}

export const findContext = (text: string) => find(text, CONTEXT_PATTERNS)
export const findTargets = (text: string) => find(text, TARGET_PATTERNS)

/** The opening sentence, which a suggested rewrite quotes. */
export function openingSpan(text: string): Span {
	const span = sentenceSpan(text, 0)
	return span.end - span.start > MAX_BASE_CHARS
		? { start: span.start, end: span.start + MAX_BASE_CHARS }
		: span
}

const SENTENCE_IMPERATIVE = new RegExp(
	`^\\W*(?:(?:please|pls|now|then|also|just|and|so)\\s+)?(?:(?:can|could|would|will) you\\s+)?(?:${TASK_VERBS})\\b`,
	'i'
)

/** Sentences or lines that each open with their own instruction. */
export function countImperatives(text: string): number {
	return text.split(/[.!?\n]+/).filter((sentence) => SENTENCE_IMPERATIVE.test(sentence)).length
}

/** Word-set overlap, 0–1: how far two prompts say the same thing. */
export function similarity(a: string, b: string): number {
	const words = (text: string) => new Set(text.toLowerCase().match(/[a-z0-9']+/g) ?? [])
	const left = words(a)
	const right = words(b)
	if (left.size === 0 || right.size === 0) return 0
	const shared = [...left].filter((word) => right.has(word)).length
	return shared / (left.size + right.size - shared)
}
