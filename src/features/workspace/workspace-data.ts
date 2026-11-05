import 'server-only'
import {
	DEV_ASSESSMENTS,
	DEV_UPLOADS,
	devAssessment,
	devSessions,
	devUploadView
} from '@/features/dev-frontend/fixtures'
import type { ParsedSession } from '@/features/sessions/types'
import { isDevMockUser } from '@/server/auth/dev-frontend-mode'
import { db } from '@/server/db/client'
import {
	getAssessment as getStoredAssessment,
	getUploadView as getStoredUploadView,
	listAssessments as listStoredAssessments,
	listUploads as listStoredUploads,
	loadSessions,
	type AssessmentSummary,
	type StoredAssessment,
	type UploadSummary,
	type UploadView
} from './repository'

// The one place the app pages read a workspace from. A real user always reads
// their own rows through the repository (every query scoped to their id). Only
// the labelled mock user of the development frontend mode reads fixtures, and
// that user cannot exist in a production build (server/auth/dev-frontend-mode.ts).

type Reader = { id: string }

export async function listUploads(user: Reader): Promise<UploadSummary[]> {
	if (isDevMockUser(user)) return [...DEV_UPLOADS]
	return listStoredUploads({ db, userId: user.id })
}

export async function getUploadView(
	user: Reader,
	uploadId: string | undefined
): Promise<UploadView | null> {
	if (isDevMockUser(user)) return devUploadView(uploadId)
	return getStoredUploadView({ db, userId: user.id, uploadId })
}

export async function listAssessments(user: Reader): Promise<AssessmentSummary[]> {
	if (isDevMockUser(user)) return [...DEV_ASSESSMENTS]
	return listStoredAssessments({ db, userId: user.id })
}

export async function getAssessment(
	user: Reader,
	assessmentId: string | undefined
): Promise<StoredAssessment | null> {
	if (isDevMockUser(user)) return devAssessment(assessmentId)
	return getStoredAssessment({ db, userId: user.id, assessmentId })
}

/**
 * The redacted sessions behind an assessment, for the conversation viewer. The
 * assessment was already read for this user, and the sessions are read scoped to
 * the same user again, so another account's upload finds nothing.
 */
export async function getAssessmentSessions(
	user: Reader,
	assessment: StoredAssessment
): Promise<readonly ParsedSession[]> {
	if (isDevMockUser(user)) return devSessions(assessment.uploadId)
	return loadSessions({ db, userId: user.id, uploadId: assessment.uploadId })
}
