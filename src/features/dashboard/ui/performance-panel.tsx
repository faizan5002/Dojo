import { useFormatter, useTranslations } from 'next-intl'
import { ArrowUpRightIcon } from '@/components/ui/icons'
import { PROFICIENCY_BANDS } from '@/features/assessment/rubric'
import { RankLine } from '@/features/progression/ui/rank-line'
import { Link } from '@/i18n/routing'
import type { DashboardModel } from '../dashboard-model'

type Valid = NonNullable<DashboardModel['valid']>

const MARKERS = PROFICIENCY_BANDS.filter((band) => band.min > 0).map((band) => band.min)

/** The comparison as one plain sentence, or the reason there is none. */
function useComparisonText(comparison: Valid['comparison']) {
	const t = useTranslations('Dashboard.performance')
	const format = useFormatter()
	if (comparison.status === 'unavailable') return t(comparison.reason)
	const { delta } = comparison
	if (delta === 0) return t('same')
	return t(delta > 0 ? 'up' : 'down', {
		value: format.number(delta, { signDisplay: 'exceptZero' })
	})
}

/**
 * The top of the dashboard: who is back, and where the real assessment puts them. The
 * overall score is the engine's own, drawn as a ring with the number inside it, over the
 * level bands. The basis (the sessions and prompts it actually used) is stated beside it,
 * and a change against the earlier assessment is a sentence, never an alarm. Nothing on
 * this panel is invented: every figure is from the assessment.
 */
export function PerformancePanel({
	valid,
	newerUnscored,
	greeting,
	uploadLabel
}: {
	valid: Valid
	newerUnscored: DashboardModel['newerUnscored']
	greeting: string
	uploadLabel: string
}) {
	const t = useTranslations('Dashboard.performance')
	const tLevel = useTranslations('Assessment.proficiency')
	const format = useFormatter()
	const comparisonText = useComparisonText(valid.comparison)
	return (
		<section
			aria-labelledby="performance-heading"
			className="app-hero flex flex-col gap-5 p-4 md:gap-8 md:p-10"
		>
			<div className="grid grid-cols-[minmax(0,1fr)] gap-5 md:gap-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
				<div className="flex min-w-0 flex-col gap-4 max-md:order-2 md:gap-6">
					<h2 id="performance-heading" className="app-eyebrow">
						<b>●</b> {t('heading')}
					</h2>
					<h1 className="app-heading !text-[clamp(28px,3.2vw,46px)] break-words max-md:!text-[22px]">
						{greeting}
					</h1>
					<div className="dj-hide-phone">
						<RankLine />
					</div>
					<div className="dj-hide-phone flex flex-col gap-1 text-sm">
						<p>{t('basis', { sessions: valid.sessions, prompts: valid.prompts })}</p>
						<p className="text-text-muted">
							{t('assessedOn', {
								date: format.dateTime(valid.createdAt, { dateStyle: 'medium', timeStyle: 'short' })
							})}
						</p>
						<p className="text-text-muted" data-testid="comparison-text">
							{comparisonText}
							{valid.comparison.status === 'provisional' ? ` ${t('provisional')}` : ''}
						</p>
					</div>
					<details className="dj-only-phone text-sm">
						<summary className="app-eyebrow text-text-muted cursor-pointer">
							{t('basis', { sessions: valid.sessions, prompts: valid.prompts })}
						</summary>
						<p className="text-text-muted mt-2">{comparisonText}</p>
					</details>
					<div className="flex flex-wrap items-center gap-x-6 gap-y-2">
						<Link href="/sessions" className="app-pill">
							{uploadLabel}
							<ArrowUpRightIcon size={14} />
						</Link>
						<Link href={`/assessment?id=${valid.id}`} className="app-nav-link">
							{t('open')}
							<ArrowUpRightIcon size={12} className="ml-2 inline" />
						</Link>
					</div>
				</div>

				<div className="flex items-center gap-5 max-md:order-1 lg:flex-col lg:items-start lg:gap-4">
					<div
						className="app-ring app-ring-lg"
						style={{ '--v': valid.score } as React.CSSProperties}
					>
						<span data-testid="dashboard-score" className="app-score-md">
							{valid.score}
						</span>
					</div>
					<div className="flex min-w-0 flex-col gap-3 md:min-w-40">
						<p className="app-eyebrow">{t('outOf')}</p>
						{valid.proficiency == null ? null : (
							<p>
								<span className="app-chip app-chip-risk">{tLevel(valid.proficiency)}</span>
							</p>
						)}
						{valid.comparison.status === 'unavailable' ? null : (
							<p className="dj-delta" data-testid="score-delta">
								<b>
									{format.number(valid.comparison.delta, { signDisplay: 'exceptZero' })} vs last
								</b>
								{valid.comparison.status === 'provisional' ? (
									<span title={t('provisional')}>Provisional</span>
								) : null}
							</p>
						)}
						<span aria-hidden="true" className="app-meter w-40 max-w-full">
							<span style={{ width: `${valid.score}%` }} />
							{MARKERS.map((marker) => (
								<i key={marker} style={{ left: `${marker}%` }} />
							))}
						</span>
					</div>
				</div>
			</div>

			{newerUnscored == null ? null : (
				<p className="border-border text-text-muted border-t pt-4 text-sm">
					{t('newerUnscored', {
						date: format.dateTime(newerUnscored.createdAt, { dateStyle: 'medium' })
					})}{' '}
					<Link
						href={`/assessment?id=${newerUnscored.id}`}
						className="text-text underline underline-offset-4"
					>
						{t('newerUnscoredLink')}
					</Link>
				</p>
			)}
		</section>
	)
}
