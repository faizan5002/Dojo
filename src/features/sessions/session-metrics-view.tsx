import { useFormatter, useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { IntakeResult } from './intake'
import { byStartTime, metricsOverview, sessionMetrics, type SessionMetrics } from './metrics'

const ONE_DECIMAL = { maximumFractionDigits: 1 } as const
const TWO_DECIMALS = { maximumFractionDigits: 2 } as const
const WHOLE_PERCENT = { style: 'percent', maximumFractionDigits: 0 } as const

// Renders the free metrics only. Prompt and response text is never shown here,
// so nothing a log holds reaches the page until redaction review exists.
export function SessionMetricsView({
	result,
	maxFiles,
	maxMegabytes
}: {
	result: IntakeResult
	maxFiles: number
	maxMegabytes: number
}) {
	const t = useTranslations('Sessions')
	const format = useFormatter()
	const sessions = result.sessions.map(sessionMetrics).sort(byStartTime)
	const overview = metricsOverview(result.sessions)
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
		<div className="flex flex-col gap-8">
			{result.rejected.length > 0 ? (
				<Card>
					<CardHeader>
						<CardTitle>{t('rejected.heading')}</CardTitle>
					</CardHeader>
					<CardContent>
						<ul className="flex flex-col gap-2 text-sm">
							{result.rejected.map((file) => (
								<li key={`${file.fileName}:${file.reason}`} className="flex flex-wrap gap-x-3">
									<span className="font-medium break-all">{file.fileName}</span>
									<span className="text-text-muted">
										{t(`rejected.${file.reason}`, { maxFiles, maxMegabytes })}
									</span>
								</li>
							))}
						</ul>
					</CardContent>
				</Card>
			) : null}

			{sessions.length > 0 ? (
				<>
					<section aria-labelledby="overview-heading" className="flex flex-col gap-4">
						<h2 id="overview-heading" className="text-xl font-semibold">
							{t('overview.heading')}
						</h2>
						<dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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
								label={t('overview.perPrompt')}
								value={t('overview.codeBlocks', { count: decimal(overview.codeBlocksPerPrompt) })}
								detail={[
									t('overview.filePaths', { count: decimal(overview.filePathsPerPrompt) }),
									t('overview.urls', { count: decimal(overview.urlsPerPrompt) })
								].join(' · ')}
							/>
						</dl>
					</section>

					<Card>
						<CardHeader>
							<CardTitle>{t('trend.heading')}</CardTitle>
							<CardDescription>{t('trend.description')}</CardDescription>
						</CardHeader>
						<CardContent>
							<ol className="flex flex-col gap-2">
								{sessions.map((metrics) => (
									<li
										key={metrics.sessionId}
										className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm sm:flex-nowrap"
									>
										<span className="text-text-muted w-full truncate sm:w-40 sm:shrink-0">
											{started(metrics)}
										</span>
										<span className="bg-surface-hover h-2 flex-1 overflow-hidden rounded-full">
											<span
												className="bg-accent block h-full rounded-full"
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
						</CardContent>
					</Card>

					<section aria-labelledby="table-heading" className="flex flex-col gap-4">
						<h2 id="table-heading" className="text-xl font-semibold">
							{t('table.heading')}
						</h2>
						<div className="border-border overflow-x-auto rounded-lg border">
							<table className="w-full min-w-4xl text-left text-sm">
								<thead className="bg-surface text-text-muted">
									<tr>
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
											<th key={column} scope="col" className="px-4 py-3 font-medium">
												{t(`table.${column}`)}
											</th>
										))}
									</tr>
								</thead>
								<tbody>
									{sessions.map((metrics) => (
										<tr key={metrics.sessionId} className="border-border border-t">
											<th scope="row" className="px-4 py-3 font-normal whitespace-nowrap">
												{started(metrics)}
											</th>
											<td className="px-4 py-3">{t(`agents.${metrics.agent}`)}</td>
											<td className="px-4 py-3 tabular-nums">{metrics.promptCount}</td>
											<td className="px-4 py-3 tabular-nums">{minutes(metrics.sessionMinutes)}</td>
											<td className="px-4 py-3 tabular-nums">
												{decimal(metrics.averagePromptWords)}
											</td>
											<td className="px-4 py-3 tabular-nums">{percent(metrics.pasteRatio)}</td>
											<td className="px-4 py-3 tabular-nums">
												{ratio(metrics.promptToResponseRatio)}
											</td>
											<td className="px-4 py-3 tabular-nums">
												{minutes(metrics.averageGapMinutes)}
											</td>
											<td className="px-4 py-3 tabular-nums">
												{minutes(metrics.longestGapMinutes)}
											</td>
											<td className="px-4 py-3 tabular-nums">
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

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
	return (
		<div className="border-border bg-surface flex flex-col gap-1 rounded-lg border p-4">
			<dt className="text-text-muted text-sm">{label}</dt>
			<dd className="text-2xl font-semibold tabular-nums">{value}</dd>
			{detail == null ? null : <dd className="text-text-muted text-sm">{detail}</dd>}
		</div>
	)
}
