import { useTranslations } from 'next-intl'
import { KageLanding } from '@/features/landing/kage-landing'
import { RedMoonStory } from '@/features/landing/red-moon-story'
import { pageMetadata } from '@/lib/seo/metadata'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
	return pageMetadata({ path: '/', locale: (await params).locale })
}

export default function HomePage() {
	const t = useTranslations('HomePage')

	return (
		<main>
			<h1 className="sr-only">{t('title')}</h1>
			<p className="sr-only">{t('description')}</p>
			<KageLanding />
			<RedMoonStory />
		</main>
	)
}
