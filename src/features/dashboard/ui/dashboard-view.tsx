import { useTranslations } from 'next-intl'
import type { DashboardModel } from '../dashboard-model'
import { CollectionBand, TrainingBand } from '@/features/progression/ui/progression-bands'
import { FocusNext } from './focus-next'
import { PerformancePanel } from './performance-panel'
import { ProgressPanel } from './progress-panel'
import { RecentSessions } from './recent-sessions'
import { SkillOverview } from './skill-overview'
import { EmptyPanel, InsufficientPanel, ToScorePanel } from './state-panels'

/**
 * The dashboard for one user's workspace, performance first: who is back and where the
 * real assessment puts them, the one skill to work on and the lines that prove it, the
 * five skills side by side, then how it has moved and the sessions behind it. Every
 * figure comes from the assessment engine's own results; nothing here is a sample.
 */
export function DashboardView({ name, model }: { name: string; model: DashboardModel }) {
	const t = useTranslations('Dashboard')
	const { stage, valid, focus } = model
	const greeting = stage === 'empty' ? t('greetingNew') : t('greeting', { name })
	return (
		<main className="flex flex-col gap-10 px-5 py-8 md:px-10 md:py-10">
			{stage === 'ready' && valid != null && focus != null ? (
				<>
					<div className="dj-rise" style={{ '--i': 0 } as React.CSSProperties}>
						<PerformancePanel
							valid={valid}
							newerUnscored={model.newerUnscored}
							greeting={greeting}
							uploadLabel={t('upload')}
						/>
					</div>
					<div className="dj-rise flex flex-col gap-4" style={{ '--i': 2 } as React.CSSProperties}>
						<p className="dj-divider" aria-hidden="true">
							<i /> Sensei guidance
						</p>
						<FocusNext focus={focus} assessmentId={valid.id} />
					</div>
					<TrainingBand />
					<div className="dj-rise" style={{ '--i': 3 } as React.CSSProperties}>
						<SkillOverview skills={model.skills} assessmentId={valid.id} />
					</div>
					<div className="dj-rise" style={{ '--i': 4 } as React.CSSProperties}>
						<CollectionBand />
					</div>
					<div className="grid grid-cols-[minmax(0,1fr)] gap-10 xl:grid-cols-2 xl:items-start">
						<ProgressPanel trend={model.trend} earlier={model.earlier} totals={model.totals} />
						<RecentSessions sessions={model.recentSessions} />
					</div>
				</>
			) : (
				<>
					<h1 className="app-heading !text-[clamp(26px,3vw,40px)]">{greeting}</h1>
					<TrainingBand />
					{stage === 'empty' ? <EmptyPanel /> : null}
					{stage === 'toScore' && model.latestUploadId != null ? (
						<ToScorePanel uploadId={model.latestUploadId} />
					) : null}
					{stage === 'insufficient' && model.insufficient != null ? (
						<InsufficientPanel insufficient={model.insufficient} />
					) : null}
					{stage === 'toScore' || stage === 'insufficient' ? (
						<RecentSessions sessions={model.recentSessions} />
					) : null}
				</>
			)}
		</main>
	)
}
