// The demo progression profile: streak, XP, rank, activity, seals and quests.
//
// EVERYTHING IN THIS FILE IS ILLUSTRATIVE. It is a clearly labelled demonstration of how
// progression could look and feel; it is not computed from a user's real work, it is kept
// only in this browser, and it never feeds an assessment score. The five skill scores and
// their evidence come from the assessment engine and are not touched here.
//
// XP has one source of truth: the ledger. Every point of XP is added through `award`, which
// writes one ledger entry and moves the total, so any screen that shows XP reads the ledger.

export type DayKey = string // YYYY-MM-DD in the viewer's local time

export type ActivityKind = 'practice' | 'review' | 'assessment'

export interface DayActivity {
	readonly practice: number
	readonly review: number
	readonly assessment: number
}

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary'

export const SKILLS = [
	'promptClarity',
	'planning',
	'verification',
	'iteration',
	'scopeControl'
] as const
export type SkillKey = (typeof SKILLS)[number]

export interface Achievement {
	readonly id: string
	readonly title: string
	readonly description: string
	/** What earns it, in terms of events the demo actually records. */
	readonly criteria: string
	readonly rarity: Rarity
	readonly glyph:
		'blade' | 'brush' | 'shield' | 'cycle' | 'flame' | 'eye' | 'dojo' | 'five' | 'crown'
	readonly xp: number
}

export const ACHIEVEMENTS: readonly Achievement[] = [
	{
		id: 'first-blade',
		title: 'First Blade',
		description: 'You ran your first assessment and saw how you really work with an agent.',
		criteria: 'Complete your first assessment.',
		rarity: 'common',
		glyph: 'blade',
		xp: 25
	},
	{
		id: 'evidence-seeker',
		title: 'Evidence Seeker',
		description: 'You read every finding in a session instead of skimming the score.',
		criteria: 'Mark every finding in one session as reviewed.',
		rarity: 'common',
		glyph: 'eye',
		xp: 40
	},
	{
		id: 'guardian-of-verification',
		title: 'Guardian of Verification',
		description: 'You keep asking to see the output before you trust the claim.',
		criteria: 'Choose the strongest answer in three verification scenarios.',
		rarity: 'rare',
		glyph: 'shield',
		xp: 60
	},
	{
		id: 'prompt-ronin',
		title: 'Prompt Ronin',
		description: 'Your requests state the goal, the place and the finish line.',
		criteria: 'Choose the strongest answer in three prompt-clarity scenarios.',
		rarity: 'rare',
		glyph: 'brush',
		xp: 60
	},
	{
		id: 'five-day-discipline',
		title: 'Five-Day Discipline',
		description: 'Five days in a row of real practice. The habit is forming.',
		criteria: 'Keep a five-day activity streak.',
		rarity: 'rare',
		glyph: 'flame',
		xp: 75
	},
	{
		id: 'practice-samurai',
		title: 'Practice Samurai',
		description: 'You finished a full set of targeted practice scenarios.',
		criteria: 'Complete one five-scenario practice session.',
		rarity: 'epic',
		glyph: 'dojo',
		xp: 100
	},
	{
		id: 'master-of-iteration',
		title: 'Master of Iteration',
		description: 'You improve through refinement: expected, actual, and what changed.',
		criteria: 'Choose the strongest answer in three iteration scenarios.',
		rarity: 'epic',
		glyph: 'cycle',
		xp: 120
	},
	{
		id: 'five-skill-adept',
		title: 'Five-Skill Adept',
		description: 'You have shown the strongest approach in each of the five skills at least once.',
		criteria: 'Choose the strongest answer at least once in each of the five skills.',
		rarity: 'epic',
		glyph: 'five',
		xp: 150
	},
	{
		id: 'thirty-day-flame',
		title: 'Thirty-Day Flame',
		description: 'A month without a break. Very few people get here.',
		criteria: 'Keep a thirty-day activity streak.',
		rarity: 'legendary',
		glyph: 'crown',
		xp: 300
	}
]

const RARITY_ORDER: Record<Rarity, number> = { common: 0, rare: 1, epic: 2, legendary: 3 }

export const LEVELS: readonly {
	readonly title: string
	readonly gloss: string
	readonly from: number
}[] = [
	{ title: 'Deshi', gloss: 'Apprentice', from: 0 },
	{ title: 'Kenshi', gloss: 'Swordsman', from: 100 },
	{ title: 'Bushi', gloss: 'Warrior', from: 250 },
	{ title: 'Samurai', gloss: 'Trusted blade', from: 450 },
	{ title: 'Shihan', gloss: 'Master instructor', from: 700 },
	{ title: 'Kensei', gloss: 'Sword saint', from: 1000 },
	{ title: 'Sensei', gloss: 'Teacher', from: 1400 }
]

export interface LevelInfo {
	readonly level: number
	readonly title: string
	readonly gloss: string
	readonly xp: number
	readonly into: number
	readonly span: number
	readonly toNext: number
	readonly isMax: boolean
	readonly nextTitle: string | null
}

export function levelOf(xp: number): LevelInfo {
	let index = 0
	for (let i = 0; i < LEVELS.length; i++) if (xp >= (LEVELS[i]?.from ?? 0)) index = i
	const here = LEVELS[index]
	const next = LEVELS[index + 1]
	const from = here?.from ?? 0
	const span = next == null ? 1 : next.from - from
	return {
		level: index + 1,
		title: here?.title ?? 'Deshi',
		gloss: here?.gloss ?? 'Apprentice',
		xp,
		into: next == null ? span : xp - from,
		span,
		toNext: next == null ? 0 : next.from - xp,
		isMax: next == null,
		nextTitle: next?.title ?? null
	}
}

export interface Counters {
	readonly dayKey: DayKey
	readonly weekKey: DayKey
	readonly dayScenarios: number
	readonly dayEffective: number
	readonly dayVerifyEffective: number
	readonly dayReviews: number
	readonly weekScenarios: number
	readonly weekEffective: number
	readonly weekReviews: number
}

/** A celebration waiting to be shown: a seal unlocked, a rank gained, or a plain XP note. */
export interface Reward {
	readonly id: string
	readonly kind: 'xp' | 'achievement' | 'level'
	readonly label: string
	readonly detail?: string
	readonly achievementId?: string
	readonly level?: number
}

export type LedgerSource = 'scenario' | 'session' | 'quest' | 'review' | 'seal'

export interface LedgerEntry {
	readonly id: string
	readonly day: DayKey
	readonly source: LedgerSource
	readonly label: string
	readonly xp: number
	/** The practice session this belongs to, and the 1-based answer within it. */
	readonly run: string | null
	readonly step: number | null
}

export interface DemoProgress {
	readonly v: 2
	readonly xp: number
	readonly xpBySource: {
		readonly practice: number
		readonly review: number
		readonly assessment: number
		readonly bonus: number
	}
	readonly activity: Readonly<Record<DayKey, DayActivity>>
	readonly unlocked: Readonly<Record<string, DayKey>>
	readonly counters: Counters
	readonly effectiveBySkill: Readonly<Record<SkillKey, number>>
	readonly practiceSessions: number
	/** Celebrations waiting, oldest first. */
	readonly pending: readonly Reward[]
	/** Every XP gain since the demo started, newest last. */
	readonly ledger: readonly LedgerEntry[]
}

export const EMPTY_ACTIVITY: DayActivity = { practice: 0, review: 0, assessment: 0 }

// ---- dates -------------------------------------------------------------------------

export const pad = (n: number) => String(n).padStart(2, '0')
export const keyOf = (date: Date): DayKey =>
	`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
export const dateOf = (key: DayKey): Date => {
	const [y, m, d] = key.split('-').map(Number)
	return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
}
export const addDays = (key: DayKey, days: number): DayKey => {
	const date = dateOf(key)
	date.setDate(date.getDate() + days)
	return keyOf(date)
}
/** Monday of the week containing the day. */
export const weekStart = (key: DayKey): DayKey => {
	const date = dateOf(key)
	const offset = (date.getDay() + 6) % 7
	return addDays(key, -offset)
}

export const isActive = (day: DayActivity | undefined) =>
	day != null && day.practice + day.review + day.assessment > 0

export const countOf = (day: DayActivity | undefined) =>
	day == null ? 0 : day.practice + day.review + day.assessment

/** 0 to 4, like a contribution graph. */
export function intensityOf(day: DayActivity | undefined): 0 | 1 | 2 | 3 | 4 {
	const count = countOf(day)
	if (count === 0) return 0
	if (count === 1) return 1
	if (count === 2) return 2
	if (count <= 4) return 3
	return 4
}

// ---- streak ------------------------------------------------------------------------

export function currentStreak(activity: DemoProgress['activity'], today: DayKey): number {
	let cursor = isActive(activity[today]) ? today : addDays(today, -1)
	let count = 0
	while (isActive(activity[cursor])) {
		count++
		cursor = addDays(cursor, -1)
	}
	return count
}

export function bestStreak(activity: DemoProgress['activity']): number {
	const days = Object.keys(activity)
		.filter((key) => isActive(activity[key]))
		.sort()
	let best = 0
	let run = 0
	let previous: DayKey | null = null
	for (const day of days) {
		run = previous != null && addDays(previous, 1) === day ? run + 1 : 1
		best = Math.max(best, run)
		previous = day
	}
	return best
}

// ---- seed ------------------------------------------------------------------------------

/** A small deterministic generator, so the demo heatmap is the same shape every time. */
function seeded(seed: number) {
	let state = seed >>> 0
	return () => {
		state = (state + 0x6d2b79f5) >>> 0
		let t = state
		t = Math.imul(t ^ (t >>> 15), t | 1)
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
}

export const HEATMAP_WEEKS = 26

/**
 * The illustrative starting profile. Half a year of activity with a quiet stretch, a best
 * run of eleven days, and a current run of four ending yesterday, so one practice scenario
 * today makes a five-day streak.
 */
export function seedProfile(today: DayKey): DemoProgress {
	const random = seeded(20261105)
	const activity: Record<DayKey, DayActivity> = {}
	const total = HEATMAP_WEEKS * 7
	for (let back = 1; back <= total; back++) {
		const day = addDays(today, -back)
		const weekday = (dateOf(day).getDay() + 6) % 7
		const quiet = back > 90 && back < 120
		const chance = quiet ? 0.1 : weekday >= 5 ? 0.35 : 0.68
		if (random() < chance) {
			const roll = random()
			const count = roll < 0.45 ? 1 : roll < 0.78 ? 2 : roll < 0.93 ? 3 : 5
			const practice = Math.max(0, count - (random() < 0.5 ? 1 : 0))
			activity[day] = {
				practice,
				review: count - practice > 0 ? 1 : 0,
				assessment: random() < 0.12 ? 1 : 0
			}
		}
	}
	for (let back = 38; back <= 48; back++) {
		activity[addDays(today, -back)] = { practice: 2, review: 1, assessment: back === 48 ? 1 : 0 }
	}
	for (let back = 1; back <= 4; back++) {
		activity[addDays(today, -back)] = {
			practice: back % 2 === 0 ? 3 : 2,
			review: 1,
			assessment: 0
		}
	}
	// Gaps that bound the two runs, so the streak is exactly four and the best exactly eleven.
	for (const back of [0, 5, 37, 49]) delete activity[addDays(today, -back)]
	return {
		v: 2,
		xp: 392,
		xpBySource: { practice: 236, review: 96, assessment: 60, bonus: 0 },
		activity,
		unlocked: {
			'first-blade': addDays(today, -170),
			'guardian-of-verification': addDays(today, -52)
		},
		counters: {
			dayKey: today,
			weekKey: weekStart(today),
			dayScenarios: 0,
			dayEffective: 0,
			dayVerifyEffective: 0,
			dayReviews: 0,
			weekScenarios: 4,
			weekEffective: 1,
			weekReviews: 1
		},
		// One strongest answer short of Prompt Ronin and of Five-Skill Adept (scope control).
		effectiveBySkill: {
			promptClarity: 2,
			planning: 1,
			verification: 4,
			iteration: 1,
			scopeControl: 0
		},
		practiceSessions: 0,
		pending: [],
		ledger: []
	}
}

/** Starts a new day or week: the daily counters reset, and the streak follows the activity. */
export function rollover(state: DemoProgress, today: DayKey): DemoProgress {
	const week = weekStart(today)
	if (state.counters.dayKey === today && state.counters.weekKey === week) return state
	const sameWeek = state.counters.weekKey === week
	return {
		...state,
		counters: {
			dayKey: today,
			weekKey: week,
			dayScenarios: 0,
			dayEffective: 0,
			dayVerifyEffective: 0,
			dayReviews: 0,
			weekScenarios: sameWeek ? state.counters.weekScenarios : 0,
			weekEffective: sameWeek ? state.counters.weekEffective : 0,
			weekReviews: sameWeek ? state.counters.weekReviews : 0
		}
	}
}

// ---- quests ------------------------------------------------------------------------

export interface Quest {
	readonly id: string
	readonly scope: 'daily' | 'weekly'
	readonly title: string
	readonly detail: string
	readonly goal: number
	readonly xp: number
	readonly progress: number
	readonly done: boolean
}

export function questsOf(state: DemoProgress): readonly Quest[] {
	const c = state.counters
	const make = (
		id: string,
		scope: Quest['scope'],
		title: string,
		detail: string,
		goal: number,
		xp: number,
		value: number
	): Quest => ({
		id,
		scope,
		title,
		detail,
		goal,
		xp,
		progress: Math.min(goal, value),
		done: value >= goal
	})
	return [
		make(
			'review-session',
			'daily',
			'Study one session scroll',
			'Open a session and read every finding.',
			1,
			40,
			c.dayReviews
		),
		make(
			'three-scenarios',
			'daily',
			'Train three scenarios',
			'Answer scenarios from your weakest skills.',
			3,
			60,
			c.dayScenarios
		),
		make(
			'verify-solution',
			'daily',
			'Verify an agent solution',
			'Choose the answer that asks to see the output.',
			1,
			30,
			c.dayVerifyEffective
		),
		make(
			'weekly-ten',
			'weekly',
			'Ten scenarios this week',
			'Keep the training going across the week.',
			10,
			150,
			c.weekScenarios
		),
		make(
			'weekly-weakest',
			'weekly',
			'Sharpen your weakest skill',
			'Choose the strongest approach five times.',
			5,
			120,
			c.weekEffective
		)
	]
}

// ---- the ledger ------------------------------------------------------------------------

type Draft = { -readonly [K in keyof DemoProgress]: DemoProgress[K] }

let counter = 0
const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${counter++}`

/** The one way XP is added: moves the total and the source split, and writes a ledger entry. */
function award(
	draft: Draft,
	entry: {
		source: LedgerSource
		label: string
		xp: number
		run?: string | null
		step?: number | null
	},
	today: DayKey
) {
	const bucket =
		entry.source === 'review'
			? 'review'
			: entry.source === 'quest' || entry.source === 'seal'
				? 'bonus'
				: 'practice'
	draft.xp += entry.xp
	draft.xpBySource = { ...draft.xpBySource, [bucket]: draft.xpBySource[bucket] + entry.xp }
	draft.ledger = [
		...draft.ledger.slice(-199),
		{
			id: uid('xp'),
			day: today,
			source: entry.source,
			label: entry.label,
			xp: entry.xp,
			run: entry.run ?? null,
			step: entry.step ?? null
		}
	]
}

function addActivity(
	activity: DemoProgress['activity'],
	day: DayKey,
	kind: ActivityKind
): DemoProgress['activity'] {
	const current = activity[day] ?? EMPTY_ACTIVITY
	return { ...activity, [day]: { ...current, [kind]: current[kind] + 1 } }
}

/** Pays any quest that just became complete, as quest-bonus ledger entries. */
function payQuests(
	before: DemoProgress,
	draft: Draft,
	today: DayKey,
	run: string | null,
	step: number | null
) {
	const wasDone = new Set(
		questsOf(before)
			.filter((q) => q.done)
			.map((q) => q.id)
	)
	for (const quest of questsOf(draft)) {
		if (quest.done && !wasDone.has(quest.id)) {
			award(
				draft,
				{ source: 'quest', label: `Quest complete: ${quest.title}`, xp: quest.xp, run, step },
				today
			)
		}
	}
}

/** Unlocks every seal whose criteria are now met, and notes a rank gain. Celebrations queue in order. */
function settle(
	before: DemoProgress,
	draft: Draft,
	today: DayKey,
	run: string | null,
	step: number | null,
	extra: Reward[] = []
): DemoProgress {
	const rankBefore = levelOf(before.xp).level
	const unlocked = { ...draft.unlocked }
	const won: Achievement[] = []
	const streak = currentStreak(draft.activity, today)
	const e = draft.effectiveBySkill
	const met: Record<string, boolean> = {
		'five-day-discipline': streak >= 5,
		'thirty-day-flame': streak >= 30,
		'practice-samurai': draft.practiceSessions >= 1,
		'prompt-ronin': e.promptClarity >= 3,
		'master-of-iteration': e.iteration >= 3,
		'guardian-of-verification': e.verification >= 3,
		'five-skill-adept': SKILLS.every((skill) => e[skill] >= 1)
	}
	for (const achievement of ACHIEVEMENTS) {
		if (
			unlocked[achievement.id] == null &&
			(met[achievement.id] === true || extra.some((r) => r.achievementId === achievement.id))
		) {
			unlocked[achievement.id] = today
			won.push(achievement)
		}
	}
	draft.unlocked = unlocked
	for (const achievement of won) {
		award(
			draft,
			{ source: 'seal', label: `Seal: ${achievement.title}`, xp: achievement.xp, run, step },
			today
		)
	}
	const rewards: Reward[] = [...extra.filter((r) => r.kind === 'xp')]
	for (const achievement of [...won].sort(
		(a, b) => RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity]
	)) {
		rewards.push({
			id: uid('seal'),
			kind: 'achievement',
			label: achievement.title,
			detail: `+${achievement.xp} XP`,
			achievementId: achievement.id
		})
	}
	const rankAfter = levelOf(draft.xp)
	if (rankAfter.level > rankBefore) {
		rewards.push({
			id: uid('rank'),
			kind: 'level',
			label: rankAfter.title,
			detail: rankAfter.gloss,
			level: rankAfter.level
		})
	}
	return { ...draft, pending: [...before.pending, ...rewards] }
}

export const XP_BY_QUALITY = { effective: 20, partial: 10, ineffective: 5 } as const
export const SESSION_COMPLETE_XP = 50
export const REVIEW_XP = 30

/** A practice scenario was answered. Its XP and any quest bonus are ledger entries for this step. */
export function recordScenario(
	state: DemoProgress,
	input: { quality: keyof typeof XP_BY_QUALITY; skill: string; run: string; step: number },
	today: DayKey
): DemoProgress {
	const rolled = rollover(state, today)
	const effective = input.quality === 'effective'
	const c = rolled.counters
	const skill = SKILLS.find((each) => each === input.skill)
	const draft: Draft = {
		...rolled,
		activity: addActivity(rolled.activity, today, 'practice'),
		effectiveBySkill:
			effective && skill != null
				? { ...rolled.effectiveBySkill, [skill]: rolled.effectiveBySkill[skill] + 1 }
				: rolled.effectiveBySkill,
		counters: {
			...c,
			dayScenarios: c.dayScenarios + 1,
			dayEffective: c.dayEffective + (effective ? 1 : 0),
			dayVerifyEffective:
				c.dayVerifyEffective + (effective && input.skill === 'verification' ? 1 : 0),
			weekScenarios: c.weekScenarios + 1,
			weekEffective: c.weekEffective + (effective ? 1 : 0)
		}
	}
	award(
		draft,
		{
			source: 'scenario',
			label: 'Practice scenario',
			xp: XP_BY_QUALITY[input.quality],
			run: input.run,
			step: input.step
		},
		today
	)
	payQuests(rolled, draft, today, input.run, input.step)
	return settle(rolled, draft, today, input.run, input.step)
}

/** A five-scenario practice session was finished. */
export function recordPracticeSession(
	state: DemoProgress,
	run: string,
	today: DayKey
): DemoProgress {
	const rolled = rollover(state, today)
	const draft: Draft = { ...rolled, practiceSessions: rolled.practiceSessions + 1 }
	award(
		draft,
		{ source: 'session', label: 'Session complete', xp: SESSION_COMPLETE_XP, run, step: null },
		today
	)
	return settle(rolled, draft, today, run, null)
}

/** Every finding of a session was reviewed. */
export function recordReviewComplete(state: DemoProgress, today: DayKey): DemoProgress {
	const rolled = rollover(state, today)
	const c = rolled.counters
	const draft: Draft = {
		...rolled,
		activity: addActivity(rolled.activity, today, 'review'),
		counters: { ...c, dayReviews: c.dayReviews + 1, weekReviews: c.weekReviews + 1 }
	}
	award(draft, { source: 'review', label: 'Session studied', xp: REVIEW_XP }, today)
	payQuests(rolled, draft, today, null, null)
	const note: Reward = {
		id: uid('xp'),
		kind: 'xp',
		label: `+${REVIEW_XP} XP`,
		detail: 'Session studied'
	}
	return settle(rolled, draft, today, null, null, [
		note,
		{ id: 'evidence', kind: 'achievement', label: '', achievementId: 'evidence-seeker' }
	])
}

/** The ledger entries for one practice session, grouped for its summary. */
export function runSummary(state: DemoProgress, run: string) {
	const entries = state.ledger.filter((entry) => entry.run === run)
	const sum = (source: LedgerSource) =>
		entries.filter((entry) => entry.source === source).reduce((total, entry) => total + entry.xp, 0)
	const scenario = sum('scenario')
	const session = sum('session')
	const quests = sum('quest')
	const seals = sum('seal')
	return {
		entries,
		scenario,
		session,
		quests,
		seals,
		total: scenario + session + quests + seals
	}
}

/** Marks the first pending celebration as shown. */
export function dismissReward(state: DemoProgress): DemoProgress {
	return state.pending.length === 0 ? state : { ...state, pending: state.pending.slice(1) }
}

/** For the demo only: queues a rank-up and a seal reveal, without touching XP. */
export function replayCelebration(state: DemoProgress): DemoProgress {
	const info = levelOf(state.xp)
	const next = LEVELS[info.level]
	const rewards: Reward[] = [
		{
			id: uid('rank'),
			kind: 'level',
			label: next?.title ?? info.title,
			detail: next?.gloss ?? info.gloss,
			level: info.level + 1
		},
		{
			id: uid('seal'),
			kind: 'achievement',
			label: 'Master of Iteration',
			detail: '+120 XP',
			achievementId: 'master-of-iteration'
		}
	]
	return { ...state, pending: [...state.pending, ...rewards] }
}

export function resetProgress(today: DayKey): DemoProgress {
	return seedProfile(today)
}

export function isDemoProgress(value: unknown): value is DemoProgress {
	return (
		typeof value === 'object' &&
		value != null &&
		(value as { v?: unknown }).v === 2 &&
		typeof (value as { xp?: unknown }).xp === 'number' &&
		typeof (value as { activity?: unknown }).activity === 'object' &&
		typeof (value as { counters?: unknown }).counters === 'object' &&
		Array.isArray((value as { ledger?: unknown }).ledger)
	)
}
