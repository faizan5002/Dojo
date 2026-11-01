// What can be counted in one prompt without a model: the "free metrics" of
// the product spec. The paste heuristic matches scripts/session-log.mjs, so a
// log's own frontmatter and these numbers agree.

const LONG_PROMPT_CHARS = 500
const PASTE_SIGNALS_REQUIRED = 2

const FENCE_LINE = /^\s*```/gm
const URL = /https?:\/\/[^\s<>()"'`]+/g
const STACK_TRACE = [/at \w+.*:\d+:\d+/, /File ".*", line \d+/]
const STRUCTURED_DATA_LINE = /^\s*[{[]/m
// Capture group 1 is the path; a trailing `:line` is dropped so `a.ts` and
// `a.ts:12` count once.
const PATH_PATTERNS = [
	/(?:^|[\s(`'"])(\/?(?:[\w.-]+\/)+[\w.-]+\.[A-Za-z]\w*)/gm,
	/(?:^|[\s(`'"])([A-Za-z]:\\(?:[\w.-]+\\)*[\w.-]+\.[A-Za-z]\w*)/gm,
	/(?:^|[\s(`'"])([\w.-]+\.(?:ts|tsx|js|jsx|mjs|py|json|md|txt|yml|yaml)):\d+/gm
]

export interface PromptFeatures {
	readonly chars: number
	readonly words: number
	readonly codeBlocks: number
	readonly filePaths: number
	readonly urls: number
	readonly isLikelyPasted: boolean
}

function countFilePaths(text: string): number {
	const paths = new Set<string>()
	for (const pattern of PATH_PATTERNS) {
		for (const match of text.matchAll(pattern)) {
			if (match[1] != null) paths.add(match[1])
		}
	}
	return paths.size
}

export function promptFeatures(text: string): PromptFeatures {
	const fences = text.match(FENCE_LINE)?.length ?? 0
	const urls = text.match(URL)?.length ?? 0
	const filePaths = countFilePaths(text)
	const isLong = text.length > LONG_PROMPT_CHARS
	const signals = [
		fences > 0,
		filePaths > 0,
		urls > 0,
		isLong,
		STACK_TRACE.some((pattern) => pattern.test(text)),
		STRUCTURED_DATA_LINE.test(text) && text.includes('{') && text.includes('}')
	]
	return {
		chars: text.length,
		words: text.split(/\s+/).filter(Boolean).length,
		// An unclosed fence still opened a block.
		codeBlocks: Math.ceil(fences / 2),
		filePaths,
		urls,
		isLikelyPasted: isLong || signals.filter(Boolean).length >= PASTE_SIGNALS_REQUIRED
	}
}
