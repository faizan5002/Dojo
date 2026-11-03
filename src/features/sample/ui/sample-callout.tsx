import { useTranslations } from 'next-intl'
import { ArrowUpRightIcon } from '@/components/ui/icons'
import { Link } from '@/i18n/routing'

/** The way in for a visitor who has no logs yet: shown on the sign-in and sign-up pages. */
export function SampleCallout() {
	const t = useTranslations('Sample.callout')
	return (
		<aside
			aria-label={t('action')}
			className="border-border flex max-w-xl flex-col items-start gap-4 border p-5"
		>
			<p className="text-text-muted text-sm">{t('text')}</p>
			<Link href="/sample" className="app-pill">
				{t('action')}
				<ArrowUpRightIcon size={14} />
			</Link>
		</aside>
	)
}
