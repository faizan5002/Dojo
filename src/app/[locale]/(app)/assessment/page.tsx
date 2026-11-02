import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { z } from 'zod'
import { ArrowUpRightIcon } from '@/components/ui/icons'
import { PageHeader, SectionHeading } from '@/features/app-shell/section'
import { AssessmentHistory } from '@/features/assessment/ui/assessment-history'
import { AssessmentReport } from '@/features/assessment/ui/assessment-report'
import { RunAssessmentPanel } from '@/features/assessment/ui/run-assessment-panel'
import { getAssessment, listAssessments, listUploads } from '@/features/workspace/repository'
import { Link } from '@/i18n/routing'
import { requireUser } from '@/server/auth/current-user'
import { db } from '@/server/db/client'

const uuid = z.string().uuid()

export async function generateMetadata({
	params
}: {
	params: Promise<{ locale: string }>
}): Promise<Metadata> {
	const t = await getTranslations({ locale: (await params).locale, namespace: 'Assessment' })
	return { title: { absolute: t('meta.title') } }
}

// ?upload=<id> offers to score that upload; ?id=<id> opens a saved assessment;
// neither opens the latest assessment, or offers to score the latest upload.
// Every lookup is scoped to the signed-in user, so another account's id is a 404.
export default async function AssessmentPage({
	searchParams
}: {
	searchParams: Promise<{ id?: string; upload?: string }>
}) {
	const user = await requireUser()
	const t = await getTranslations('Assessment')
	const params = await searchParams
	const requestedAssessment = uuid.safeParse(params.id)
	const requestedUpload = uuid.safeParse(params.upload)
	const [assessments, uploads] = await Promise.all([
		listAssessments({ db, userId: user.id }),
		listUploads({ db, userId: user.id })
	])

	const uploadToScore = requestedUpload.success
		? uploads.find((upload) => upload.id === requestedUpload.data)
		: undefined
	if (requestedUpload.success && uploadToScore == null) notFound()
	const selected =
		uploadToScore != null
			? null
			: await getAssessment({
					db,
					userId: user.id,
					assessmentId: requestedAssessment.success ? requestedAssessment.data : undefined
				})
	if (requestedAssessment.success && selected == null) notFound()
	const latestUpload = uploads[0]

	return (
		<main className="flex flex-col gap-16 px-5 py-14 md:px-14 md:py-20">
			<PageHeader
				eyebrow={t('eyebrow')}
				title={t('title')}
				intro={t('intro')}
				note={t('privacy')}
			/>
			{uploadToScore != null ? (
				<RunAssessmentPanel uploadId={uploadToScore.id} sessionCount={uploadToScore.sessionCount} />
			) : selected != null ? (
				<>
					<div className="-mt-8 flex flex-wrap items-center gap-4">
						<Link href={`/assessment?upload=${selected.uploadId}`} className="app-pill">
							{t('overall.rerun')}
							<ArrowUpRightIcon size={14} />
						</Link>
						<p className="text-text-muted text-sm">{t('saved')}</p>
					</div>
					<AssessmentReport assessment={selected.assessment} overview={selected.overview} />
				</>
			) : latestUpload != null ? (
				<RunAssessmentPanel uploadId={latestUpload.id} sessionCount={latestUpload.sessionCount} />
			) : (
				<section className="border-border flex flex-col gap-5 border-y py-10">
					<h2 className="app-heading">{t('empty.title')}</h2>
					<p className="text-text-muted max-w-2xl">{t('empty.body')}</p>
					<Link href="/sessions" className="app-pill">
						{t('empty.action')}
						<ArrowUpRightIcon size={14} />
					</Link>
				</section>
			)}
			{assessments.length === 0 ? null : (
				<section aria-labelledby="history-heading" className="flex flex-col gap-8">
					<SectionHeading id="history-heading" number="07">
						{t('history.heading')}
					</SectionHeading>
					<AssessmentHistory assessments={assessments} selectedId={selected?.id ?? null} />
				</section>
			)}
		</main>
	)
}
