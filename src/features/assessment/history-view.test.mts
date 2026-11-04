import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { visibleHistory, type HistoryItem, type LevelFilter, type SortKey } from './history-view'

const item = (id: string, day: number, score: number | null): HistoryItem => ({
	id,
	createdAt: new Date(Date.UTC(2026, 9, day)),
	overallScore: score,
	rubricVersion: 'rules-1.0'
})

const ITEMS = [item('a', 10, 85), item('b', 20, 45), item('c', 15, null), item('d', 25, 62)]
const dateText = (entry: HistoryItem) => `Oct ${entry.createdAt.getUTCDate()}, 2026`

const view = (options: { query?: string; level?: LevelFilter; sort?: SortKey }) =>
	visibleHistory({
		items: ITEMS,
		query: options.query ?? '',
		level: options.level ?? 'all',
		sort: options.sort ?? 'newest',
		dateText
	}).map((entry) => entry.id)

describe('assessment history view', () => {
	test('sorts by date either way', () => {
		assert.deepEqual(view({ sort: 'newest' }), ['d', 'b', 'c', 'a'])
		assert.deepEqual(view({ sort: 'oldest' }), ['a', 'c', 'b', 'd'])
	})

	test('sorts by score with unscored runs last in both directions', () => {
		assert.deepEqual(view({ sort: 'highest' }), ['a', 'd', 'b', 'c'])
		assert.deepEqual(view({ sort: 'lowest' }), ['b', 'd', 'a', 'c'])
	})

	test('filters by proficiency level, and by no score', () => {
		assert.deepEqual(view({ level: 'strong' }), ['a'])
		assert.deepEqual(view({ level: 'proficient' }), ['d'])
		assert.deepEqual(view({ level: 'developing' }), ['b'])
		assert.deepEqual(view({ level: 'needsImprovement' }), [])
		assert.deepEqual(view({ level: 'unscored' }), ['c'])
	})

	test('searches the date, score, rubric version and id, ignoring case and spaces', () => {
		assert.deepEqual(view({ query: ' oct 20' }), ['b'])
		assert.deepEqual(view({ query: '62' }), ['d'])
		assert.deepEqual(view({ query: 'RULES-1' }), ['d', 'b', 'c', 'a'])
		assert.deepEqual(view({ query: 'OCT' }), ['d', 'b', 'c', 'a'])
		assert.deepEqual(view({ query: 'nothing matches this' }), [])
	})

	test('combines filter, search and sort, and never mutates its input', () => {
		const before = ITEMS.map((entry) => entry.id)
		assert.deepEqual(view({ level: 'proficient', query: '62', sort: 'oldest' }), ['d'])
		assert.deepEqual(
			ITEMS.map((entry) => entry.id),
			before
		)
	})
})
