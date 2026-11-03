import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/features/app-shell/section'
import { AssessmentReport } from '@/features/assessment/ui/assessment-report'
import { focusOf } from '@/features/dashboard/dashboard-model'
import { FocusNext } from '@/features/dashboard/ui/focus-next'
import { SAMPLE_ASSESSMENT_ID, loadSample } from '@/features/sample/sample-session'
import { SampleBanner } from '@/features/sample/ui/sample-banner'
import { Link } from '@/i18n/routing'

export async function generateMetadata({
	params
}: {
	params: Promise<{ locale: string }>
}): Promise<Metadata> {
	const t = await getTranslations({ locale: (await params).locale, namespace: 'Sample' })
	return { title: { absolute: t('meta.assessmentTitle') } }
}

// The sample, scored by the real rules on every request. Public and read-only:
// the result is computed here and shown; it is never stored and belongs to no one.
export default async function SampleAssessmentPage() {
	const t = await getTranslations('Sample')
	const { stored } = await loadSample()
	const focus = focusOf(stored, null)
	return (
		<>
			<SampleBanner />
			<main className="flex flex-col gap-16 px-5 py-14 md:px-14 md:py-20">
				<PageHeader
					eyebrow={t('assessment.eyebrow')}
					title={t('assessment.title')}
					intro={t('assessment.intro')}
				/>
				<FocusNext
					focus={focus}
					assessmentId={SAMPLE_ASSESSMENT_ID}
					links={{
						overview: '/sample/assessment',
						evidence:
							focus.kind === 'none'
								? '/sample/assessment'
								: `/sample/assessment#skill-${focus.skill}`,
						practise: '/sample/practice'
					}}
				/>
				<AssessmentReport assessment={stored.assessment} overview={stored.overview} />
				<div className="flex flex-wrap items-center gap-x-8 gap-y-4">
					<Link href="/sessions" className="app-pill">
						{t('assessment.useOwn')}
					</Link>
					<Link href="/sample" className="app-nav-link">
						{t('assessment.backToSample')}
					</Link>
				</div>
			</main>
		</>
	)
}
