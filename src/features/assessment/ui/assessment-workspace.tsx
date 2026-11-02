'use client'

import { useTranslations } from 'next-intl'
import { ArrowUpRightIcon } from '@/components/ui/icons'
import { useSessionStore } from '@/features/sessions/session-store'
import { Link } from '@/i18n/routing'
import { AssessmentReport } from './assessment-report'

function StatePanel({
	title,
	body,
	children
}: {
	title: string
	body: string
	children?: React.ReactNode
}) {
	return (
		<section className="border-border flex flex-col gap-5 border-y py-10">
			<h2 className="app-heading">{title}</h2>
			<p className="text-text-muted max-w-2xl">{body}</p>
			{children}
		</section>
	)
}

// Every state of the assessment: nothing loaded, loaded but not scored,
// scoring, scored, and a failed run. Scores only ever come from the logs the
// user chose; there is no sample data.
export function AssessmentWorkspace() {
	const t = useTranslations('Assessment')
	const { intake, assessment, analyze } = useSessionStore()

	if (intake == null || intake.sessions.length === 0) {
		return (
			<StatePanel title={t('empty.title')} body={t('empty.body')}>
				<Link href="/sessions" className="app-pill">
					{t('empty.action')}
					<ArrowUpRightIcon size={14} />
				</Link>
			</StatePanel>
		)
	}

	if (assessment.status === 'done') {
		return <AssessmentReport assessment={assessment.result} sessions={intake.sessions} />
	}

	const isRunning = assessment.status === 'running'
	const isFailed = assessment.status === 'failed'
	return (
		<StatePanel
			title={isFailed ? t('failed.title') : t('ready.title')}
			body={isFailed ? t('failed.body') : t('ready.body', { sessions: intake.sessions.length })}
		>
			<div className="flex flex-wrap items-center gap-5">
				<button
					type="button"
					className="app-pill disabled:cursor-wait disabled:opacity-60"
					disabled={isRunning}
					aria-busy={isRunning}
					onClick={analyze}
				>
					{isFailed ? t('failed.action') : t('ready.action')}
					<ArrowUpRightIcon size={14} />
				</button>
				<p aria-live="polite" className="text-text-muted text-sm">
					{isRunning ? t('running') : ''}
				</p>
			</div>
		</StatePanel>
	)
}
