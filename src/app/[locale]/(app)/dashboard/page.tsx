import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import {
	buildDashboard,
	displayName,
	RECENT_UPLOADS_READ
} from '@/features/dashboard/dashboard-model'
import { DashboardView } from '@/features/dashboard/ui/dashboard-view'
import {
	getAssessment,
	getUploadView,
	listAssessments,
	listUploads
} from '@/features/workspace/workspace-data'
import { requireUser } from '@/server/auth/current-user'

export async function generateMetadata({
	params
}: {
	params: Promise<{ locale: string }>
}): Promise<Metadata> {
	const t = await getTranslations({ locale: (await params).locale, namespace: 'Dashboard' })
	return { title: { absolute: t('meta.title') } }
}

// Everything is read through workspace-data, scoped to the signed-in user, in
// two rounds: the lists first, then the assessments and uploads the page needs.
// The coaching comes from the newest assessment that has an overall score, and the
// scored one before it is the only comparison; a newer assessment that could not be
// scored is noted, not shown in place of the last good one.
export default async function DashboardPage() {
	const user = await requireUser()
	const [uploads, assessments] = await Promise.all([listUploads(user), listAssessments(user)])
	const newestSummary = assessments[0]
	const validIndex = assessments.findIndex((assessment) => assessment.overallScore != null)
	const validSummary = validIndex === -1 ? undefined : assessments[validIndex]
	const previousSummary = assessments
		.slice(validIndex + 1)
		.find((assessment) => assessment.overallScore != null)
	const [newest, valid, previous, validUploadView, views] = await Promise.all([
		newestSummary == null ? null : getAssessment(user, newestSummary.id),
		validSummary == null ? null : getAssessment(user, validSummary.id),
		validIndex === -1 || previousSummary == null ? null : getAssessment(user, previousSummary.id),
		validSummary == null ? null : getUploadView(user, validSummary.uploadId),
		Promise.all(
			uploads.slice(0, RECENT_UPLOADS_READ).map((upload) => getUploadView(user, upload.id))
		)
	])
	const model = buildDashboard({
		uploads,
		assessments,
		newest,
		valid,
		previous,
		validUploadView,
		recentUploadViews: views.filter((view) => view != null)
	})
	return <DashboardView name={displayName(user.email)} model={model} />
}
