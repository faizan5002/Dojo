import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { ScenarioView } from '@/features/practice/ui/scenario-view'
import { loadSample } from '@/features/sample/sample-session'
import { SampleBanner } from '@/features/sample/ui/sample-banner'

export async function generateMetadata({
	params
}: {
	params: Promise<{ locale: string }>
}): Promise<Metadata> {
	const t = await getTranslations({ locale: (await params).locale, namespace: 'Practice.session' })
	return { title: { absolute: t('meta.sampleTitle') } }
}

// The same scenario practice, built from the sample assessment. Public and read-only;
// answers stay in the tab and nothing reaches an account.
export default async function SamplePracticeSessionPage() {
	const { stored } = await loadSample()
	return (
		<>
			<SampleBanner />
			<ScenarioView
				stored={stored}
				emptyHref="/sample"
				links={{
					assessment: '/sample/assessment',
					conversation: '/sample/session',
					drill: '/sample/practice',
					upload: '/sessions',
					restart: '/sample/practice/session'
				}}
			/>
		</>
	)
}
