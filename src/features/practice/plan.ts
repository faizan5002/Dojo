import { MIN_SKILLS_FOR_OVERALL, SKILL_IDS, type SkillId } from '@/features/assessment/rubric'
import { DIFFICULTIES, type CatalogEntry, type Difficulty } from './types'

// How Prompting Guru chooses what to practise. Deterministic and explainable:
// the latest workflow assessment sets each skill's priority, practice results
// adjust it, and the next challenge is the one that brings practice closest to
// the planned mix. Every tunable number is in PRACTICE_CONFIG. The library is
// passed in (the active challenges, read from the database), so the plan
// itself stays a pure function of its inputs.

/** The tag that marks the general first exercise for someone with no assessment. */
export const INTRODUCTION_TAG = 'introduction'

export type Priority = 'critical' | 'high' | 'moderate' | 'maintenance'

export const PRACTICE_CONFIG = {
	/** Workflow-assessment score bands, lowest first. */
	priorities: [
		{ below: 40, priority: 'critical' },
		{ below: 60, priority: 'high' },
		{ below: 80, priority: 'moderate' },
		{ below: 101, priority: 'maintenance' }
	] as const satisfies readonly { below: number; priority: Priority }[],
	/** Relative practice weight per priority; normalised into shares. */
	weights: { critical: 8, high: 6, moderate: 3, maintenance: 1 } satisfies Record<Priority, number>,
	/** A skill the assessment could not score: general practice, never "weak". */
	unassessedWeight: 2,
	/** Recent practice moves a skill's weight: struggling up, mastered down. */
	practice: {
		window: 3,
		strugglingBelow: 40,
		strugglingFactor: 1.5,
		masteredFrom: 80,
		masteredFactor: 0.5
	},
	/** Difficulty steps up after a strong score and down after a weak one. */
	difficulty: {
		stepUpFrom: 80,
		stepDownBelow: 40,
		startIntermediateFrom: 60,
		startAdvancedFrom: 80
	},
	/** When an attempt's challenge is due again, by its score. */
	reviewDays: [
		{ below: 40, days: 1 },
		{ below: 60, days: 3 },
		{ below: 80, days: 7 },
		{ below: 101, days: 14 }
	] as const,
	/** A challenge attempted this recently is not offered again if anything else is. */
	recentHours: 24,
	/** A challenge is "completed" once an attempt reaches this score. */
	completedFrom: 60,
	/** The skills shown as the current focus. */
	focusCount: 2
} as const

const MS_PER_HOUR = 3_600_000
const MS_PER_DAY = 86_400_000

export interface AssessedSkill {
	readonly skill: SkillId
	readonly score: number | null
}

export interface AttemptRecord {
	readonly id: string
	readonly challengeSlug: string
	readonly challengeVersion: number
	readonly skill: SkillId
	readonly difficulty: Difficulty
	readonly score: number
	readonly createdAt: Date
	readonly reviewAfter: Date
}

export type Trend = 'improving' | 'steady' | 'declining'

export interface SkillPlan {
	readonly skill: SkillId
	readonly assessmentScore: number | null
	readonly priority: Priority | 'unassessed'
	/** This skill's planned share of practice, 0–1. */
	readonly share: number
	readonly attempts: number
	readonly practiceAverage: number | null
	readonly practiceBest: number | null
	/** Only from repeated attempts of the same challenge version. */
	readonly trend: Trend | null
}

export type NextReason = 'introduction' | 'review' | 'focus' | 'general'

export interface NextChallenge {
	readonly slug: string
	readonly skill: SkillId
	readonly difficulty: Difficulty
	readonly reason: NextReason
}

export interface PracticePlan {
	/** general: no assessment. limited: too few scored skills to rank reliably. */
	readonly mode: 'personalized' | 'limited' | 'general'
	readonly skills: readonly SkillPlan[]
	readonly focus: readonly SkillId[]
	readonly next: NextChallenge | null
	readonly due: readonly { readonly slug: string; readonly dueAt: Date }[]
}

export function priorityOf(score: number): Priority {
	return PRACTICE_CONFIG.priorities.find((band) => score < band.below)?.priority ?? 'maintenance'
}

export function reviewAfter({ score, from }: { score: number; from: Date }): Date {
	const days = PRACTICE_CONFIG.reviewDays.find((band) => score < band.below)?.days ?? 1
	return new Date(from.getTime() + days * MS_PER_DAY)
}

const mean = (values: readonly number[]) =>
	values.length === 0 ? null : values.reduce((total, value) => total + value, 0) / values.length

const newestFirst = (a: AttemptRecord, b: AttemptRecord) =>
	b.createdAt.getTime() - a.createdAt.getTime()

/** Change on repeated attempts of the same challenge version, never across rubrics. */
function trendOf(attempts: readonly AttemptRecord[]): Trend | null {
	const byChallenge = new Map<string, AttemptRecord[]>()
	for (const attempt of attempts) {
		const key = `${attempt.challengeSlug}@${attempt.challengeVersion}`
		byChallenge.set(key, [...(byChallenge.get(key) ?? []), attempt])
	}
	const deltas = [...byChallenge.values()]
		.filter((group) => group.length >= 2)
		.map((group) => {
			const ordered = [...group].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
			return (ordered.at(-1)?.score ?? 0) - (ordered[0]?.score ?? 0)
		})
	const average = mean(deltas)
	if (average == null) return null
	if (average > 0) return 'improving'
	return average < 0 ? 'declining' : 'steady'
}

function weightOf({
	priority,
	recent
}: {
	priority: Priority | 'unassessed'
	recent: readonly AttemptRecord[]
}): number {
	const base =
		priority === 'unassessed' ? PRACTICE_CONFIG.unassessedWeight : PRACTICE_CONFIG.weights[priority]
	const average = mean(recent.map((attempt) => attempt.score))
	const { practice } = PRACTICE_CONFIG
	if (average == null || recent.length < practice.window) return base
	if (average < practice.strugglingBelow) return base * practice.strugglingFactor
	if (average >= practice.masteredFrom) return base * practice.masteredFactor
	return base
}

/** The difficulty to offer next for a skill: by assessment at first, then by the last attempt. */
export function nextDifficulty({
	assessmentScore,
	latest
}: {
	assessmentScore: number | null
	latest: AttemptRecord | undefined
}): Difficulty {
	const { difficulty } = PRACTICE_CONFIG
	if (latest == null) {
		if (assessmentScore == null || assessmentScore < difficulty.startIntermediateFrom)
			return 'beginner'
		return assessmentScore < difficulty.startAdvancedFrom ? 'intermediate' : 'advanced'
	}
	const index = DIFFICULTIES.indexOf(latest.difficulty)
	if (latest.score >= difficulty.stepUpFrom)
		return DIFFICULTIES[Math.min(index + 1, 2)] ?? latest.difficulty
	if (latest.score < difficulty.stepDownBelow)
		return DIFFICULTIES[Math.max(index - 1, 0)] ?? latest.difficulty
	return latest.difficulty
}

/**
 * Within a skill: the wanted difficulty first, then the nearest. Never-tried
 * challenges first, then those due for review, then the least recently tried;
 * one tried in the last recentHours only if nothing else is left.
 */
function pickChallenge({
	catalog,
	skill,
	difficulty,
	attempts,
	now
}: {
	catalog: readonly CatalogEntry[]
	skill: SkillId
	difficulty: Difficulty
	attempts: readonly AttemptRecord[]
	now: Date
}): CatalogEntry | null {
	const wanted = DIFFICULTIES.indexOf(difficulty)
	const candidates = catalog
		.filter((challenge) => challenge.skill === skill)
		.sort(
			(a, b) =>
				Math.abs(DIFFICULTIES.indexOf(a.difficulty) - wanted) -
					Math.abs(DIFFICULTIES.indexOf(b.difficulty) - wanted) || a.slug.localeCompare(b.slug)
		)
	const lastTried = (challenge: CatalogEntry) =>
		attempts.filter((attempt) => attempt.challengeSlug === challenge.slug).sort(newestFirst)[0]
	const rank = (challenge: CatalogEntry) => {
		const latest = lastTried(challenge)
		if (latest == null) return 0
		if (latest.reviewAfter.getTime() <= now.getTime()) return 1
		const isRecent =
			now.getTime() - latest.createdAt.getTime() < PRACTICE_CONFIG.recentHours * MS_PER_HOUR
		return isRecent ? 3 : 2
	}
	const best = Math.min(...candidates.map(rank))
	const pool = candidates.filter((challenge) => rank(challenge) === best)
	if (best <= 1) return pool[0] ?? null
	return (
		[...pool].sort(
			(a, b) => (lastTried(a)?.createdAt.getTime() ?? 0) - (lastTried(b)?.createdAt.getTime() ?? 0)
		)[0] ?? null
	)
}

/** Within the same share, the lower assessment score first; unscored skills last. */
function weakerFirst(a: SkillPlan, b: SkillPlan): number {
	if (a.assessmentScore == null || b.assessmentScore == null)
		return Number(a.assessmentScore == null) - Number(b.assessmentScore == null)
	return a.assessmentScore - b.assessmentScore
}

export function buildPracticePlan({
	assessed,
	attempts,
	catalog,
	now
}: {
	assessed: readonly AssessedSkill[] | null
	attempts: readonly AttemptRecord[]
	/** The active challenges to choose from. */
	catalog: readonly CatalogEntry[]
	now: Date
}): PracticePlan {
	const scored = (assessed ?? []).filter((skill) => skill.score != null).length
	const mode =
		assessed == null ? 'general' : scored >= MIN_SKILLS_FOR_OVERALL ? 'personalized' : 'limited'

	const drafts = SKILL_IDS.map((skill) => {
		const assessmentScore = assessed?.find((entry) => entry.skill === skill)?.score ?? null
		const own = attempts.filter((attempt) => attempt.skill === skill).sort(newestFirst)
		const priority: Priority | 'unassessed' =
			assessmentScore == null ? 'unassessed' : priorityOf(assessmentScore)
		return {
			skill,
			assessmentScore,
			priority,
			own,
			weight: weightOf({ priority, recent: own.slice(0, PRACTICE_CONFIG.practice.window) })
		}
	})
	const totalWeight = drafts.reduce((total, draft) => total + draft.weight, 0)
	const skills: SkillPlan[] = drafts.map((draft) => ({
		skill: draft.skill,
		assessmentScore: draft.assessmentScore,
		priority: draft.priority,
		share: draft.weight / totalWeight,
		attempts: draft.own.length,
		practiceAverage: mean(draft.own.map((attempt) => attempt.score)),
		practiceBest:
			draft.own.length === 0 ? null : Math.max(...draft.own.map((attempt) => attempt.score)),
		trend: trendOf(draft.own)
	}))

	const focus =
		mode === 'general'
			? []
			: [...skills]
					.filter((skill) => skill.priority !== 'unassessed')
					.sort(
						(a, b) =>
							b.share - a.share ||
							weakerFirst(a, b) ||
							SKILL_IDS.indexOf(a.skill) - SKILL_IDS.indexOf(b.skill)
					)
					.slice(0, PRACTICE_CONFIG.focusCount)
					.map((skill) => skill.skill)

	const latestByChallenge = new Map<string, AttemptRecord>()
	for (const attempt of [...attempts].sort(newestFirst)) {
		if (!latestByChallenge.has(attempt.challengeSlug))
			latestByChallenge.set(attempt.challengeSlug, attempt)
	}
	const due = [...latestByChallenge.values()]
		.filter(
			(attempt) =>
				attempt.reviewAfter.getTime() <= now.getTime() &&
				catalog.some((challenge) => challenge.slug === attempt.challengeSlug)
		)
		.sort((a, b) => a.reviewAfter.getTime() - b.reviewAfter.getTime())
		.map((attempt) => ({ slug: attempt.challengeSlug, dueAt: attempt.reviewAfter }))

	return {
		mode,
		skills,
		focus,
		next: nextChallenge({ mode, skills, focus, due, attempts, catalog, now }),
		due
	}
}

function nextChallenge({
	mode,
	skills,
	focus,
	due,
	attempts,
	catalog,
	now
}: {
	mode: PracticePlan['mode']
	skills: readonly SkillPlan[]
	focus: readonly SkillId[]
	due: PracticePlan['due']
	attempts: readonly AttemptRecord[]
	catalog: readonly CatalogEntry[]
	now: Date
}): NextChallenge | null {
	// The tagged introduction, or failing that the first beginner challenge in
	// rubric order: chosen from the data, never by a hard-coded id.
	const introduction =
		catalog.find((challenge) => challenge.tags.includes(INTRODUCTION_TAG)) ??
		[...catalog]
			.filter((challenge) => challenge.difficulty === 'beginner')
			.sort(
				(a, b) =>
					SKILL_IDS.indexOf(a.skill) - SKILL_IDS.indexOf(b.skill) || a.slug.localeCompare(b.slug)
			)[0]
	if (attempts.length === 0 && mode === 'general' && introduction != null) {
		return {
			slug: introduction.slug,
			skill: introduction.skill,
			difficulty: introduction.difficulty,
			reason: 'introduction'
		}
	}

	// A focus skill's review that has come due goes first.
	const dueFocus = due
		.map((item) => catalog.find((challenge) => challenge.slug === item.slug))
		.find((challenge) => challenge != null && focus.includes(challenge.skill))
	if (dueFocus != null) {
		return {
			slug: dueFocus.slug,
			skill: dueFocus.skill,
			difficulty: dueFocus.difficulty,
			reason: 'review'
		}
	}

	// Otherwise the skill furthest below its planned share of practice.
	const total = attempts.length
	const byNeed = [...skills].sort((a, b) => {
		const need = (skill: SkillPlan) => skill.share - (total === 0 ? 0 : skill.attempts / total)
		return (
			need(b) - need(a) ||
			b.share - a.share ||
			weakerFirst(a, b) ||
			SKILL_IDS.indexOf(a.skill) - SKILL_IDS.indexOf(b.skill)
		)
	})
	for (const skill of byNeed) {
		const latest = attempts.filter((attempt) => attempt.skill === skill.skill).sort(newestFirst)[0]
		const difficulty = nextDifficulty({ assessmentScore: skill.assessmentScore, latest })
		const challenge = pickChallenge({ catalog, skill: skill.skill, difficulty, attempts, now })
		if (challenge != null) {
			return {
				slug: challenge.slug,
				skill: challenge.skill,
				difficulty: challenge.difficulty,
				reason: focus.includes(challenge.skill) ? 'focus' : 'general'
			}
		}
	}
	return null
}

export interface PracticeSummary {
	readonly attemptCount: number
	readonly attempted: number
	readonly completed: number
	readonly averageScore: number | null
	readonly bestScore: number | null
	/** Consecutive UTC days with an attempt, ending today or yesterday. */
	readonly streakDays: number
}

const utcDay = (date: Date) => Math.floor(date.getTime() / MS_PER_DAY)

export function summarizePractice({
	attempts,
	now
}: {
	attempts: readonly AttemptRecord[]
	now: Date
}): PracticeSummary {
	const best = new Map<string, number>()
	for (const attempt of attempts) {
		best.set(attempt.challengeSlug, Math.max(best.get(attempt.challengeSlug) ?? 0, attempt.score))
	}
	const days = new Set(attempts.map((attempt) => utcDay(attempt.createdAt)))
	let day = days.has(utcDay(now)) ? utcDay(now) : utcDay(now) - 1
	let streakDays = 0
	while (days.has(day)) {
		streakDays++
		day--
	}
	const average = mean(attempts.map((attempt) => attempt.score))
	return {
		attemptCount: attempts.length,
		attempted: best.size,
		completed: [...best.values()].filter((score) => score >= PRACTICE_CONFIG.completedFrom).length,
		averageScore: average == null ? null : Math.round(average),
		bestScore: attempts.length === 0 ? null : Math.max(...attempts.map((attempt) => attempt.score)),
		streakDays
	}
}
