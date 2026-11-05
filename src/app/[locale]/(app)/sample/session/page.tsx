import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/features/app-shell/section'
import { buildSessionView, pickSession } from '@/features/review/session-view'
import { SessionReviewer } from '@/features/review/ui/session-reviewer'
import { loadSample } from '@/features/sample/sample-session'
import { SampleBanner } from '@/features/sample/ui/sample-banner'
import { Link } from '@/i18n/routing'

const MAX_PARAM_CHARS = 128

export async function generateMetadata({
	params
}: {
	params: Promise<{ locale: string }>
}): Promise<Metadata> {
	const t = await getTranslations({ locale: (await params).locale, namespace: 'Review' })
	return { title: { absolute: t('meta.sampleTitle') } }
}

// The sample's conversation with its findings. Public and read-only; the reviewer's
// marks and notes stay in this browser under the `sample` scope and never reach an account.
export default async function SampleSessionPage({
	searchParams
}: {
	searchParams: Promise<{ session?: string; finding?: string }>
}) {
	const t = await getTranslations('Review')
	const params = await searchParams
	const { stored, sessions } = await loadSample()
	const clip = (value: string | undefined) => value?.slice(0, MAX_PARAM_CHARS)
	const session = pickSession(sessions, stored.assessment.skills, {
		sessionId: clip(params.session),
		findingId: clip(params.finding)
	})
	if (session == null) notFound()
	const view = buildSessionView(session, stored.assessment.skills)

	return (
		<>
			<SampleBanner />
			<main className="flex flex-col gap-12 px-5 py-14 md:px-14 md:py-20">
				<PageHeader eyebrow={t('eyebrow')} title={t('title')} intro={t('sampleIntro')} />
				<SessionReviewer
					view={view}
					scope="sample"
					scopeNote="sample"
					initialFindingId={clip(params.finding) ?? null}
					links={{
						assessment: '/sample/assessment',
						practice: '/sample/practice/session'
					}}
				/>
				<div className="flex flex-wrap items-center gap-x-8 gap-y-3">
					<Link href="/sample/assessment" className="app-nav-link">
						{t('backToAssessment')}
					</Link>
				</div>
			</main>
		</>
	)
}
