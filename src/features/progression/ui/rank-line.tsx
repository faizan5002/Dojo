'use client'

import { levelOf } from '../model'
import { useProgress } from '../store'
import { HankoMark } from './dojo-icons'

/** The dojo welcome's rank line: the hanko, the rank and where the next one is. */
export function RankLine() {
	const { state } = useProgress()
	if (state == null) return <p className="h-11" aria-hidden="true" />
	const info = levelOf(state.xp)
	return (
		<p className="flex items-center gap-3" data-testid="rank-line">
			<HankoMark size={40} />
			<span className="flex flex-col text-sm">
				<span>
					<b className="font-normal">
						Rank {info.level} · {info.title}
					</b>{' '}
					<span className="text-text-muted">({info.gloss})</span>
				</span>
				<span className="text-text-muted text-xs tabular-nums">
					{info.xp} XP
					{info.isMax ? '' : ` · ${info.toNext} to ${info.nextTitle ?? 'the next rank'}`}
				</span>
			</span>
		</p>
	)
}
