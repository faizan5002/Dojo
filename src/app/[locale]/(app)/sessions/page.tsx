import type { Metadata } from 'next'
import { useTranslations } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import { SessionIntake } from '@/features/sessions/session-intake'

export async function generateMetadata({
	params
}: {
	params: Promise<{ locale: string }>
}): Promise<Metadata> {
	const t = await getTranslations({ locale: (await params).locale, namespace: 'Sessions' })
	return { title: { absolute: t('meta.title') } }
}

export default function SessionsPage() {
	const t = useTranslations('Sessions')

	return (
		<main className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-12">
			<header className="flex max-w-3xl flex-col gap-3">
				<h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
				<p className="text-text-muted">{t('intro')}</p>
				<p className="text-text-faint text-sm">{t('privacy')}</p>
			</header>
			<SessionIntake />
		</main>
	)
}
