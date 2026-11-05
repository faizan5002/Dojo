import { getTranslations } from 'next-intl/server'
import { SpinnerIcon } from '@/components/ui/icons'

export default async function PromptingGuruLoading() {
	const t = await getTranslations('Guru')
	return (
		<main className="flex items-center gap-3 px-5 py-14 md:px-14 md:py-20" aria-busy="true">
			<SpinnerIcon size={16} className="animate-spin" />
			<p className="text-text-muted">{t('loading')}</p>
		</main>
	)
}
