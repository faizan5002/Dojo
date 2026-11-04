import { useFormatter, useTranslations } from 'next-intl'
import { ArrowUpRightIcon } from '@/components/ui/icons'
import { Link } from '@/i18n/routing'
import type { DashboardModel } from '../dashboard-model'

type Valid = NonNullable<DashboardModel['valid']>

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
 * The overall score and what it rests on. The basis (sessions and prompts the
 * assessment actually used) is stated next to the number, and a change against the
 * earlier assessment is a sentence, never an alarm.
 */
export function PerformancePanel({
	valid,
	newerUnscored
}: {
	valid: Valid
	newerUnscored: DashboardModel['newerUnscored']
}) {
	const t = useTranslations('Dashboard.performance')
	const tLevel = useTranslations('Assessment.proficiency')
	const format = useFormatter()
	const comparisonText = useComparisonText(valid.comparison)
	return (
		<section
			aria-labelledby="performance-heading"
			className="border-border bg-surface flex flex-col gap-5 border p-6"
		>
			<h2 id="performance-heading" className="app-eyebrow">
				{t('heading')}
			</h2>
			<div className="flex flex-col gap-3">
				<p className="flex items-end gap-3">
					<span data-testid="dashboard-score" className="app-score-md">
						{valid.score}
					</span>
					<span className="app-eyebrow pb-1">{t('outOf')}</span>
				</p>
				{valid.proficiency == null ? null : (
					<p>
						<span className="app-chip">{tLevel(valid.proficiency)}</span>
					</p>
				)}
			</div>
			<div className="flex flex-col gap-1 text-sm">
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
			<div className="mt-auto pt-1">
				<Link href={`/assessment?id=${valid.id}`} className="app-nav-link">
					{t('open')}
					<ArrowUpRightIcon size={12} className="ml-2 inline" />
				</Link>
			</div>
		</section>
	)
}
