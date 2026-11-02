'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { DownloadIcon } from '@/components/ui/icons'

const FILENAME = /filename="([^"]+)"/
const FALLBACK_FILENAME = 'dojo-assessment.pdf'

/** Fetches the report and hands it to the browser as a download. False if it failed. */
async function saveReport(assessmentId: string): Promise<boolean> {
	try {
		const response = await fetch(`/api/assessments/${assessmentId}/pdf`)
		if (!response.ok) return false
		const disposition = response.headers.get('Content-Disposition') ?? ''
		const url = URL.createObjectURL(await response.blob())
		const link = document.createElement('a')
		link.href = url
		link.download = FILENAME.exec(disposition)?.[1] ?? FALLBACK_FILENAME
		link.click()
		URL.revokeObjectURL(url)
		return true
	} catch {
		return false
	}
}

/**
 * Downloads the PDF report of the assessment on screen, whichever one that
 * is. The button is disabled while a report is being prepared.
 */
export function DownloadReportButton({ assessmentId }: { assessmentId: string }) {
	const t = useTranslations('Assessment.download')
	const [hasFailed, setHasFailed] = useState(false)
	const [isPreparing, startTransition] = useTransition()

	function download() {
		setHasFailed(false)
		startTransition(async () => {
			setHasFailed(!(await saveReport(assessmentId)))
		})
	}

	return (
		<span className="inline-flex flex-col gap-1">
			<button
				type="button"
				className="app-pill disabled:cursor-wait disabled:opacity-60"
				disabled={isPreparing}
				aria-busy={isPreparing}
				onClick={download}
			>
				{isPreparing ? t('running') : t('action')}
				<DownloadIcon size={14} />
			</button>
			<span aria-live="polite" className="text-danger text-xs empty:hidden">
				{hasFailed ? t('failed') : ''}
			</span>
		</span>
	)
}
