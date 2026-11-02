import type { Metadata } from 'next'
import { useTranslations } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import { AssessmentWorkspace } from '@/features/assessment/ui/assessment-workspace'

export async function generateMetadata({
	params
}: {
	params: Promise<{ locale: string }>
}): Promise<Metadata> {
	const t = await getTranslations({ locale: (await params).locale, namespace: 'Assessment' })
	return { title: { absolute: t('meta.title') } }
}

export default function AssessmentPage() {
	const t = useTranslations('Assessment')

	return (
		<main className="flex flex-col gap-16 px-5 py-14 md:px-14 md:py-20">
			<header className="flex flex-col gap-8">
				<p className="app-eyebrow">
					<b>01</b> — {t('eyebrow')}
				</p>
				<div className="grid items-end gap-8 lg:grid-cols-2">
					<h1 className="app-display">{t('title')}</h1>
					<div className="flex max-w-xl flex-col gap-4">
						<p className="text-lg leading-relaxed">{t('intro')}</p>
						<p className="text-text-muted text-sm leading-relaxed">{t('privacy')}</p>
					</div>
				</div>
			</header>
			<AssessmentWorkspace />
		</main>
	)
}
