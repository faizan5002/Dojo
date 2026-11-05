'use client'

import { addDays, currentStreak, isActive, levelOf, weekStart } from '../model'
import { todayKey, useProgress } from '../store'
import { cn } from '@/lib/cn'
import { DemoTag } from './demo-tag'
import { HankoMark, RankEmblem } from './dojo-icons'
import { Embers, Flame } from './flame'

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

/**
 * The phone's status card: rank emblem, flame and the week on one screen. Numbers and shapes
 * carry it; the only words are the rank name and what is next.
 */
export function MobileHome({ className }: { className?: string }) {
	const { state } = useProgress()
	if (state == null)
		return <div className={cn('dj-home min-h-[15rem]', className)} aria-hidden="true" />
	const today = todayKey()
	const info = levelOf(state.xp)
	const pct = info.isMax ? 1 : info.into / info.span
	const streak = currentStreak(state.activity, today)
	const start = weekStart(today)
	return (
		<section
			aria-label="Rank and streak"
			data-testid="mobile-home"
			className={cn('dj-home', className)}
		>
			<DemoTag className="dj-demo-tag-corner" />
			<Embers />
			<div className="dj-home-top">
				<RankEmblem level={info.level} pct={pct} size={82} />
				<div className="flex min-w-0 flex-col gap-1">
					<span className="flex items-center gap-2">
						<HankoMark size={26} />
						<span className="truncate text-xl leading-tight">{info.title}</span>
					</span>
					<span className="text-text-muted text-xs tabular-nums">
						{info.xp} XP
						{info.isMax ? '' : ` · ${info.toNext} to ${info.nextTitle}`}
					</span>
				</div>
				<div className="flex flex-col items-center">
					<Flame size={52} lit={streak > 0} />
					<span className="text-lg leading-none tabular-nums" aria-label={`${streak} day streak`}>
						{streak}
					</span>
				</div>
			</div>
			<div
				className="pg-xp"
				role="progressbar"
				aria-label="XP to next rank"
				aria-valuemin={0}
				aria-valuemax={info.span}
				aria-valuenow={info.into}
			>
				<span style={{ width: `${pct * 100}%` }} />
			</div>
			<ol className="pg-week" aria-label="This week">
				{WEEKDAYS.map((label, i) => {
					const key = addDays(start, i)
					const on = isActive(state.activity[key])
					return (
						<li
							key={key}
							className={cn('pg-day', on && 'pg-day-on', key === today && 'pg-day-today')}
						>
							<span className="pg-day-dot">
								<span className="sr-only">{on ? 'Active' : 'No activity'}</span>
							</span>
							<span aria-hidden="true">{label}</span>
						</li>
					)
				})}
			</ol>
		</section>
	)
}
