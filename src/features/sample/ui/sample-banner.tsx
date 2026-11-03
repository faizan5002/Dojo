import { useTranslations } from 'next-intl'

/** Marks every sample page as demonstration data, above the page's content. */
export function SampleBanner() {
	const t = useTranslations('Sample')
	return (
		<p
			role="note"
			data-testid="sample-banner"
			className="border-border text-text-muted border-b px-5 py-2 text-center text-xs md:px-14"
		>
			{t('banner')}
		</p>
	)
}
