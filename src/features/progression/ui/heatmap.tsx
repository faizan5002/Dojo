'use client'

import { useState } from 'react'
import {
	addDays,
	bestStreak,
	countOf,
	currentStreak,
	dateOf,
	HEATMAP_WEEKS,
	intensityOf,
	weekStart,
	type DayKey
} from '../model'
import { todayKey, useProgress } from '../store'
import { cn } from '@/lib/cn'

const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const fmt = (key: DayKey) => {
	const d = dateOf(key)
	return `${WEEKDAY_NAMES[(d.getDay() + 6) % 7]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
}

export function Heatmap({ className }: { className?: string }) {
	const { state } = useProgress()
	const [picked, setPicked] = useState<DayKey | null>(null)
	if (state == null)
		return <div className={cn('dj-panel min-h-[22rem]', className)} aria-hidden="true" />
	const today = todayKey()
	const first = addDays(weekStart(today), -(HEATMAP_WEEKS - 1) * 7)
	const weeks = Array.from({ length: HEATMAP_WEEKS }, (_, w) =>
		Array.from({ length: 7 }, (_, d) => addDays(first, w * 7 + d))
	)
	const all = weeks.flat().filter((key) => key <= today)
	const activeDays = all.filter((key) => countOf(state.activity[key]) > 0)
	const total = all.reduce((sum, key) => sum + countOf(state.activity[key]), 0)
	const byWeekday = WEEKDAY_NAMES.map((name, i) => ({
		name,
		count: all
			.filter((_, idx) => idx % 7 === i)
			.reduce((sum, key) => sum + countOf(state.activity[key]), 0)
	}))
	const busiest = [...byWeekday].sort((a, b) => b.count - a.count)[0]
	const shown = picked ?? today
	const detail = state.activity[shown]
	const streak = currentStreak(state.activity, today)
	const lastMonth = weeks.map((week) => dateOf(week[0] ?? first).getMonth())
	return (
		<section aria-label="Activity" data-testid="heatmap" className={cn('dj-panel', className)}>
			<div className="flex flex-wrap items-baseline justify-between gap-2">
				<p className="pg-title">Training grounds · last {HEATMAP_WEEKS} weeks</p>
				<p className="text-text-muted text-sm tabular-nums">
					<b className="text-text font-normal">{total}</b> actions on{' '}
					<b className="text-text font-normal">{activeDays.length}</b> days
				</p>
			</div>
			<div className="pg-heat-scroll">
				<div className="pg-months" aria-hidden="true">
					{weeks.map((week, i) => (
						<span key={week[0]} data-old={i < HEATMAP_WEEKS - 14}>
							{i === 0 || lastMonth[i] !== lastMonth[i - 1] ? MONTHS[lastMonth[i] ?? 0] : ''}
						</span>
					))}
				</div>
				<div className="pg-heat" role="group" aria-label="Daily activity, newest on the right">
					{weeks.flat().map((key, flatIndex) => {
						const day = state.activity[key]
						const future = key > today
						return (
							<button
								key={key}
								type="button"
								className="pg-cell"
								data-level={intensityOf(day)}
								data-old={Math.floor(flatIndex / 7) < HEATMAP_WEEKS - 14}
								style={{ '--c': Math.floor(flatIndex / 7) } as React.CSSProperties}
								data-future={future}
								aria-pressed={shown === key}
								aria-label={`${fmt(key)}: ${countOf(day)} actions`}
								tabIndex={future ? -1 : 0}
								onMouseEnter={() => setPicked(key)}
								onFocus={() => setPicked(key)}
								onClick={() => setPicked(key)}
							/>
						)
					})}
				</div>
			</div>
			<div className="flex flex-wrap items-center justify-between gap-3">
				<p className="text-sm" aria-live="polite" data-testid="heatmap-detail">
					<b className="font-normal">{fmt(shown)}</b>
					<span className="text-text-muted">
						{countOf(detail) === 0
							? ': no activity'
							: `: ${detail?.practice ?? 0} practice, ${detail?.review ?? 0} review, ${detail?.assessment ?? 0} assessment`}
					</span>
				</p>
				<span className="pg-legend" aria-hidden="true">
					Less
					{[0, 1, 2, 3, 4].map((level) => (
						<i key={level} className="pg-cell" data-level={level} />
					))}
					More
				</span>
			</div>
			<p className="text-text-muted border-border-strong border-t pt-3 text-sm">
				Current streak {streak}, best {Math.max(bestStreak(state.activity), streak)} days. Most
				active on {busiest?.name ?? 'weekdays'}s.
			</p>
		</section>
	)
}
