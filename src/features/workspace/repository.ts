import type { Prisma, PrismaClient, UploadMetrics } from '@prisma/client'
import { assessSessions } from '@/features/assessment/assess'
import { proficiencyOf, SKILL_IDS } from '@/features/assessment/rubric'
import type { Assessment } from '@/features/assessment/types'
import {
	metricsOverview,
	sessionMetrics,
	type MetricsOverview,
	type SessionMetrics
} from '@/features/sessions/metrics'
import type { ParsedSession, RejectionReason } from '@/features/sessions/types'
import { countRedactions, redactSessions } from './redact-sessions'
import {
	evidenceListSchema,
	parsedSessionSchema,
	profileSchema,
	recommendationsSchema,
	sessionMetricsListSchema,
	talliesSchema,
	turnsSchema,
	uploadFilesSchema,
	type UploadInput
} from './stored'

// Every read, write and delete of a user's workspace. Each function takes the
// caller's user id from the authenticated session (never from the request)
// and scopes every query to it, so an id guessed from another account finds
// nothing. The Prisma client is passed in so tests can run these against a
// test database.

type Db = PrismaClient
type Owner = { db: Db; userId: string }

export interface UploadSummary {
	readonly id: string
	readonly createdAt: Date
	readonly fileCount: number
	readonly sessionCount: number
	readonly promptCount: number
	readonly redactionCount: number
	readonly assessmentCount: number
}

export interface UploadView extends UploadSummary {
	readonly rejected: readonly { readonly fileName: string; readonly reason: RejectionReason }[]
	readonly overview: MetricsOverview
	readonly sessions: readonly SessionMetrics[]
}

export interface AssessmentSummary {
	readonly id: string
	readonly uploadId: string
	readonly createdAt: Date
	readonly overallScore: number | null
	readonly rubricVersion: string
}

export interface StoredAssessment extends AssessmentSummary {
	readonly assessment: Assessment
	readonly overview: MetricsOverview | null
}

const toJson = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value))

function promptCountOf(session: ParsedSession): number {
	return session.turns.filter((turn) => turn.prompt != null).length
}

function startedAtOf(session: ParsedSession): Date | null {
	const first = session.turns.find((turn) => turn.prompt?.timestamp)?.prompt?.timestamp
	const time = first == null ? Number.NaN : Date.parse(first)
	return Number.isNaN(time) ? null : new Date(time)
}

/**
 * Stores one upload: redacts again, recomputes the free metrics from the
 * redacted sessions, and writes the upload, its sessions and its metrics in
 * one transaction. Returns the new upload's id.
 */
export async function saveUpload({
	db,
	userId,
	input
}: Owner & { input: UploadInput }): Promise<string> {
	const sessions = redactSessions(input.sessions)
	const perSession = sessions.map(sessionMetrics)
	const overview = metricsOverview(sessions)
	const upload = await db.upload.create({
		data: {
			userId,
			files: toJson(input.files),
			sessionCount: sessions.length,
			promptCount: overview.promptCount,
			redactionCount: countRedactions(sessions),
			sessions: {
				create: sessions.map((session) => ({
					userId,
					externalId: session.sessionId,
					agent: session.agent,
					project: session.project,
					generatedAt: session.generatedAt,
					startedAt: startedAtOf(session),
					promptCount: promptCountOf(session),
					turns: toJson(session.turns)
				}))
			},
			metrics: {
				create: {
					userId,
					sessionCount: overview.sessionCount,
					promptCount: overview.promptCount,
					responseCount: overview.responseCount,
					averagePromptWords: overview.averagePromptWords,
					pasteRatio: overview.pasteRatio,
					promptToResponseRatio: overview.promptToResponseRatio,
					averageGapMinutes: overview.averageGapMinutes,
					longestGapMinutes: overview.longestGapMinutes,
					codeBlocksPerPrompt: overview.codeBlocksPerPrompt,
					filePathsPerPrompt: overview.filePathsPerPrompt,
					urlsPerPrompt: overview.urlsPerPrompt,
					sessions: toJson(perSession)
				}
			}
		},
		select: { id: true }
	})
	return upload.id
}

export async function listUploads({ db, userId }: Owner): Promise<UploadSummary[]> {
	const rows = await db.upload.findMany({
		where: { userId },
		orderBy: { createdAt: 'desc' },
		include: { _count: { select: { assessments: true } } }
	})
	return rows.map((row) => ({
		id: row.id,
		createdAt: row.createdAt,
		fileCount: uploadFilesSchema.parse(row.files).length,
		sessionCount: row.sessionCount,
		promptCount: row.promptCount,
		redactionCount: row.redactionCount,
		assessmentCount: row._count.assessments
	}))
}

function overviewOf(row: UploadMetrics): MetricsOverview {
	return {
		sessionCount: row.sessionCount,
		promptCount: row.promptCount,
		responseCount: row.responseCount,
		averagePromptWords: row.averagePromptWords,
		pasteRatio: row.pasteRatio,
		promptToResponseRatio: row.promptToResponseRatio,
		averageGapMinutes: row.averageGapMinutes,
		longestGapMinutes: row.longestGapMinutes,
		codeBlocksPerPrompt: row.codeBlocksPerPrompt,
		filePathsPerPrompt: row.filePathsPerPrompt,
		urlsPerPrompt: row.urlsPerPrompt
	}
}

/** The given upload, or the latest one when no id is given; null if not the caller's. */
export async function getUploadView({
	db,
	userId,
	uploadId
}: Owner & { uploadId?: string }): Promise<UploadView | null> {
	const row = await db.upload.findFirst({
		where: { userId, ...(uploadId == null ? {} : { id: uploadId }) },
		orderBy: { createdAt: 'desc' },
		include: { metrics: true, _count: { select: { assessments: true } } }
	})
	if (row == null || row.metrics == null) return null
	const files = uploadFilesSchema.parse(row.files)
	return {
		id: row.id,
		createdAt: row.createdAt,
		fileCount: files.length,
		sessionCount: row.sessionCount,
		promptCount: row.promptCount,
		redactionCount: row.redactionCount,
		assessmentCount: row._count.assessments,
		rejected: files.flatMap((file) =>
			file.reason == null ? [] : [{ fileName: file.fileName, reason: file.reason }]
		),
		overview: overviewOf(row.metrics),
		sessions: sessionMetricsListSchema.parse(row.metrics.sessions)
	}
}

/** Deletes the caller's upload and, by cascade, its sessions, metrics and assessments. */
export async function deleteUpload({
	db,
	userId,
	uploadId
}: Owner & { uploadId: string }): Promise<boolean> {
	const { count } = await db.upload.deleteMany({ where: { id: uploadId, userId } })
	return count > 0
}

/** The caller's stored sessions for an upload, as the parser produced them (redacted). */
export async function loadSessions({
	db,
	userId,
	uploadId
}: Owner & { uploadId: string }): Promise<ParsedSession[]> {
	const rows = await db.agentSession.findMany({
		where: { uploadId, userId },
		orderBy: [{ startedAt: 'asc' }, { createdAt: 'asc' }]
	})
	return rows.map((row) =>
		parsedSessionSchema.parse({
			sessionId: row.externalId,
			agent: row.agent,
			project: row.project,
			generatedAt: row.generatedAt,
			turns: turnsSchema.parse(row.turns)
		})
	)
}

/**
 * Scores the caller's upload with the rubric engine and stores the result as
 * a new snapshot. Returns its id, or null when the upload is not the caller's.
 */
export async function runAssessment({
	db,
	userId,
	uploadId
}: Owner & { uploadId: string }): Promise<string | null> {
	const upload = await db.upload.findFirst({
		where: { id: uploadId, userId },
		select: { id: true, redactionCount: true }
	})
	if (upload == null) return null
	const result = assessSessions(await loadSessions({ db, userId, uploadId }))
	const created = await db.assessment.create({
		data: {
			userId,
			uploadId,
			rubricVersion: result.rubricVersion,
			overallScore: result.overall.score,
			proficiency: result.overall.proficiency,
			skillsAssessed: result.overall.skillsAssessed,
			strongestSkill: result.overall.strongest,
			weakestSkill: result.overall.weakest,
			sessionCount: result.sessionCount,
			promptCount: result.promptCount,
			redactionCount: upload.redactionCount + result.redactions,
			profile: toJson(result.profile),
			recommendations: toJson(result.recommendations),
			skills: {
				create: result.skills.map((skill) => ({
					userId,
					skill: skill.skill,
					score: skill.score,
					proficiency: skill.proficiency,
					confidence: skill.confidence,
					observations: skill.observations,
					tallies: toJson(skill.tallies),
					evidence: toJson(skill.evidence)
				}))
			}
		},
		select: { id: true }
	})
	return created.id
}

export async function listAssessments({ db, userId }: Owner): Promise<AssessmentSummary[]> {
	const rows = await db.assessment.findMany({
		where: { userId },
		orderBy: { createdAt: 'desc' },
		select: {
			id: true,
			uploadId: true,
			createdAt: true,
			overallScore: true,
			rubricVersion: true
		}
	})
	return rows
}

const CONFIDENCE = ['strong', 'limited', 'insufficient'] as const

function confidenceOf(value: string): (typeof CONFIDENCE)[number] {
	const match = CONFIDENCE.find((level) => level === value)
	if (match == null) throw new Error(`Stored confidence "${value}" is not a known level`)
	return match
}

/** The given assessment, or the latest when no id is given; null if not the caller's. */
export async function getAssessment({
	db,
	userId,
	assessmentId
}: Owner & { assessmentId?: string }): Promise<StoredAssessment | null> {
	const row = await db.assessment.findFirst({
		where: { userId, ...(assessmentId == null ? {} : { id: assessmentId }) },
		orderBy: { createdAt: 'desc' },
		include: { skills: true, upload: { include: { metrics: true } } }
	})
	if (row == null) return null
	const skills = SKILL_IDS.flatMap((id) => {
		const stored = row.skills.find((skill) => skill.skill === id)
		if (stored == null) return []
		return [
			{
				skill: id,
				score: stored.score,
				proficiency: stored.score == null ? null : proficiencyOf(stored.score),
				confidence: confidenceOf(stored.confidence),
				observations: stored.observations,
				tallies: talliesSchema.parse(stored.tallies),
				evidence: evidenceListSchema.parse(stored.evidence)
			}
		]
	})
	return {
		id: row.id,
		uploadId: row.uploadId,
		createdAt: row.createdAt,
		overallScore: row.overallScore,
		rubricVersion: row.rubricVersion,
		overview: row.upload.metrics == null ? null : overviewOf(row.upload.metrics),
		assessment: {
			rubricVersion: row.rubricVersion,
			sessionCount: row.sessionCount,
			promptCount: row.promptCount,
			redactions: row.redactionCount,
			overall: {
				score: row.overallScore,
				proficiency: row.overallScore == null ? null : proficiencyOf(row.overallScore),
				skillsAssessed: row.skillsAssessed,
				strongest: SKILL_IDS.find((id) => id === row.strongestSkill) ?? null,
				weakest: SKILL_IDS.find((id) => id === row.weakestSkill) ?? null
			},
			skills,
			profile: profileSchema.parse(row.profile),
			recommendations: recommendationsSchema.parse(row.recommendations)
		}
	}
}

/** Deletes the caller's user row and, by cascade, every upload and assessment. */
export async function deleteUserData({ db, userId }: Owner): Promise<void> {
	await db.user.deleteMany({ where: { id: userId } })
}
