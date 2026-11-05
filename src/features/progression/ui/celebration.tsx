'use client'

import { useEffect } from 'react'
import { ACHIEVEMENTS, dismissReward, type Reward } from '../model'
import { useCelebrationHold, useProgress } from '../store'
import { BadgeArt } from './badge-art'
import { HankoMark, XpIcon } from './dojo-icons'

const delay = (seconds: number) => ({ '--d': `${seconds}s` }) as React.CSSProperties

function Toast({ reward, onDone }: { reward: Reward; onDone: () => void }) {
	useEffect(() => {
		const id = window.setTimeout(onDone, 3200)
		return () => window.clearTimeout(id)
	}, [reward.id, onDone])
	return (
		<div className="pg-toast-stack">
			<p role="status" className="pg-toast" data-testid="reward-toast">
				<b className="text-accent-text font-medium">{reward.label}</b>
				{reward.detail ? <span className="text-text-muted">{reward.detail}</span> : null}
			</p>
		</div>
	)
}

/**
 * Plays queued rewards one at a time: plain XP as a toast, a rank gain or a seal as a reveal
 * the person dismisses. While a practice session is in progress the queue is held, so a reveal
 * never lands on an unanswered scenario; it plays at the summary. Mounted once in the shell.
 */
export function Celebration() {
	const { state, update } = useProgress()
	const held = useCelebrationHold()
	const reward = held ? undefined : state?.pending[0]
	const waiting = state == null ? 0 : state.pending.length - 1
	const collect = () => update((current) => dismissReward(current))
	useEffect(() => {
		if (reward == null || reward.kind === 'xp') return
		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape') update((current) => dismissReward(current))
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [reward, update])
	if (reward == null) return null
	if (reward.kind === 'xp') return <Toast reward={reward} onDone={collect} />
	const achievement = ACHIEVEMENTS.find((a) => a.id === reward.achievementId)
	const isRank = reward.kind === 'level'
	const xpMatch = /\+(\d+)/.exec(reward.detail ?? '')
	const xpValue = xpMatch == null ? null : Number(xpMatch[1])
	return (
		<div className="pg-overlay" onClick={collect}>
			<div
				role="dialog"
				aria-modal="true"
				aria-label={isRank ? 'Rank gained' : 'Seal unlocked'}
				className="dj-reveal"
				data-testid="celebration"
				onClick={(event) => event.stopPropagation()}
			>
				<span className="dj-bloom" aria-hidden="true" />
				<span className="dj-bloom" aria-hidden="true" />
				{isRank ? (
					<HankoMark size={112} className="dj-rank-stamp" />
				) : achievement != null ? (
					<span className="dj-reveal-seal">
						<BadgeArt achievement={achievement} size={150} />
					</span>
				) : null}
				<p className="pg-title dj-line" style={delay(0.45)}>
					{isRank
						? `Rank ${reward.level ?? ''} reached`
						: `Seal unlocked${achievement ? ` · ${achievement.rarity}` : ''}`}
				</p>
				<p className="dj-line text-3xl font-normal" style={delay(0.55)}>
					{reward.label}
				</p>
				{isRank ? (
					<p className="text-text-muted dj-line text-sm" style={delay(0.65)}>
						{reward.detail}
					</p>
				) : achievement != null ? (
					<p className="text-text-muted dj-line text-sm" style={delay(0.65)}>
						{achievement.description}
					</p>
				) : null}
				{!isRank && xpValue != null ? (
					<p className="pg-reward dj-line text-lg" style={delay(0.8)}>
						<XpIcon size={22} filled />
						<span className="dj-pop">+{xpValue} XP</span>
					</p>
				) : null}
				<button type="button" onClick={collect} autoFocus className="app-pill app-pill-sm mt-2">
					{waiting > 0 ? 'Next' : 'Collect'}
				</button>
				{waiting > 0 ? <p className="dj-queue">{waiting} more waiting</p> : null}
			</div>
		</div>
	)
}
