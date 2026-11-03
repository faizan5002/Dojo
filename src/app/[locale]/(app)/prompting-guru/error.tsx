'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { captureClientError } from '@/lib/observability/capture-client-error'

// Anything that fails while loading practice (the database, a stored attempt
// that no longer parses) lands here, in the app's own look, instead of the
// site-wide boundary. The cause goes to Sentry; the page says only that it failed.
export default function PromptingGuruError({
	error,
	reset
}: {
	error: Error & { digest?: string }
	reset: () => void
}) {
	const t = useTranslations('Guru.error')

	useEffect(() => {
		captureClientError(error, { digest: error.digest })
	}, [error])

	return (
		<main className="flex flex-col gap-6 px-5 py-14 md:px-14 md:py-20" data-testid="guru-error">
			<h1 className="app-heading">{t('title')}</h1>
			<p className="text-text-muted max-w-2xl">{t('body')}</p>
			<div className="flex flex-wrap items-center gap-4">
				<button type="button" className="app-pill" onClick={reset}>
					{t('retry')}
				</button>
				<Link href="/sessions" className="app-nav-link">
					{t('back')}
				</Link>
			</div>
		</main>
	)
}
