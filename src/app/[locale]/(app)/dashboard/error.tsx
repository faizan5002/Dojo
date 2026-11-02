'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { captureClientError } from '@/lib/observability/capture-client-error'

// The dashboard failing to load is reported once, then offers a retry. Nothing
// about the data is lost: it is only being read.
export default function DashboardError({
	error,
	reset
}: {
	error: Error & { digest?: string }
	reset: () => void
}) {
	const t = useTranslations('Dashboard.error')
	useEffect(() => {
		captureClientError(error)
	}, [error])
	return (
		<main className="flex flex-col items-start gap-5 px-5 py-14 md:px-14 md:py-20">
			<h1 className="app-heading">{t('title')}</h1>
			<p className="text-text-muted max-w-xl">{t('body')}</p>
			<button type="button" className="app-pill" onClick={reset}>
				{t('retry')}
			</button>
		</main>
	)
}
