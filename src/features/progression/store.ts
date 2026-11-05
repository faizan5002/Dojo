import { useCallback, useSyncExternalStore } from 'react'
import { isDemoProgress, keyOf, rollover, seedProfile, type DemoProgress } from './model'

// The demo progression profile lives in this browser only (localStorage, with an in-memory
// fallback). It is illustrative: it is never sent to a server and never mixes with the
// real assessment results.

const KEY = 'dojo:demo-progress:v1'

const listeners = new Set<() => void>()
let memoryRaw: string | null = null
let cached: { raw: string | null; day: string; state: DemoProgress } | null = null

export const todayKey = () => keyOf(new Date())

function readRaw(): string | null {
	try {
		const stored = window.localStorage.getItem(KEY)
		if (stored != null) return stored
	} catch {
		// private mode or blocked: fall through to memory
	}
	return memoryRaw
}

function snapshot(): DemoProgress {
	const raw = readRaw()
	const day = todayKey()
	if (cached != null && cached.raw === raw && cached.day === day) return cached.state
	let state: DemoProgress | null = null
	if (raw != null) {
		try {
			const parsed: unknown = JSON.parse(raw)
			if (isDemoProgress(parsed)) state = parsed
		} catch {
			state = null
		}
	}
	const next = rollover(state ?? seedProfile(day), day)
	cached = { raw, day, state: next }
	return next
}

function persist(state: DemoProgress) {
	const raw = JSON.stringify(state)
	memoryRaw = raw
	try {
		window.localStorage.setItem(KEY, raw)
	} catch {
		// keep going from memory
	}
	cached = { raw, day: todayKey(), state }
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

/** Applies a change from outside React (a practice answer, a finished review). */
export function updateProgress(change: (current: DemoProgress, today: string) => DemoProgress) {
	const current = snapshot()
	const next = change(current, todayKey())
	if (next !== current) persist(next)
}

/** The demo profile, or null until the browser has loaded it (server render and first paint). */
export function useProgress() {
	const state = useSyncExternalStore(subscribe, snapshot, () => null)
	const update = useCallback(
		(change: (current: DemoProgress, today: string) => DemoProgress) => updateProgress(change),
		[]
	)
	return { state, update }
}

// Celebrations wait while a practice session is in progress, so a reveal never lands on an
// unanswered scenario. This flag is in memory only; it is not part of the saved progress.
let held = false
const holdListeners = new Set<() => void>()

export function setCelebrationHold(next: boolean) {
	if (held === next) return
	held = next
	for (const listener of holdListeners) listener()
}

export function useCelebrationHold(): boolean {
	return useSyncExternalStore(
		(listener) => {
			holdListeners.add(listener)
			return () => holdListeners.delete(listener)
		},
		() => held,
		() => true
	)
}

/** The current progress, for reading inside an event handler. */
export const readProgress = (): DemoProgress => snapshot()
