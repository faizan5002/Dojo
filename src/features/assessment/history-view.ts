import { PROFICIENCY_BANDS, type Proficiency } from './rubric'

// Search, filter and sort for the assessment history list. Pure, so the list's
// behaviour is testable without a browser.

export const SORT_KEYS = ['newest', 'oldest', 'highest', 'lowest'] as const
export type SortKey = (typeof SORT_KEYS)[number]
export type LevelFilter = Proficiency | 'all' | 'unscored'

export interface HistoryItem {
	readonly id: string
	readonly createdAt: Date
	readonly overallScore: number | null
	readonly rubricVersion: string
}

function levelOf(score: number | null): Proficiency | 'unscored' {
	if (score == null) return 'unscored'
	return PROFICIENCY_BANDS.find((band) => score >= band.min)?.level ?? 'needsImprovement'
}

/** Matches the text a row shows: its date, score and rubric version, or its id. */
export function matchesQuery(item: HistoryItem, query: string, dateText: string): boolean {
	const needle = query.trim().toLowerCase()
	if (needle === '') return true
	return [dateText, String(item.overallScore ?? ''), item.rubricVersion, item.id].some((part) =>
		part.toLowerCase().includes(needle)
	)
}

function compare(sort: SortKey, a: HistoryItem, b: HistoryItem): number {
	const byDate = b.createdAt.getTime() - a.createdAt.getTime()
	if (sort === 'newest') return byDate
	if (sort === 'oldest') return -byDate
	// Unscored runs go last in both score orders, then newest first.
	const scoreA = a.overallScore ?? Number.NEGATIVE_INFINITY
	const scoreB = b.overallScore ?? Number.NEGATIVE_INFINITY
	if (scoreA === scoreB) return byDate
	if (a.overallScore == null) return 1
	if (b.overallScore == null) return -1
	return sort === 'highest' ? scoreB - scoreA : scoreA - scoreB
}

export function visibleHistory<T extends HistoryItem>({
	items,
	query,
	level,
	sort,
	dateText
}: {
	items: readonly T[]
	query: string
	level: LevelFilter
	sort: SortKey
	dateText: (item: T) => string
}): T[] {
	return items
		.filter((item) => level === 'all' || levelOf(item.overallScore) === level)
		.filter((item) => matchesQuery(item, query, dateText(item)))
		.toSorted((a, b) => compare(sort, a, b))
}
