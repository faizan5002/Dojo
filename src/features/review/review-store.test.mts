import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	EMPTY_REVIEW,
	clearReviewMemory,
	readReviewState,
	writeReviewState,
	addNote,
	markReviewed,
	parseReviewState,
	setActive,
	setRailCollapsed,
	storageKey
} from './review-store'

const at = (minute: number) => new Date(Date.UTC(2026, 10, 3, 10, minute))

describe('review marks', () => {
	it('start with nothing reviewed', () => {
		assert.deepEqual(EMPTY_REVIEW.reviewed, {})
	})

	it('are set only by marking, never by selecting a finding', () => {
		const selected = setActive(EMPTY_REVIEW, 'iteration-3')
		assert.equal(selected.active, 'iteration-3')
		assert.deepEqual(selected.reviewed, {})
	})

	it('record when a finding was reviewed, and keep the first time if it is marked again', () => {
		const first = markReviewed(EMPTY_REVIEW, 'iteration-3', at(1))
		assert.equal(first.reviewed['iteration-3'], at(1).toISOString())
		const again = markReviewed(first, 'iteration-3', at(30))
		assert.equal(again, first)
		assert.equal(again.reviewed['iteration-3'], at(1).toISOString())
	})

	it('survive reopening: selecting or collapsing never clears them', () => {
		const reviewed = markReviewed(EMPTY_REVIEW, 'planning-2', at(1))
		const reopened = setRailCollapsed(setActive(reviewed, 'planning-2'), true)
		assert.equal(reopened.reviewed['planning-2'], at(1).toISOString())
	})
})

describe('notes', () => {
	it('are added with a timestamp, trimmed, in order', () => {
		let state = addNote(EMPTY_REVIEW, { id: 'a', text: '  first  ', findingId: null, now: at(1) })
		state = addNote(state, { id: 'b', text: 'second', findingId: 'iteration-3', now: at(2) })
		assert.deepEqual(
			state.notes.map((note) => [note.id, note.text, note.at, note.findingId]),
			[
				['a', 'first', at(1).toISOString(), null],
				['b', 'second', at(2).toISOString(), 'iteration-3']
			]
		)
	})

	it('ignore an empty note', () => {
		assert.equal(
			addNote(EMPTY_REVIEW, { id: 'a', text: '   ', findingId: null, now: at(1) }),
			EMPTY_REVIEW
		)
	})

	it('are capped, so storage cannot grow without limit', () => {
		let state = EMPTY_REVIEW
		for (let index = 0; index < 250; index++) {
			state = addNote(state, { id: String(index), text: 'x', findingId: null, now: at(1) })
		}
		assert.equal(state.notes.length, 200)
	})

	it('do not change what is reviewed', () => {
		const reviewed = markReviewed(EMPTY_REVIEW, 'a-1', at(1))
		const noted = addNote(reviewed, { id: 'n', text: 'hello', findingId: null, now: at(2) })
		assert.deepEqual(noted.reviewed, reviewed.reviewed)
	})
})

describe('the rail', () => {
	it('remembers whether it is collapsed, and which finding was selected', () => {
		const state = setRailCollapsed(setActive(EMPTY_REVIEW, 'scope-2'), true)
		const restored = parseReviewState(JSON.stringify(state))
		assert.equal(restored.railCollapsed, true)
		assert.equal(restored.active, 'scope-2')
	})
})

describe('stored state', () => {
	it('falls back to empty for anything that is not valid', () => {
		assert.equal(parseReviewState(null), EMPTY_REVIEW)
		assert.equal(parseReviewState('not json'), EMPTY_REVIEW)
		assert.equal(parseReviewState(JSON.stringify({ v: 2 })), EMPTY_REVIEW)
		assert.equal(
			parseReviewState(
				JSON.stringify({ ...EMPTY_REVIEW, notes: [{ id: 'x', at: 'now', text: '' }] })
			),
			EMPTY_REVIEW
		)
	})

	it('is kept apart per user, per assessment and for the sample', () => {
		const keys = new Set([
			storageKey('sample'),
			storageKey('u:alice:a:1'),
			storageKey('u:bob:a:1'),
			storageKey('u:alice:a:2')
		])
		assert.equal(keys.size, 4)
		assert.ok(storageKey('sample').endsWith(':sample'))
	})
})

describe('memory kept by this tab', () => {
	// Under `node --test` there is no browser storage, so state lives only in memory: exactly
	// the case that must not outlive a sign-out.
	it('is forgotten on sign-out, and a different scope never sees another scope', () => {
		const alice = markReviewed(EMPTY_REVIEW, 'iteration-3', at(1))
		writeReviewState('u:alice:a:1', alice)
		assert.equal(readReviewState('u:alice:a:1').reviewed['iteration-3'], at(1).toISOString())
		assert.deepEqual(readReviewState('u:bob:a:1'), EMPTY_REVIEW)
		clearReviewMemory()
		assert.deepEqual(readReviewState('u:alice:a:1'), EMPTY_REVIEW)
	})

	it('keeps the sample apart from an account scope', () => {
		writeReviewState(
			'sample',
			addNote(EMPTY_REVIEW, { id: 's', text: 'sample note', findingId: null, now: at(1) })
		)
		assert.equal(readReviewState('u:alice:a:1').notes.length, 0)
		assert.equal(readReviewState('sample').notes.length, 1)
		clearReviewMemory()
	})
})
