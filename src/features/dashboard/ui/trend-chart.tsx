import { useFormatter, useTranslations } from 'next-intl'
import type { DashboardModel } from '../dashboard-model'

const WIDTH = 320
const HEIGHT = 96
const PAD_X = 8
const PAD_Y = 10
const BAND_LINES = [40, 60, 80] as const

/**
 * Overall score across scored assessments, oldest to newest, on a fixed 0 to 100
 * scale with the level boundaries as faint guides. Everything it shows is also
 * written out: the chart's accessible name lists every score, and the first and
 * last points are printed beneath it, so nothing depends on a hover tooltip.
 */
export function TrendChart({ trend }: { trend: DashboardModel['trend'] }) {
	const t = useTranslations('Dashboard.progress')
	const format = useFormatter()
	const first = trend[0]
	const last = trend.at(-1)
	if (first == null || last == null || trend.length < 2) {
		return <p className="text-text-muted text-sm">{t('trendSingle')}</p>
	}
	const x = (index: number) => PAD_X + (index / (trend.length - 1)) * (WIDTH - 2 * PAD_X)
	const y = (score: number) => HEIGHT - PAD_Y - (score / 100) * (HEIGHT - 2 * PAD_Y)
	const points = trend.map((point, index) => ({ ...point, cx: x(index), cy: y(point.score) }))
	const date = (value: Date) => format.dateTime(value, { dateStyle: 'medium' })
	return (
		<figure className="flex flex-col gap-2">
			<svg
				role="img"
				aria-label={t('trendLabel', {
					count: trend.length,
					scores: trend.map((point) => point.score).join(', ')
				})}
				viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
				className="h-24 w-full"
				preserveAspectRatio="none"
			>
				{BAND_LINES.map((line) => (
					<line
						key={line}
						x1={0}
						x2={WIDTH}
						y1={y(line)}
						y2={y(line)}
						stroke="var(--border)"
						strokeDasharray="2 4"
						vectorEffect="non-scaling-stroke"
					/>
				))}
				<polyline
					fill="none"
					stroke="var(--text)"
					strokeWidth={1.5}
					vectorEffect="non-scaling-stroke"
					points={points.map((point) => `${point.cx},${point.cy}`).join(' ')}
				/>
				{points.map((point, index) => (
					<circle
						key={point.id}
						cx={point.cx}
						cy={point.cy}
						r={index === points.length - 1 ? 4 : 2.5}
						fill={index === points.length - 1 ? 'var(--accent)' : 'var(--bg)'}
						stroke={index === points.length - 1 ? 'var(--accent)' : 'var(--text)'}
						strokeWidth={1.5}
						vectorEffect="non-scaling-stroke"
					/>
				))}
			</svg>
			<figcaption className="text-text-muted flex justify-between gap-4 text-xs tabular-nums">
				<span>
					{date(first.createdAt)} · {first.score}
				</span>
				<span>
					{date(last.createdAt)} · {last.score}
				</span>
			</figcaption>
		</figure>
	)
}
