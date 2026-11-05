'use client'

import { levelOf } from '../model'
import { useProgress } from '../store'
import { cn } from '@/lib/cn'
import { DemoTag } from './demo-tag'
import { HankoMark, RankEmblem, XpIcon } from './dojo-icons'

/** Rank and XP: a brush emblem that fills in brass as mastery grows. */
export function LevelCard({ className }: { className?: string }) {
	const { state } = useProgress()
	if (state == null)
		return <div className={cn('dj-panel min-h-[18rem]', className)} aria-hidden="true" />
	const info = levelOf(state.xp)
	const pct = info.isMax ? 1 : info.into / info.span
	const sources = [
		{ key: 'practice', label: 'Training', xp: state.xpBySource.practice },
		{ key: 'review', label: 'Scrolls studied', xp: state.xpBySource.review },
		{ key: 'assessment', label: 'Assessments', xp: state.xpBySource.assessment },
		{ key: 'bonus', label: 'Quests & seals', xp: state.xpBySource.bonus }
	]
	return (
		<section
			aria-label="Rank"
			data-testid="level-card"
			className={cn('dj-panel dj-wash', className)}
		>
			<DemoTag className="dj-demo-tag-corner" />
			<div className="flex flex-wrap items-center gap-x-8 gap-y-4">
				<div
					role="progressbar"
					aria-label="XP to next rank"
					aria-valuemin={0}
					aria-valuemax={info.span}
					aria-valuenow={info.into}
				>
					<RankEmblem level={info.level} pct={pct} size={132} />
					<span className="sr-only" data-testid="level-number">
						{info.level}
					</span>
				</div>
				<div className="flex min-w-0 flex-1 flex-col gap-1.5">
					<p className="flex items-center gap-3">
						<HankoMark size={34} />
						<span className="text-3xl leading-tight font-medium" data-testid="level-title">
							{info.title}
						</span>
					</p>
					<p className="text-text-muted text-sm">{info.gloss}</p>
					<p className="flex items-center gap-2 text-sm tabular-nums">
						<XpIcon size={18} filled />
						<b className="font-medium" data-testid="xp-total">
							{info.xp} XP
						</b>
						<span className="text-text-muted">
							{info.isMax
								? '· highest rank'
								: `· ${info.toNext} to ${info.nextTitle ?? 'next rank'}`}
						</span>
					</p>
				</div>
			</div>
			<details className="dj-xp-help">
				<summary>Where this XP comes from</summary>
				<p>
					<b>Training</b> is practice answers and finished sessions. <b>Scrolls studied</b> is
					session reviews you completed. <b>Assessments</b> is scored uploads.{' '}
					<b>Quests &amp; seals</b> is the bonus for objectives and seals. All demo.
				</p>
			</details>
			<dl className="border-border-strong grid grid-cols-2 gap-x-6 gap-y-1.5 border-t pt-3 text-sm">
				{sources.map((source) => (
					<div key={source.key} className="flex justify-between gap-3">
						<dt className="text-text-muted">{source.label}</dt>
						<dd className="tabular-nums">{source.xp}</dd>
					</div>
				))}
			</dl>
		</section>
	)
}
