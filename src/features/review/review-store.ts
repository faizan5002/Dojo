import { useCallback, useSyncExternalStore } from 'react'
import { z } from 'zod'

// What a person does while reviewing: which findings they have marked reviewed,
// their notes, whether the findings rail is open and which finding is selected.
//
// This is stored in the browser only (localStorage), under a key that names the
// scope: `sample` for the public sample, or the signed-in user's id plus the
// assessment. Nothing is sent to a server, so it is not durable across browsers or
// devices, and the sample's notes can never reach an account. The UI says so.

const MAX_NOTES = 200
const MAX_NOTE_CHARS = 2000

const noteSchema = z.object({
	id: z.string().min(1).max(64),
	at: z.string().max(40),
	text: z.string().min(1).max(MAX_NOTE_CHARS),
	findingId: z.string().max(64).nullable()
})

export const reviewStateSchema = z.object({
	v: z.literal(1),
	/** Finding id to the time it was marked reviewed. */
	reviewed: z.record(z.string(), z.string()),
	notes: z.array(noteSchema).max(MAX_NOTES),
	railCollapsed: z.boolean(),
	active: z.string().max(64).nullable()
})
export type ReviewState = z.infer<typeof reviewStateSchema>
export type ReviewNote = z.infer<typeof noteSchema>

export const EMPTY_REVIEW: ReviewState = {
	v: 1,
	reviewed: {},
	notes: [],
	railCollapsed: false,
	active: null
}

const KEY_PREFIX = 'dojo:review:v1:'
export const storageKey = (scope: string) => `${KEY_PREFIX}${scope}`

export function parseReviewState(raw: string | null): ReviewState {
	if (raw == null) return EMPTY_REVIEW
	try {
		const parsed = reviewStateSchema.safeParse(JSON.parse(raw))
		return parsed.success ? parsed.data : EMPTY_REVIEW
	} catch {
		return EMPTY_REVIEW
	}
}

// Transitions. Pure, so the rules are tested without a browser.

/** Marks a finding reviewed. Marking again keeps the first time; nothing else un-marks it. */
export function markReviewed(state: ReviewState, findingId: string, now: Date): ReviewState {
	if (state.reviewed[findingId] != null) return state
	return { ...state, reviewed: { ...state.reviewed, [findingId]: now.toISOString() } }
}

export function addNote(
	state: ReviewState,
	input: { id: string; text: string; findingId: string | null; now: Date }
): ReviewState {
	const text = input.text.trim().slice(0, MAX_NOTE_CHARS)
	if (text === '' || state.notes.length >= MAX_NOTES) return state
	const note: ReviewNote = {
		id: input.id,
		at: input.now.toISOString(),
		text,
		findingId: input.findingId
	}
	return { ...state, notes: [...state.notes, note] }
}

export const setActive = (state: ReviewState, active: string | null): ReviewState =>
	state.active === active ? state : { ...state, active }

export const setRailCollapsed = (state: ReviewState, railCollapsed: boolean): ReviewState =>
	state.railCollapsed === railCollapsed ? state : { ...state, railCollapsed }

// The browser store. A blocked or full localStorage must not break the page, so
// the latest value is also held in memory and the UI is told when it could not be saved.

const memory = new Map<string, string>()
const cache = new Map<string, { raw: string | null; state: ReviewState }>()
const listeners = new Set<() => void>()
let storageFailed = false

function readRaw(key: string): string | null {
	try {
		const stored = window.localStorage.getItem(key)
		if (stored != null) return stored
	} catch {
		storageFailed = true
	}
	return memory.get(key) ?? null
}

function snapshotOf(key: string): ReviewState {
	const raw = readRaw(key)
	const cached = cache.get(key)
	if (cached != null && cached.raw === raw) return cached.state
	const state = parseReviewState(raw)
	cache.set(key, { raw, state })
	return state
}

function persist(key: string, state: ReviewState) {
	const raw = JSON.stringify(state)
	memory.set(key, raw)
	try {
		window.localStorage.setItem(key, raw)
	} catch {
		storageFailed = true
	}
	cache.set(key, { raw, state })
	for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
	listeners.add(listener)
	window.addEventListener('storage', listener)
	return () => {
		listeners.delete(listener)
		window.removeEventListener('storage', listener)
	}
}

/** True when the last write could not reach localStorage (private mode, full, blocked). */
export const couldNotSave = () => storageFailed

/** The stored state for a scope, as this tab sees it. */
export const readReviewState = (scope: string): ReviewState => snapshotOf(storageKey(scope))

/** Writes a scope's state to this browser (and to memory if the browser refuses). */
export const writeReviewState = (scope: string, state: ReviewState) =>
	persist(storageKey(scope), state)

/**
 * Forgets everything this tab holds in memory about any scope. Called on sign-out so
 * a different user signing in on the same page starts from what is stored for them,
 * never from what the last user left in memory. It does not delete what is stored in
 * the browser: that stays the previous user's own data, under their own key.
 */
export function clearReviewMemory() {
	memory.clear()
	cache.clear()
	for (const listener of listeners) listener()
}

export function useReviewState(scope: string) {
	const key = storageKey(scope)
	const state = useSyncExternalStore(
		subscribe,
		() => snapshotOf(key),
		() => EMPTY_REVIEW
	)
	const update = useCallback(
		(change: (current: ReviewState) => ReviewState) => {
			const next = change(snapshotOf(key))
			if (next !== snapshotOf(key)) persist(key, next)
		},
		[key]
	)
	return { state, update }
}
