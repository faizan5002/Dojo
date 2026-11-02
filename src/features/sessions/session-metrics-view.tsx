import { useFormatter, useTranslations } from 'next-intl'
import { SectionHeading, Stat } from '@/features/app-shell/section'
import { byStartTime, type MetricsOverview, type SessionMetrics } from './metrics'
import type { RejectionReason } from './types'

const ONE_DECIMAL = { maximumFractionDigits: 1 } as const
const TWO_DECIMALS = { maximumFractionDigits: 2 } as const
const WHOLE_PERCENT = { style: 'percent', maximumFractionDigits: 0 } as const

// Renders the free metrics saved with an upload. Prompt and response text is
// never shown here.
export function SessionMetricsView({
	overview,
	sessions: unsorted,
	rejected,
	maxFiles,
	maxMegabytes
}: {
	overview: MetricsOverview
	sessions: readonly SessionMetrics[]
	rejected: readonly { readonly fileName: string; readonly reason: RejectionReason }[]
	maxFiles: number
	maxMegabytes: number
}) {
	const t = useTranslations('Sessions')
	const format = useFormatter()
	const sessions = [...unsorted].sort(byStartTime)
	const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

	const decimal = (value: number | null) =>
		value == null ? t('notAvailable') : format.number(value, ONE_DECIMAL)
	const ratio = (value: number | null) =>
		value == null ? t('notAvailable') : format.number(value, TWO_DECIMALS)
	const percent = (value: number | null) =>
		value == null ? t('notAvailable') : format.number(value, WHOLE_PERCENT)
	const minutes = (value: number | null) =>
		value == null ? t('notAvailable') : t('units.minutes', { value: decimal(value) })
	const started = (metrics: SessionMetrics) => {
		const time = metrics.startedAt == null ? Number.NaN : Date.parse(metrics.startedAt)
		return Number.isNaN(time)
			? t('table.undated')
			: format.dateTime(time, { dateStyle: 'medium', timeStyle: 'short', timeZone })
	}
	const longestAverage = Math.max(1, ...sessions.map((metrics) => metrics.averagePromptWords ?? 0))

	return (
		<div className="flex flex-col gap-16">
			{rejected.length > 0 ? (
				<section aria-labelledby="rejected-heading" className="flex flex-col gap-5">
					<h2 id="rejected-heading" className="app-eyebrow">
						{t('rejected.heading')}
					</h2>
					<ul className="border-border flex flex-col border-t text-sm">
						{rejected.map((file) => (
							<li
								key={`${file.fileName}:${file.reason}`}
								className="border-border flex flex-wrap gap-x-4 gap-y-1 border-b py-3"
							>
								<span className="font-medium break-all">{file.fileName}</span>
								<span className="text-text-muted">
									{t(`rejected.${file.reason}`, { maxFiles, maxMegabytes })}
								</span>
							</li>
						))}
					</ul>
				</section>
			) : null}

			{sessions.length > 0 ? (
				<>
					<section aria-labelledby="overview-heading" className="flex flex-col gap-8">
						<SectionHeading id="overview-heading" number="02">
							{t('overview.heading')}
						</SectionHeading>
						<dl className="border-border grid grid-cols-2 border-t border-l lg:grid-cols-4">
							<Stat label={t('overview.sessions')} value={format.number(overview.sessionCount)} />
							<Stat label={t('overview.prompts')} value={format.number(overview.promptCount)} />
							<Stat
								label={t('overview.averagePromptWords')}
								value={
									overview.averagePromptWords == null
										? t('notAvailable')
										: t('units.words', { value: decimal(overview.averagePromptWords) })
								}
							/>
							<Stat label={t('overview.pasteRatio')} value={percent(overview.pasteRatio)} />
							<Stat
								label={t('overview.promptToResponseRatio')}
								value={ratio(overview.promptToResponseRatio)}
							/>
							<Stat label={t('overview.averageGap')} value={minutes(overview.averageGapMinutes)} />
							<Stat
								className="col-span-2"
								label={t('overview.perPrompt')}
								value={t('overview.codeBlocks', { count: decimal(overview.codeBlocksPerPrompt) })}
								detail={[
									t('overview.filePaths', { count: decimal(overview.filePathsPerPrompt) }),
									t('overview.urls', { count: decimal(overview.urlsPerPrompt) })
								].join(' · ')}
							/>
						</dl>
					</section>

					<section aria-labelledby="trend-heading" className="flex flex-col gap-8">
						<div className="flex flex-col gap-3">
							<SectionHeading id="trend-heading" number="03">
								{t('trend.heading')}
							</SectionHeading>
							<p className="text-text-muted text-sm">{t('trend.description')}</p>
						</div>
						<ol className="border-border flex flex-col border-t">
							{sessions.map((metrics) => (
								<li
									key={metrics.sessionId}
									className="border-border flex flex-wrap items-center gap-x-4 gap-y-2 border-b py-3 text-sm sm:flex-nowrap"
								>
									<span className="text-text-muted w-full truncate sm:w-44 sm:shrink-0">
										{started(metrics)}
									</span>
									<span className="bg-border h-0.5 flex-1">
										<span
											className="bg-accent block h-0.5"
											style={{
												width: `${((metrics.averagePromptWords ?? 0) / longestAverage) * 100}%`
											}}
										/>
									</span>
									<span className="w-24 shrink-0 text-right tabular-nums">
										{t('units.words', { value: decimal(metrics.averagePromptWords) })}
									</span>
								</li>
							))}
						</ol>
					</section>

					<section aria-labelledby="table-heading" className="flex flex-col gap-8">
						<SectionHeading id="table-heading" number="04">
							{t('table.heading')}
						</SectionHeading>
						<div className="overflow-x-auto">
							<table className="w-full min-w-4xl text-left text-sm">
								<thead>
									<tr className="border-border border-y">
										{[
											'started',
											'agent',
											'prompts',
											'length',
											'averageWords',
											'pasted',
											'ratio',
											'gap',
											'longestGap',
											'perPrompt'
										].map((column) => (
											<th key={column} scope="col" className="app-eyebrow py-4 pr-5 align-bottom">
												{t(`table.${column}`)}
											</th>
										))}
									</tr>
								</thead>
								<tbody>
									{sessions.map((metrics) => (
										<tr key={metrics.sessionId} className="border-border border-b">
											<th scope="row" className="py-4 pr-5 font-normal whitespace-nowrap">
												{started(metrics)}
											</th>
											<td className="py-4 pr-5 whitespace-nowrap">
												{t(`agents.${metrics.agent}`)}
											</td>
											<td className="py-4 pr-5 tabular-nums">{metrics.promptCount}</td>
											<td className="py-4 pr-5 tabular-nums">{minutes(metrics.sessionMinutes)}</td>
											<td className="py-4 pr-5 tabular-nums">
												{decimal(metrics.averagePromptWords)}
											</td>
											<td className="py-4 pr-5 tabular-nums">{percent(metrics.pasteRatio)}</td>
											<td className="py-4 pr-5 tabular-nums">
												{ratio(metrics.promptToResponseRatio)}
											</td>
											<td className="py-4 pr-5 tabular-nums">
												{minutes(metrics.averageGapMinutes)}
											</td>
											<td className="py-4 pr-5 tabular-nums">
												{minutes(metrics.longestGapMinutes)}
											</td>
											<td className="py-4 tabular-nums">
												{[
													metrics.codeBlocksPerPrompt,
													metrics.filePathsPerPrompt,
													metrics.urlsPerPrompt
												]
													.map(decimal)
													.join(' · ')}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</section>
				</>
			) : null}
		</div>
	)
}
