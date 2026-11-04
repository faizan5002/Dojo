import { useFormatter, useTranslations } from 'next-intl'
import { ArrowUpRightIcon } from '@/components/ui/icons'
import { Link } from '@/i18n/routing'
import type { DashboardModel } from '../dashboard-model'
import { TrendChart } from './trend-chart'

/**
 * History, kept one step behind the coaching: the score over time, and the
 * assessments before the one on this page. The counts are one line, not four tiles,
 * and a list with nothing in it is left out rather than announced as empty.
 */
export function ProgressPanel({
	trend,
	earlier,
	totals
}: {
	trend: DashboardModel['trend']
	earlier: DashboardModel['earlier']
	totals: DashboardModel['totals']
}) {
	const t = useTranslations('Dashboard.progress')
	const tLevel = useTranslations('Assessment.proficiency')
	const format = useFormatter()
	return (
		<section aria-labelledby="progress-heading" className="flex flex-col gap-5">
			<div className="flex flex-col gap-1">
				<h2 id="progress-heading" className="app-eyebrow">
					{t('heading')}
				</h2>
				<p className="text-text-muted text-sm">
					{t('summary', {
						assessments: totals.assessments,
						sessions: totals.sessions,
						prompts: totals.prompts
					})}
				</p>
			</div>
			<div className="flex flex-col gap-2">
				<h3 className="app-eyebrow text-text-faint">{t('trend')}</h3>
				<TrendChart trend={trend} />
			</div>
			{earlier.length === 0 ? null : (
				<div className="flex flex-col gap-2">
					<h3 className="app-eyebrow text-text-faint">{t('earlier')}</h3>
					<ul className="border-border border-t">
						{earlier.map((assessment) => (
							<li key={assessment.id} className="border-border border-b">
								<Link
									href={`/assessment?id=${assessment.id}`}
									className="hover:bg-surface-hover -mx-2 flex items-center justify-between gap-4 px-2 py-3"
								>
									<span className="flex flex-col">
										<span className="text-sm">
											{format.dateTime(assessment.createdAt, {
												dateStyle: 'medium',
												timeStyle: 'short'
											})}
										</span>
										<span className="text-text-muted text-xs">
											{assessment.score == null || assessment.proficiency == null
												? t('noScore')
												: `${assessment.score} · ${tLevel(assessment.proficiency)}`}
										</span>
									</span>
									<span className="app-eyebrow flex items-center gap-2">
										{t('open')}
										<ArrowUpRightIcon size={12} />
									</span>
								</Link>
							</li>
						))}
					</ul>
				</div>
			)}
		</section>
	)
}
