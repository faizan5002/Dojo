import {
	EVIDENCE_THRESHOLDS,
	MIN_SKILLS_FOR_OVERALL,
	PROFICIENCY_BANDS,
	SKILL_IDS,
	type Confidence,
	type CriterionId,
	type Proficiency,
	type SkillId
} from '@/features/assessment/rubric'
import type { SkillAssessment } from '@/features/assessment/types'
import type {
	AssessmentSummary,
	StoredAssessment,
	UploadSummary,
	UploadView
} from '@/features/workspace/repository'

// Turns what the workspace holds (uploads, assessments, saved metrics) into what
// the dashboard shows. Pure and framework-free: the page gathers the data through
// workspace-data.ts (the real repository, or fixtures in frontend dev mode) and
// this only arranges it, so every figure and quote on screen comes from that data.
//
// The coaching block ("Focus next") is built only from what the assessment engine
// already produced: its first recommendation, the quote that recommendation points
// at, and the skill that quote belongs to. Nothing is generated here.

export const RECENT_SESSIONS = 6
export const EARLIER_ASSESSMENTS = 4
/** How many of the newest uploads are read to find recent sessions. */
export const RECENT_UPLOADS_READ = 3
export const TREND_POINTS = 12

/** Why a change against an earlier assessment is not shown as a number. */
export type ComparisonUnavailable = 'noPrevious' | 'previousUnscored' | 'currentUnscored'

/**
 * A change in points against the earlier scored assessment. `comparable` only
 * when both sides rest on strong evidence; `provisional` when either side is
 * scored on limited evidence, so the change is shown but never as a finding.
 */
export type Comparison =
	| { readonly status: 'comparable' | 'provisional'; readonly delta: number }
	| { readonly status: 'unavailable'; readonly reason: ComparisonUnavailable }

export interface SkillRow {
	readonly skill: SkillId
	readonly score: number | null
	readonly proficiency: Proficiency | null
	readonly confidence: Confidence
	readonly observations: number
	readonly comparison: Comparison
	/** The skill the coaching block is about. */
	readonly isFocus: boolean
	/** The best-scored skill, only named when it is a different skill from the focus. */
	readonly isStrongest: boolean
}

export interface FocusQuote {
	/** The evidence id, so a link can open this quote in its conversation. */
	readonly evidenceId: string
	/** Exactly the stored, redacted excerpt of the user's prompt. */
	readonly excerpt: string
	readonly clippedBefore: boolean
	readonly clippedAfter: boolean
	readonly sessionId: string
	readonly promptNumber: number
	/** From the upload's session metrics, when that session is found there. */
	readonly project: string | null
	readonly startedAt: string | null
}

export type Focus =
	| {
			readonly kind: 'ready'
			readonly skill: SkillId
			readonly score: number
			readonly proficiency: Proficiency | null
			readonly confidence: Confidence
			readonly observations: number
			readonly criterion: CriterionId
			/** The recommendation's own counts: seen `seen` times across `of` observations. */
			readonly seen: number
			readonly of: number
			readonly quote: FocusQuote
	  }
	/** A recommendation exists but its quote is not in this assessment's evidence. */
	| { readonly kind: 'missingQuote'; readonly skill: SkillId; readonly score: number }
	/** No recommendation: every reliably scored skill is high, or evidence is too thin. */
	| { readonly kind: 'none' }

export interface EarlierAssessment {
	readonly id: string
	readonly createdAt: Date
	readonly score: number | null
	readonly proficiency: Proficiency | null
}

export interface RecentSession {
	readonly key: string
	readonly sessionId: string
	readonly project: string | null
	readonly startedAt: string | null
	readonly promptCount: number
	readonly minutes: number | null
	readonly uploadId: string
}

export interface EvidenceNeed {
	readonly skill: SkillId
	readonly observations: number
	/** The rubric's own minimum number of observations before a skill is scored. */
	readonly needed: number
}

export type DashboardStage = 'empty' | 'toScore' | 'insufficient' | 'ready'

export interface DashboardModel {
	readonly stage: DashboardStage
	/** The latest assessment that has an overall score. Null in every stage but 'ready'. */
	readonly valid: {
		readonly id: string
		readonly createdAt: Date
		readonly score: number
		readonly proficiency: Proficiency | null
		readonly sessions: number
		readonly prompts: number
		readonly comparison: Comparison
	} | null
	/** A newer assessment than `valid` that could not be scored, if there is one. */
	readonly newerUnscored: { readonly id: string; readonly createdAt: Date } | null
	readonly focus: Focus | null
	readonly skills: readonly SkillRow[]
	/** Overall scores, oldest first. */
	readonly trend: readonly {
		readonly id: string
		readonly createdAt: Date
		readonly score: number
	}[]
	readonly earlier: readonly EarlierAssessment[]
	readonly totals: {
		readonly uploads: number
		readonly sessions: number
		readonly prompts: number
		readonly assessments: number
	}
	readonly recentSessions: readonly RecentSession[]
	/** The newest upload, to offer scoring it. */
	readonly latestUploadId: string | null
	/** Only in the 'insufficient' stage: how far each skill is from being scored. */
	readonly insufficient: {
		readonly assessmentId: string
		readonly skillsAssessed: number
		readonly minSkills: number
		readonly needs: readonly EvidenceNeed[]
	} | null
}

function proficiencyOfScore(score: number | null): Proficiency | null {
	if (score == null) return null
	return PROFICIENCY_BANDS.find((band) => score >= band.min)?.level ?? 'needsImprovement'
}

function compareSkill(
	now: SkillAssessment,
	before: SkillAssessment | undefined,
	hasPrevious: boolean
): Comparison {
	if (!hasPrevious) return { status: 'unavailable', reason: 'noPrevious' }
	if (now.score == null) return { status: 'unavailable', reason: 'currentUnscored' }
	if (before?.score == null) return { status: 'unavailable', reason: 'previousUnscored' }
	const strong = now.confidence === 'strong' && before.confidence === 'strong'
	return { status: strong ? 'comparable' : 'provisional', delta: now.score - before.score }
}

function compareOverall(latest: StoredAssessment, previous: StoredAssessment | null): Comparison {
	if (previous == null) return { status: 'unavailable', reason: 'noPrevious' }
	if (latest.overallScore == null) return { status: 'unavailable', reason: 'currentUnscored' }
	if (previous.overallScore == null) return { status: 'unavailable', reason: 'previousUnscored' }
	const sameCoverage =
		latest.assessment.overall.skillsAssessed === previous.assessment.overall.skillsAssessed
	const allStrong = [...latest.assessment.skills, ...previous.assessment.skills]
		.filter((skill) => skill.score != null)
		.every((skill) => skill.confidence === 'strong')
	return {
		status: sameCoverage && allStrong ? 'comparable' : 'provisional',
		delta: latest.overallScore - previous.overallScore
	}
}

/**
 * The coaching focus of one assessment: its first recommendation (the weakest
 * reliably scored skill that has a quotable gap), with the quote that
 * recommendation points at. The quote must be in this same assessment, under the
 * same skill and criterion, or it is not shown.
 */
export function focusOf(assessment: StoredAssessment, uploadView: UploadView | null): Focus {
	const recommendation = assessment.assessment.recommendations[0]
	if (recommendation == null) return { kind: 'none' }
	const skill = assessment.assessment.skills.find((item) => item.skill === recommendation.skill)
	if (skill == null || skill.score == null) return { kind: 'none' }
	const evidence = skill.evidence.find(
		(item) => item.id === recommendation.evidenceId && item.criterion === recommendation.criterion
	)
	if (evidence == null) return { kind: 'missingQuote', skill: skill.skill, score: skill.score }
	const session = uploadView?.sessions.find((item) => item.sessionId === evidence.sessionId)
	return {
		kind: 'ready',
		skill: skill.skill,
		score: skill.score,
		proficiency: skill.proficiency,
		confidence: skill.confidence,
		observations: skill.observations,
		criterion: recommendation.criterion,
		seen: recommendation.count,
		of: recommendation.total,
		quote: {
			evidenceId: evidence.id,
			excerpt: evidence.excerpt,
			clippedBefore: evidence.clippedBefore,
			clippedAfter: evidence.clippedAfter,
			sessionId: evidence.sessionId,
			promptNumber: evidence.promptNumber,
			project: session?.project ?? null,
			startedAt: session?.startedAt ?? null
		}
	}
}

function skillRows(
	valid: StoredAssessment | null,
	previous: StoredAssessment | null,
	focus: Focus | null
): SkillRow[] {
	if (valid == null) return []
	const { strongest, weakest } = valid.assessment.overall
	const focusSkill = focus != null && focus.kind !== 'none' ? focus.skill : null
	return SKILL_IDS.flatMap((id) => {
		const skill = valid.assessment.skills.find((item) => item.skill === id)
		if (skill == null) return []
		const before = previous?.assessment.skills.find((item) => item.skill === id)
		return [
			{
				skill: id,
				score: skill.score,
				proficiency: skill.proficiency,
				confidence: skill.confidence,
				observations: skill.observations,
				comparison: compareSkill(skill, before, previous != null),
				isFocus: focusSkill === id,
				isStrongest: strongest === id && strongest !== weakest && focusSkill !== id
			}
		]
	})
}

function sessionTime(session: RecentSession): number {
	const time = session.startedAt == null ? Number.NaN : Date.parse(session.startedAt)
	return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time
}

function stageOf(
	uploads: readonly UploadSummary[],
	assessments: readonly AssessmentSummary[],
	valid: StoredAssessment | null
): DashboardStage {
	if (uploads.length === 0 && assessments.length === 0) return 'empty'
	if (assessments.length === 0) return 'toScore'
	return valid == null ? 'insufficient' : 'ready'
}

export function buildDashboard({
	uploads,
	assessments,
	newest,
	valid,
	previous,
	validUploadView,
	recentUploadViews
}: {
	uploads: readonly UploadSummary[]
	/** Newest first, as the workspace lists them. */
	assessments: readonly AssessmentSummary[]
	/** The newest assessment of all, scored or not. */
	newest: StoredAssessment | null
	/** The newest assessment that has an overall score, and the scored one before it. */
	valid: StoredAssessment | null
	previous: StoredAssessment | null
	/** The upload `valid` was made from, to name the session a quote came from. */
	validUploadView: UploadView | null
	recentUploadViews: readonly UploadView[]
}): DashboardModel {
	const stage = stageOf(uploads, assessments, valid)
	const focus = valid == null ? null : focusOf(valid, validUploadView)
	const newestFirst = assessments.toSorted((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
	const scored = assessments.filter(
		(assessment): assessment is AssessmentSummary & { overallScore: number } =>
			assessment.overallScore != null
	)
	const recentSessions = recentUploadViews
		.flatMap((view) =>
			view.sessions.map((session) => ({
				key: `${view.id}:${session.sessionId}`,
				sessionId: session.sessionId,
				project: session.project,
				startedAt: session.startedAt,
				promptCount: session.promptCount,
				minutes: session.sessionMinutes,
				uploadId: view.id
			}))
		)
		.toSorted((a, b) => sessionTime(b) - sessionTime(a))
		.slice(0, RECENT_SESSIONS)
	const needsFrom = stage === 'insufficient' ? newest : null

	return {
		stage,
		valid:
			valid == null || valid.overallScore == null
				? null
				: {
						id: valid.id,
						createdAt: valid.createdAt,
						score: valid.overallScore,
						proficiency: valid.assessment.overall.proficiency,
						sessions: valid.assessment.sessionCount,
						prompts: valid.assessment.promptCount,
						comparison: compareOverall(valid, previous)
					},
		newerUnscored:
			valid != null && newestFirst[0] != null && newestFirst[0].id !== valid.id
				? { id: newestFirst[0].id, createdAt: newestFirst[0].createdAt }
				: null,
		focus,
		skills: skillRows(valid, previous, focus),
		trend: scored
			.toSorted((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
			.slice(-TREND_POINTS)
			.map((assessment) => ({
				id: assessment.id,
				createdAt: assessment.createdAt,
				score: assessment.overallScore
			})),
		earlier: newestFirst
			.filter((assessment) => assessment.id !== valid?.id)
			.slice(0, EARLIER_ASSESSMENTS)
			.map((assessment) => ({
				id: assessment.id,
				createdAt: assessment.createdAt,
				score: assessment.overallScore,
				proficiency: proficiencyOfScore(assessment.overallScore)
			})),
		totals: {
			uploads: uploads.length,
			sessions: uploads.reduce((total, upload) => total + upload.sessionCount, 0),
			prompts: uploads.reduce((total, upload) => total + upload.promptCount, 0),
			assessments: assessments.length
		},
		recentSessions,
		latestUploadId: uploads[0]?.id ?? null,
		insufficient:
			needsFrom == null
				? null
				: {
						assessmentId: needsFrom.id,
						skillsAssessed: needsFrom.assessment.overall.skillsAssessed,
						minSkills: MIN_SKILLS_FOR_OVERALL,
						needs: SKILL_IDS.flatMap((id) => {
							const skill = needsFrom.assessment.skills.find((item) => item.skill === id)
							return skill == null
								? []
								: [
										{
											skill: id,
											observations: skill.observations,
											needed: EVIDENCE_THRESHOLDS[id].scoreFrom
										}
									]
						})
					}
	}
}

/** What to call the signed-in person: the part of their email before the @. */
export function displayName(email: string): string {
	const local = email.split('@')[0]?.trim()
	return local == null || local === '' ? email : local
}
