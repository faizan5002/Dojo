import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { z } from 'zod'
import { PageHeader, SectionHeading } from '@/features/app-shell/section'
import { MAX_LOG_FILE_BYTES, MAX_LOG_FILES } from '@/features/sessions/limits'
import { SessionIntake } from '@/features/sessions/session-intake'
import { SessionMetricsView } from '@/features/sessions/session-metrics-view'
import { UploadList } from '@/features/sessions/upload-list'
import { getUploadView, listUploads } from '@/features/workspace/repository'
import { requireUser } from '@/server/auth/current-user'
import { db } from '@/server/db/client'

const BYTES_PER_MEGABYTE = 1024 * 1024
const uuid = z.string().uuid()

export async function generateMetadata({
	params
}: {
	params: Promise<{ locale: string }>
}): Promise<Metadata> {
	const t = await getTranslations({ locale: (await params).locale, namespace: 'Sessions' })
	return { title: { absolute: t('meta.title') } }
}

export default async function SessionsPage({
	searchParams
}: {
	searchParams: Promise<{ upload?: string }>
}) {
	const user = await requireUser()
	const t = await getTranslations('Sessions')
	const requested = uuid.safeParse((await searchParams).upload)
	const [uploads, view] = await Promise.all([
		listUploads({ db, userId: user.id }),
		getUploadView({
			db,
			userId: user.id,
			uploadId: requested.success ? requested.data : undefined
		})
	])

	return (
		<main className="flex flex-col gap-16 px-5 py-14 md:px-14 md:py-20">
			<PageHeader
				eyebrow={t('eyebrow')}
				title={t('title')}
				intro={t('intro')}
				note={t('privacy')}
			/>
			<SessionIntake selectedUploadId={view?.id ?? null} />
			{view == null ? (
				<p className="text-text-muted">{requested.success ? t('uploadMissing') : t('empty')}</p>
			) : (
				<>
					<p className="text-text-muted -mt-8 text-sm">
						{t('saved', { redactions: view.redactionCount })}
					</p>
					<SessionMetricsView
						overview={view.overview}
						sessions={view.sessions}
						rejected={view.rejected}
						maxFiles={MAX_LOG_FILES}
						maxMegabytes={MAX_LOG_FILE_BYTES / BYTES_PER_MEGABYTE}
					/>
				</>
			)}
			{uploads.length === 0 ? null : (
				<section aria-labelledby="uploads-heading" className="flex flex-col gap-8">
					<SectionHeading id="uploads-heading" number="05">
						{t('history')}
					</SectionHeading>
					<UploadList uploads={uploads} selectedId={view?.id ?? null} />
				</section>
			)}
		</main>
	)
}
