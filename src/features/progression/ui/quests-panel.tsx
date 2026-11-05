'use client'

import { questsOf, type Quest } from '../model'
import { useProgress } from '../store'
import { CheckIcon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'
import { QuestIcon, XpIcon } from './dojo-icons'

function QuestRow({ quest }: { quest: Quest }) {
	return (
		<li className="pg-quest" data-done={quest.done} data-testid={`quest-${quest.id}`}>
			<span className="pg-quest-mark" aria-hidden="true">
				{quest.done ? <CheckIcon size={16} /> : <QuestIcon size={16} />}
			</span>
			<div className="flex min-w-0 flex-col gap-1.5">
				<p className="text-[15px]">{quest.title}</p>
				<span aria-hidden="true" className="app-meter">
					<span style={{ width: `${(quest.progress / quest.goal) * 100}%` }} />
				</span>
				<p className="text-text-muted text-xs">
					{quest.done ? 'Completed' : quest.detail}
					<span className="sr-only">
						{' '}
						{quest.progress} of {quest.goal}
					</span>
				</p>
			</div>
			<span className="pg-reward">
				<XpIcon size={16} filled />+{quest.xp} XP
			</span>
		</li>
	)
}

/** Training objectives on a paper scroll: today's, then the week's. */
export function QuestsPanel({ className }: { className?: string }) {
	const { state } = useProgress()
	if (state == null)
		return <div className={cn('dj-scroll min-h-[20rem]', className)} aria-hidden="true" />
	const quests = questsOf(state)
	const daily = quests.filter((q) => q.scope === 'daily')
	const weekly = quests.filter((q) => q.scope === 'weekly')
	const dailyDone = daily.filter((q) => q.done).length
	return (
		<section aria-label="Quests" data-testid="quests" className={cn('dj-scroll', className)}>
			<div className="flex items-baseline justify-between gap-3">
				<p className="pg-title">Today&apos;s training objectives</p>
				<p className="text-text-muted text-xs tabular-nums">
					{dailyDone}/{daily.length} done
				</p>
			</div>
			<ul>
				{daily.map((quest) => (
					<QuestRow key={quest.id} quest={quest} />
				))}
			</ul>
			<p className="pg-title border-border-strong border-t pt-4">Weekly challenges</p>
			<ul>
				{weekly.map((quest) => (
					<QuestRow key={quest.id} quest={quest} />
				))}
			</ul>
		</section>
	)
}
