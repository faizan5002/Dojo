'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowUpRightIcon } from '@/components/ui/icons'
import { useRouter } from '@/i18n/routing'
import { runAssessmentAction } from '@/server/actions/workspace'

/**
 * Scores an upload on the server and opens the saved result. The button is
 * disabled while a run is in flight, so one click makes one assessment.
 */
export function RunAssessmentPanel({
	uploadId,
	sessionCount
}: {
	uploadId: string
	sessionCount: number
}) {
	const t = useTranslations('Assessment')
	const router = useRouter()
	const [hasFailed, setHasFailed] = useState(false)
	const [isRunning, startTransition] = useTransition()

	function run() {
		setHasFailed(false)
		startTransition(async () => {
			const result = await runAssessmentAction({ uploadId })
			if (!result.ok) {
				setHasFailed(true)
				return
			}
			router.push(`/assessment?id=${result.data.assessmentId}`)
		})
	}

	return (
		<section className="border-border flex flex-col gap-5 border-y py-10">
			<h2 className="app-heading">{hasFailed ? t('failed.title') : t('ready.title')}</h2>
			<p className="text-text-muted max-w-2xl">
				{hasFailed ? t('failed.body') : t('ready.body', { sessions: sessionCount })}
			</p>
			<div className="flex flex-wrap items-center gap-5">
				<button
					type="button"
					className="app-pill disabled:cursor-wait disabled:opacity-60"
					disabled={isRunning}
					aria-busy={isRunning}
					onClick={run}
				>
					{hasFailed ? t('failed.action') : t('ready.action')}
					<ArrowUpRightIcon size={14} />
				</button>
				<p aria-live="polite" className="text-text-muted text-sm">
					{isRunning ? t('running') : ''}
				</p>
			</div>
		</section>
	)
}
