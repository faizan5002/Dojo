import { useId } from 'react'
import type { Achievement, Rarity } from '../model'

interface Metal {
	readonly a: string
	readonly b: string
	readonly rim: string
}

// Seals are mon, family crests: a ringed disc with a carved emblem. Common ones are sumi ink,
// rare ones indigo, epic ones antique brass, legendary ones vermilion lacquer with a gold rim.
const METAL: Record<Rarity, Metal> = {
	common: { a: '#5a5043', b: '#2a241c', rim: '#d9ccb0' },
	rare: { a: '#4a5fa6', b: '#1d2a5c', rim: '#cfd8f2' },
	epic: { a: '#e2c06c', b: '#8a601c', rim: '#fff1c4' },
	legendary: { a: '#d6452b', b: '#8c1c0e', rim: '#f0cd72' }
}

const PAPER = '#f6eddc'

/** The carved symbol, drawn on a 40x40 grid and centred in the seal. */
function Carving({ kind }: { kind: Achievement['glyph'] }) {
	const line = {
		fill: 'none',
		stroke: PAPER,
		strokeWidth: 3.2,
		strokeLinecap: 'round',
		strokeLinejoin: 'round'
	} as const
	switch (kind) {
		case 'blade':
			return (
				<g {...line}>
					<path d="M9 31L31 9" />
					<path d="M23 11l6 6" />
					<path d="M9 31l-4 4" />
				</g>
			)
		case 'brush':
			return (
				<g {...line}>
					<path d="M8 32q6-15 20-24" />
					<path d="M28 8l4 4" />
					<circle cx="31" cy="31" r="2.5" fill={PAPER} />
				</g>
			)
		case 'shield':
			return (
				<g {...line}>
					<path d="M5 11h30M9 17h22M12 11v23M28 11v23" />
				</g>
			)
		case 'cycle':
			return (
				<g {...line}>
					<path d="M32 15a13 13 0 0 0-22-2M8 25a13 13 0 0 0 22 2" />
					<path d="M33 6v9h-9M7 34v-9h9" />
				</g>
			)
		case 'flame':
			return (
				<path
					fill={PAPER}
					d="M21 4c2 8 11 11 13 21 2 9-4 14-12 15-9 1-16-5-15-13 .5-5 3.5-8 6-11 1 4 3 6 5 6-2-8-1-13 3-18z"
				/>
			)
		case 'eye':
			return (
				<g {...line}>
					<path d="M3 20q17-17 34 0q-17 17-34 0z" />
					<circle cx="20" cy="20" r="4.5" fill={PAPER} />
				</g>
			)
		case 'dojo':
			return (
				<g {...line}>
					<path d="M3 16L20 5l17 11" />
					<path d="M8 18v15h24V18M16 33v-9h8v9" />
				</g>
			)
		case 'five':
			return (
				<g {...line}>
					<path d="M20 5l14 10-5 17H11L6 15z" strokeWidth="1.8" />
					{[
						[20, 5],
						[34, 15],
						[29, 32],
						[11, 32],
						[6, 15]
					].map(([x, y]) => (
						<circle key={`${x}-${y}`} cx={x} cy={y} r="3.2" fill={PAPER} />
					))}
				</g>
			)
		case 'crown':
			return (
				<g {...line}>
					<path d="M3 32L15 12l6 9 5-7 11 18z" />
					<path d="M12 18h6" />
				</g>
			)
	}
}

/** The outline of a seal: a disc, scalloped like a crest ring on the higher rarities. */
function outline(rarity: Rarity, inset = 0): string {
	const c = 50
	const scallops = rarity === 'epic' ? 8 : rarity === 'legendary' ? 12 : 0
	if (scallops === 0) {
		const r = (rarity === 'rare' ? 43 : 42) - inset
		return `M${c - r} ${c}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`
	}
	const outer = 46 - inset
	const dip = 41.5 - inset
	// bulged petals: one arc per scallop
	const parts: string[] = []
	for (let i = 0; i < scallops; i++) {
		const a1 = (i * 2 * Math.PI) / scallops - Math.PI / 2
		const a2 = ((i + 1) * 2 * Math.PI) / scallops - Math.PI / 2
		const x1 = c + dip * Math.cos(a1)
		const y1 = c + dip * Math.sin(a1)
		const x2 = c + dip * Math.cos(a2)
		const y2 = c + dip * Math.sin(a2)
		const am = (a1 + a2) / 2
		const cx = c + (outer + 3) * Math.cos(am)
		const cy = c + (outer + 3) * Math.sin(am)
		parts.push(
			`${i === 0 ? `M${x1.toFixed(1)} ${y1.toFixed(1)}` : ''}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`
		)
	}
	return `${parts.join('')}z`
}

/**
 * A collectible seal: a stamped shape in stone, vermilion or gold, a thin inner ring and the
 * achievement's carved symbol. Locked seals render the same shape; the card greys them.
 */
export function BadgeArt({
	achievement,
	size = 84,
	locked = false
}: {
	achievement: Achievement
	size?: number
	locked?: boolean
}) {
	const id = useId()
	const metal = METAL[achievement.rarity]
	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 100 100"
			width={size}
			height={size}
			className="dj-seal-art"
			data-rarity={achievement.rarity}
		>
			<defs>
				<linearGradient id={`${id}-m`} x1="0.1" y1="0" x2="0.9" y2="1">
					<stop offset="0" stopColor={metal.a} />
					<stop offset="1" stopColor={metal.b} />
				</linearGradient>
				<clipPath id={`${id}-c`}>
					<path d={outline(achievement.rarity)} />
				</clipPath>
			</defs>
			<path d={outline(achievement.rarity)} fill={`url(#${id}-m)`} />
			<path
				d={outline(achievement.rarity, 7)}
				fill="none"
				stroke={metal.rim}
				strokeOpacity="0.6"
				strokeWidth="1.6"
				strokeDasharray={achievement.rarity === 'common' ? '0' : '2 3'}
			/>
			<g transform="translate(30 30)">
				<Carving kind={achievement.glyph} />
			</g>
			{achievement.rarity === 'epic' || achievement.rarity === 'legendary' ? (
				<g clipPath={`url(#${id}-c)`}>
					<path className="pg-shine" d="M-10 70L50 -10l16 0L6 80z" fill="#fff" opacity="0" />
				</g>
			) : null}
			{locked ? (
				<g
					transform="translate(64 64)"
					fill="none"
					stroke={PAPER}
					strokeWidth="2.6"
					strokeLinecap="round"
				>
					<rect x="3" y="9" width="18" height="13" rx="2" fill="#1a1712" />
					<path d="M7 9V6a5 5 0 0 1 10 0v3" />
				</g>
			) : null}
		</svg>
	)
}
