'use client'

import { currentStreak, levelOf } from '../model'
import { todayKey, useProgress } from '../store'
import { Link } from '@/i18n/routing'
import { Flame } from './flame'

/** Compact level, XP and streak in the top bar. It links to the profile. */
export function NavChip() {
	const { state } = useProgress()
	if (state == null) return <span className="pg-chip" aria-hidden="true" style={{ width: 120 }} />
	const info = levelOf(state.xp)
	const streak = currentStreak(state.activity, todayKey())
	const pct = info.isMax ? 100 : Math.round((info.into / info.span) * 100)
	return (
		<Link
			href="/profile"
			className="pg-chip"
			data-testid="nav-progress"
			aria-label={`Profile: level ${info.level}, ${info.xp} XP, ${streak} day streak`}
		>
			<Flame size={16} lit={streak > 0} />
			<span>{streak}</span>
			<span className="hidden flex-col gap-1 xl:flex">
				<span className="text-xs leading-none">Lv {info.level}</span>
				<span className="pg-chip-bar" aria-hidden="true">
					<span style={{ width: `${pct}%` }} />
				</span>
			</span>
		</Link>
	)
}
