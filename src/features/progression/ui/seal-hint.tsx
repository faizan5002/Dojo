'use client'

import { ACHIEVEMENTS } from '../model'
import { useProgress } from '../store'
import { BadgeArt } from './badge-art'

const SEAL = ACHIEVEMENTS.find((achievement) => achievement.id === 'evidence-seeker')

/** In the evidence rail: the one seal this screen can earn, and whether it already is. */
export function SealHint({ done }: { done: boolean }) {
	const { state } = useProgress()
	if (SEAL == null) return null
	// Same height before and after the browser loads the demo state, so nothing below it moves.
	if (state == null) return <p className="border-border min-h-16 border-t" aria-hidden="true" />
	const owned = state.unlocked[SEAL.id] != null
	return (
		<p
			className="border-border flex min-h-16 items-center gap-3 border-t pt-3 text-xs"
			data-testid="seal-hint"
		>
			<span className={owned ? '' : 'opacity-60 grayscale'}>
				<BadgeArt achievement={SEAL} size={36} locked={!owned} />
			</span>
			<span className="text-text-muted">
				{owned
					? 'Evidence Seeker seal earned.'
					: done
						? 'Every finding studied. The seal is yours.'
						: 'Study every finding to earn the Evidence Seeker seal (demo).'}
			</span>
		</p>
	)
}
