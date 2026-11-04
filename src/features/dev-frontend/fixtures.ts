// Sample workspace data for frontend development (see
// server/auth/dev-frontend-mode.ts). Fully deterministic: fixed ids, fixed dates,
// and the real, pure scoring and metrics code run over synthetic sessions, so the
// shapes are exactly what the database path returns. Nothing here is ever written
// to PostgreSQL or Supabase, and nothing reads a real log (docs/SESSION_LOGGING.md).
import { assessSessions } from '@/features/assessment/assess'
import { STRONG_PROMPTS, WEAK_PROMPTS } from '@/features/assessment/session-fixtures'
import { metricsOverview, sessionMetrics } from '@/features/sessions/metrics'
import type { ParsedSession } from '@/features/sessions/types'
import type {
	AssessmentSummary,
	StoredAssessment,
	UploadSummary,
	UploadView
} from '@/features/workspace/repository'

const MINUTES_BETWEEN_PROMPTS = 4

function sessionOn({
	sessionId,
	project,
	start,
	prompts
}: {
	sessionId: string
	project: string
	start: string
	prompts: readonly string[]
}): ParsedSession {
	const base = Date.parse(start)
	const at = (minute: number) => new Date(base + minute * 60_000).toISOString()
	return {
		sessionId,
		agent: 'claude',
		project,
		generatedAt: at(0),
		turns: prompts.map((text, index) => ({
			prompt: { timestamp: at(index * MINUTES_BETWEEN_PROMPTS), text },
			response: {
				timestamp: at(index * MINUTES_BETWEEN_PROMPTS + 1),
				text: 'Done. I changed the files and ran the checks.'
			}
		}))
	}
}

const LOGIN = sessionOn({
	sessionId: 'dev-login-page',
	project: 'dojo-web',
	start: '2026-10-12T09:00:00Z',
	prompts: WEAK_PROMPTS
})
const CSV = sessionOn({
	sessionId: 'dev-csv-export',
	project: 'dojo-web',
	start: '2026-10-20T13:30:00Z',
	prompts: STRONG_PROMPTS
})
const IMPORT = sessionOn({
	sessionId: 'dev-import-page',
	project: 'dojo-web',
	start: '2026-10-29T10:00:00Z',
	prompts: STRONG_PROMPTS.slice(0, 6)
})
const QUICK = sessionOn({
	sessionId: 'dev-quick-fixes',
	project: 'scripts',
	start: '2026-10-29T15:00:00Z',
	prompts: WEAK_PROMPTS.slice(0, 5)
})

interface FixtureUpload {
	readonly id: string
	readonly createdAt: Date
	readonly files: readonly { fileName: string; reason?: 'not-markdown' | 'empty' }[]
	readonly sessions: readonly ParsedSession[]
}

const UPLOADS: readonly FixtureUpload[] = [
	{
		id: '00000000-0000-4000-8000-0000000d0003',
		createdAt: new Date('2026-10-29T16:30:00Z'),
		files: [
			{ fileName: 'import-page.md' },
			{ fileName: 'quick-fixes.md' },
			{ fileName: 'notes.txt', reason: 'not-markdown' },
			{ fileName: 'empty-session.md', reason: 'empty' }
		],
		sessions: [IMPORT, QUICK]
	},
	{
		id: '00000000-0000-4000-8000-0000000d0002',
		createdAt: new Date('2026-10-20T14:10:00Z'),
		files: [{ fileName: 'csv-export.md' }],
		sessions: [CSV]
	},
	{
		id: '00000000-0000-4000-8000-0000000d0001',
		createdAt: new Date('2026-10-12T10:00:00Z'),
		files: [{ fileName: 'login-page.md' }],
		sessions: [LOGIN]
	}
]

const ASSESSED_AT: Readonly<Record<string, Date>> = {
	'00000000-0000-4000-8000-0000000d0003': new Date('2026-10-29T16:45:00Z'),
	'00000000-0000-4000-8000-0000000d0002': new Date('2026-10-20T14:20:00Z'),
	'00000000-0000-4000-8000-0000000d0001': new Date('2026-10-12T10:10:00Z')
}

const assessmentIdOf = (uploadId: string) => uploadId.replace('d000', 'a000')

const countOf = (upload: FixtureUpload) => upload.sessions.length

function toSummary(upload: FixtureUpload): UploadSummary {
	const overview = metricsOverview(upload.sessions)
	return {
		id: upload.id,
		createdAt: upload.createdAt,
		fileCount: upload.files.length,
		sessionCount: countOf(upload),
		promptCount: overview.promptCount,
		redactionCount: 0,
		assessmentCount: 1
	}
}

export const DEV_UPLOADS: readonly UploadSummary[] = UPLOADS.map(toSummary)

export function devUploadView(uploadId: string | undefined): UploadView | null {
	const upload = uploadId == null ? UPLOADS[0] : UPLOADS.find((item) => item.id === uploadId)
	if (upload == null) return null
	return {
		...toSummary(upload),
		rejected: upload.files.flatMap((file) =>
			file.reason == null ? [] : [{ fileName: file.fileName, reason: file.reason }]
		),
		overview: metricsOverview(upload.sessions),
		sessions: upload.sessions.map(sessionMetrics)
	}
}

const STORED: readonly StoredAssessment[] = UPLOADS.map((upload) => {
	const assessment = assessSessions(upload.sessions)
	return {
		id: assessmentIdOf(upload.id),
		uploadId: upload.id,
		createdAt: ASSESSED_AT[upload.id] ?? upload.createdAt,
		overallScore: assessment.overall.score,
		rubricVersion: assessment.rubricVersion,
		assessment,
		overview: metricsOverview(upload.sessions)
	}
})

export const DEV_ASSESSMENTS: readonly AssessmentSummary[] = STORED.map(
	({ id, uploadId, createdAt, overallScore, rubricVersion }) => ({
		id,
		uploadId,
		createdAt,
		overallScore,
		rubricVersion
	})
)

export function devAssessment(assessmentId: string | undefined): StoredAssessment | null {
	if (assessmentId == null) return STORED[0] ?? null
	return STORED.find((item) => item.id === assessmentId) ?? null
}
