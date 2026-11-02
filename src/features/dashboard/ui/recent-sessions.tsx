import { useFormatter, useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import type { DashboardModel } from '../dashboard-model'

const ONE_DECIMAL = { maximumFractionDigits: 1 } as const

/** The newest sessions across the latest uploads. Each row opens the upload it came from. */
export function RecentSessions({ sessions }: { sessions: DashboardModel['recentSessions'] }) {
	const t = useTranslations('Dashboard.recentSessions')
	const format = useFormatter()
	return (
		<section aria-labelledby="recent-sessions-heading" className="flex flex-col gap-5">
			<h2 id="recent-sessions-heading" className="app-eyebrow">
				{t('heading')}
			</h2>
			{sessions.length === 0 ? (
				<p className="text-text-muted text-sm">{t('empty')}</p>
			) : (
				<ul className="grid gap-x-10 xl:grid-cols-2">
					{sessions.map((session) => {
						const time = session.startedAt == null ? Number.NaN : Date.parse(session.startedAt)
						return (
							<li key={session.key} className="border-border border-t">
								<Link
									href={`/sessions?upload=${session.uploadId}`}
									className="hover:bg-surface-hover -mx-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-2 py-3"
								>
									<span className="flex min-w-0 flex-col">
										<span className="truncate">{session.project ?? t('unknownProject')}</span>
										<span className="text-text-muted truncate font-mono text-xs">
											{session.sessionId}
										</span>
									</span>
									<span className="text-text-muted flex flex-col text-right text-xs tabular-nums">
										<span>
											{t('prompts', { count: session.promptCount })}
											{session.minutes == null
												? ''
												: ` · ${t('minutes', { value: format.number(session.minutes, ONE_DECIMAL) })}`}
										</span>
										<span>
											{Number.isNaN(time)
												? t('undated')
												: format.dateTime(time, { dateStyle: 'medium' })}
										</span>
									</span>
								</Link>
							</li>
						)
					})}
				</ul>
			)}
		</section>
	)
}
