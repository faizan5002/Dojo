'use client'

import { useState } from 'react'
import { ACHIEVEMENTS, type Achievement } from '../model'
import { useProgress } from '../store'
import { Link } from '@/i18n/routing'
import { cn } from '@/lib/cn'
import { BadgeArt } from './badge-art'
import { DemoTag } from './demo-tag'

const RARITY_ORDER = { legendary: 0, epic: 1, rare: 2, common: 3 } as const

export function BadgeShowcase({
	limit,
	layout = 'grid',
	className
}: {
	/** Show only this many (unlocked first, then closest to unlocking). Omit for the whole collection. */
	limit?: number
	/** On a phone: 'shelf' is one swipeable row, 'grid' is three across. */
	layout?: 'shelf' | 'grid'
	className?: string
}) {
	const { state } = useProgress()
	const [picked, setPicked] = useState<string | null>(null)
	if (state == null)
		return <div className={cn('dj-panel min-h-[30rem]', className)} aria-hidden="true" />
	const unlockedCount = ACHIEVEMENTS.filter((a) => state.unlocked[a.id] != null).length
	const sorted = [...ACHIEVEMENTS].sort((a, b) => {
		const au = state.unlocked[a.id] != null ? 0 : 1
		const bu = state.unlocked[b.id] != null ? 0 : 1
		return au - bu || RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity]
	})
	const shown = limit == null ? sorted : sorted.slice(0, limit)
	const current: Achievement | undefined = ACHIEVEMENTS.find((a) => a.id === picked) ?? shown[0]
	const currentUnlocked = current != null && state.unlocked[current.id] != null
	return (
		<section aria-label="Badges" data-testid="badges" className={cn('dj-panel', className)}>
			<div className="flex flex-wrap items-baseline justify-between gap-2">
				<p className="pg-title flex items-center gap-3">
					Seal cabinet
					<DemoTag />
				</p>
				<p className="text-text-muted text-sm tabular-nums">
					<b className="text-text font-normal">{unlockedCount}</b> of {ACHIEVEMENTS.length} unlocked
				</p>
			</div>
			<ul className="pg-badges" data-layout={layout}>
				{shown.map((achievement) => {
					const unlocked = state.unlocked[achievement.id] != null
					return (
						<li key={achievement.id} className="contents">
							<button
								type="button"
								className="pg-badge"
								data-rarity={achievement.rarity}
								data-locked={!unlocked}
								aria-pressed={current?.id === achievement.id}
								data-testid={`badge-${achievement.id}`}
								onClick={() => setPicked(achievement.id)}
								onMouseEnter={() => setPicked(achievement.id)}
								onFocus={() => setPicked(achievement.id)}
							>
								<BadgeArt achievement={achievement} locked={!unlocked} size={72} />
								<span className="text-sm leading-tight">{achievement.title}</span>
								<span className="pg-rarity">{unlocked ? achievement.rarity : 'Locked'}</span>
							</button>
						</li>
					)
				})}
			</ul>
			{current != null ? (
				<div
					key={current.id}
					className="dj-detail"
					data-testid="badge-detail"
					data-rarity={current.rarity}
					aria-live="polite"
				>
					<span className={currentUnlocked ? '' : 'opacity-60 grayscale'}>
						<BadgeArt achievement={current} size={96} locked={!currentUnlocked} />
					</span>
					<div className="flex min-w-0 flex-col gap-2 text-sm">
						<p className="flex flex-wrap items-center gap-3">
							<b className="text-lg font-normal">{current.title}</b>
							<span className="app-chip">{current.rarity}</span>
						</p>
						<p className="max-md:hidden">{current.description}</p>
						<p className="text-text-muted">
							<b className="text-text font-normal">To earn it:</b> {current.criteria}
						</p>
						<p className="text-text-muted text-xs">
							{currentUnlocked ? `Unlocked ${state.unlocked[current.id]}` : 'Locked'} · +
							{current.xp} XP
						</p>
					</div>
				</div>
			) : null}
			{limit != null || layout === 'shelf' ? (
				<Link
					href="/achievements"
					className="app-nav-link w-fit text-sm underline underline-offset-4"
				>
					See the full collection
				</Link>
			) : null}
		</section>
	)
}
