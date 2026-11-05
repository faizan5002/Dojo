'use client'

import { addDays, bestStreak, currentStreak, isActive, weekStart } from '../model'
import { todayKey, useProgress } from '../store'
import { CheckIcon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'
import { Embers, Flame } from './flame'
import { DemoTag } from './demo-tag'
import { InkLandscape } from './ink-landscape'

const MILESTONES = [3, 5, 7, 14, 30]
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

/** Daily discipline: the flame, the run, the week, and the next milestone. */
export function StreakCard({ className }: { className?: string }) {
	const { state } = useProgress()
	if (state == null)
		return <div className={cn('dj-streak min-h-[26rem]', className)} aria-hidden="true" />
	const today = todayKey()
	const streak = currentStreak(state.activity, today)
	const best = Math.max(bestStreak(state.activity), streak)
	const doneToday = isActive(state.activity[today])
	const start = weekStart(today)
	const days = WEEKDAYS.map((label, i) => {
		const key = addDays(start, i)
		return { label, key, on: isActive(state.activity[key]), today: key === today }
	})
	const reached = [...MILESTONES].reverse().find((m) => streak >= m)
	const next = MILESTONES.find((m) => m > streak)
	return (
		<section aria-label="Streak" data-testid="streak-card" className={cn('dj-streak', className)}>
			<InkLandscape className="dj-landscape" />
			<Embers />
			<p className="pg-title flex items-center justify-between gap-3">
				Discipline
				<DemoTag />
			</p>
			<div className="dj-flame-stage">
				<Flame size={128} lit={streak > 0} />
				<p className="flex items-baseline gap-2">
					<span className="pg-big" data-testid="streak-count">
						{streak}
					</span>
					<span className="text-text-muted text-sm">{streak === 1 ? 'day' : 'days'} in a row</span>
				</p>
				<p className="text-text-muted text-sm">Longest run: {best} days</p>
			</div>
			<ol className="pg-week" aria-label="This week">
				{days.map((day) => (
					<li
						key={day.key}
						className={cn('pg-day', day.on && 'pg-day-on', day.today && 'pg-day-today')}
					>
						<span className="pg-day-dot">
							<CheckIcon size={14} />
							<span className="sr-only">
								{day.on ? 'Active' : 'No activity'}
								{day.today ? ', today' : ''}
							</span>
						</span>
						<span aria-hidden="true">{day.label}</span>
					</li>
				))}
			</ol>
			<ol className="flex items-center gap-2" aria-label="Streak milestones">
				{MILESTONES.map((m) => (
					<li
						key={m}
						className={cn(
							'flex flex-1 flex-col items-center gap-1 border py-2 text-xs tabular-nums',
							streak >= m ? 'border-accent text-text' : 'border-border-strong text-text-faint'
						)}
					>
						<Flame size={14} lit={streak >= m} />
						{m}d
					</li>
				))}
			</ol>
			<p className="border-border-strong mt-auto border-t pt-3 text-sm">
				{reached != null ? (
					<span>
						<b className="text-accent-text font-medium">{reached}-day milestone reached.</b>{' '}
						{next != null ? `${next - streak} more to the ${next}-day mark.` : 'Legendary run.'}
					</span>
				) : next != null ? (
					`${next - streak} more days to your first milestone.`
				) : null}
				{!doneToday && streak > 0 ? (
					<span className="text-text-muted block">Train today to keep the flame lit.</span>
				) : null}
			</p>
		</section>
	)
}
