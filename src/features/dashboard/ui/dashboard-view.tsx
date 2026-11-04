import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import type { DashboardModel } from '../dashboard-model'
import { FocusNext } from './focus-next'
import { PerformancePanel } from './performance-panel'
import { ProgressPanel } from './progress-panel'
import { RecentSessions } from './recent-sessions'
import { SkillOverview } from './skill-overview'
import { EmptyPanel, InsufficientPanel, ToScorePanel } from './state-panels'

/**
 * The dashboard for one user's workspace, in the order of the question it answers:
 * what to practise next (and why), where you stand, the five skills, how it has
 * moved, and the sessions behind it. The greeting is one line so the coaching
 * block starts in the first screen, at every width.
 */
export function DashboardView({ name, model }: { name: string; model: DashboardModel }) {
	const t = useTranslations('Dashboard')
	const { stage, valid, focus } = model
	return (
		<main className="flex flex-col gap-8 px-5 py-8 md:px-14 md:py-10">
			<header className="flex flex-wrap items-baseline justify-end gap-x-6 gap-y-2 md:justify-between">
				<h1 className="sr-only text-xl font-normal md:not-sr-only">
					{stage === 'empty' ? t('greetingNew') : t('greeting', { name })}
				</h1>
				{stage === 'ready' ? (
					<Link href="/sessions" className="app-nav-link">
						{t('upload')}
					</Link>
				) : null}
			</header>

			{stage === 'empty' ? <EmptyPanel /> : null}
			{stage === 'toScore' && model.latestUploadId != null ? (
				<ToScorePanel uploadId={model.latestUploadId} />
			) : null}
			{stage === 'insufficient' && model.insufficient != null ? (
				<InsufficientPanel insufficient={model.insufficient} />
			) : null}

			{stage === 'ready' && valid != null && focus != null ? (
				<>
					<FocusNext focus={focus} assessmentId={valid.id} />
					<div className="grid grid-cols-1 gap-8 xl:grid-cols-12 xl:grid-rows-[auto_1fr] xl:items-start">
						<div className="min-w-0 xl:col-span-5 xl:col-start-1 xl:row-start-1">
							<PerformancePanel valid={valid} newerUnscored={model.newerUnscored} />
						</div>
						<div className="min-w-0 xl:col-span-7 xl:col-start-6 xl:row-span-2 xl:row-start-1">
							<SkillOverview skills={model.skills} assessmentId={valid.id} />
						</div>
						<div className="min-w-0 xl:col-span-5 xl:col-start-1 xl:row-start-2">
							<ProgressPanel trend={model.trend} earlier={model.earlier} totals={model.totals} />
						</div>
					</div>
					<RecentSessions sessions={model.recentSessions} />
				</>
			) : null}

			{stage === 'toScore' || stage === 'insufficient' ? (
				<RecentSessions sessions={model.recentSessions} />
			) : null}
		</main>
	)
}
