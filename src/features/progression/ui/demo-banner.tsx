'use client'

import { replayCelebration, resetProgress } from '../model'
import { useProgress } from '../store'

/**
 * Says plainly that progression is a demo, and offers the two demo controls. One line on a
 * phone; the longer wording sits behind the title.
 */
export function DemoBanner() {
	const { update } = useProgress()
	return (
		<p className="pg-demo" data-testid="progression-demo-note">
			<span title="Streak, XP, seals and quests are illustrative and live in this browser only. Your five skill scores come from your real assessment.">
				<b className="text-text font-medium">Demo progression</b>
				<span> · illustrative, kept in this browser. Your five skill scores are real.</span>
			</span>
			<span className="ml-auto flex gap-3">
				<button
					type="button"
					className="pg-link-btn"
					onClick={() => update((s) => replayCelebration(s))}
				>
					Replay
				</button>
				<button
					type="button"
					className="pg-link-btn"
					onClick={() => update((_s, today) => resetProgress(today))}
				>
					Reset
				</button>
			</span>
		</p>
	)
}
