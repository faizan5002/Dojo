import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { PracticeView } from '@/features/practice/ui/practice-view'
import { loadSample } from '@/features/sample/sample-session'
import { SampleBanner } from '@/features/sample/ui/sample-banner'

export async function generateMetadata({
	params
}: {
	params: Promise<{ locale: string }>
}): Promise<Metadata> {
	const t = await getTranslations({ locale: (await params).locale, namespace: 'Sample' })
	return { title: { absolute: t('meta.practiceTitle') } }
}

// The same drill as the signed-in /practice, on the sample assessment. The check
// runs in the tab; nothing is sent or saved.
export default async function SamplePracticePage() {
	const { stored } = await loadSample()
	return (
		<>
			<SampleBanner />
			<PracticeView
				stored={stored}
				emptyHref="/sample"
				scenariosHref="/sample/practice/session"
				evidenceHref={(skill) => `/sample/assessment#skill-${skill}`}
			/>
		</>
	)
}
