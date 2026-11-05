import { useId } from 'react'
import { cn } from '@/lib/cn'

// One drawn icon per recurring idea, used for that idea everywhere:
//   streak: flame (flame.tsx)          xp: sen coin (XpIcon)
//   training: crossed swords           assessment: scroll
//   evidence: loupe over an ink dot    achievement: crest (mon)
//   rank: brush emblem (RankEmblem)    quest: nobori banner
// All share a 24-unit grid and a 1.8 round stroke, so they sit together.

type IconProps = { size?: number; className?: string }

function Frame({ size = 20, className, children }: IconProps & { children: React.ReactNode }) {
	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 24 24"
			width={size}
			height={size}
			fill="none"
			stroke="currentColor"
			strokeWidth="1.8"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={cn('shrink-0', className)}
		>
			{children}
		</svg>
	)
}

export const SwordsIcon = (props: IconProps) => (
	<Frame {...props}>
		<path d="M4.5 19.5L17.5 4.5M6.3 14.1l3.4 2.8M3.5 17l3 3" />
		<path d="M19.5 19.5L6.5 4.5M17.7 14.1l-3.4 2.8M20.5 17l-3 3" />
	</Frame>
)

export const ScrollIcon = (props: IconProps) => (
	<Frame {...props}>
		<path d="M7 4h11a2 2 0 0 1 2 2v11a3 3 0 0 1-3 3H7" />
		<path d="M7 4a2 2 0 0 0-2 2v11a3 3 0 0 0 3 3" />
		<path d="M10 9h6M10 13h6" />
	</Frame>
)

export const EvidenceIcon = (props: IconProps) => (
	<Frame {...props}>
		<circle cx="10.5" cy="10.5" r="6" />
		<path d="M15 15l5.5 5.5" />
		<circle cx="10.5" cy="10.5" r="1.7" fill="currentColor" stroke="none" />
	</Frame>
)

export const CrestIcon = (props: IconProps) => (
	<Frame {...props}>
		<circle cx="12" cy="12" r="9" />
		<path d="M12 6.5l4.5 5.5-4.5 5.5L7.5 12z" />
		<circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
	</Frame>
)

export const ToriiIcon = (props: IconProps) => (
	<Frame {...props}>
		<path d="M3.5 6.5c3 1.2 14 1.2 17 0M6 10.5h12M7.5 7v13.5M16.5 7v13.5" />
	</Frame>
)

export const QuestIcon = (props: IconProps) => (
	<Frame {...props}>
		<path d="M6.5 3.5v17M6.5 5h11l-2.5 3.8 2.5 3.7h-11" />
	</Frame>
)

/** Prompt clarity: a brush loaded with ink. */
export const BrushIcon = (props: IconProps) => (
	<Frame {...props}>
		<path d="M19.5 3.5c-4 1-9 6-11 10l2.5 2.5c4-2 9-7 10-11z" />
		<path d="M8.5 14c-2.5 0-3.5 2-3.5 4 0 .8-.6 1.5-1.5 1.8 3.5 1.2 7-.2 7.5-3.8" />
	</Frame>
)

/** Planning before coding: a route drawn on a folding fan. */
export const PlanIcon = (props: IconProps) => (
	<Frame {...props}>
		<path d="M3.5 18L12 6l8.5 12z" />
		<path d="M12 6v12M7.7 12l1.6 6M16.3 12l-1.6 6" />
		<path d="M3.5 18h17" />
	</Frame>
)

/** Verifying AI output: a seal with the check cut into it. */
export const VerifyIcon = (props: IconProps) => (
	<Frame {...props}>
		<rect x="4" y="4" width="16" height="16" rx="3" />
		<path d="M8.5 12.3l2.5 2.5 4.7-5.2" />
	</Frame>
)

/** Iteration quality: the ink circle that returns to itself. */
export const CycleIcon = (props: IconProps) => (
	<Frame {...props}>
		<path d="M19 12a7 7 0 1 1-2.2-5.1" />
		<path d="M19.5 4.5v4.2h-4.2" />
	</Frame>
)

/** Scope control: one blade, one line, nothing beyond the gate. */
export const ScopeIcon = (props: IconProps) => (
	<Frame {...props}>
		<path d="M4 20L19 5" />
		<path d="M14.5 5.5h4.5v4.5" />
		<path d="M7 17l-3 3M9 14l3 3" />
	</Frame>
)

/** A paper lantern: for quiet corners, and the small flicker of a place being lived in. */
export const LanternIcon = (props: IconProps) => (
	<Frame {...props}>
		<path d="M9 3.5h6M10 3.5v2h4v-2" />
		<path d="M8 5.5c-2 2-2 11 0 13h8c2-2 2-11 0-13z" />
		<path d="M8.4 9.5h7.2M8.4 14.5h7.2" />
		<path d="M10 18.5v2h4v-2" />
	</Frame>
)

/** Experience points are a sen coin: round, with the square hole. Brass when filled. */
export function XpIcon({ size = 20, className, filled = false }: IconProps & { filled?: boolean }) {
	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 24 24"
			width={size}
			height={size}
			className={cn('shrink-0', className)}
		>
			<circle
				cx="12"
				cy="12"
				r="9.5"
				fill={filled ? 'var(--gold)' : 'none'}
				stroke={filled ? 'var(--brass)' : 'currentColor'}
				strokeWidth="1.8"
			/>
			<rect
				x="8.6"
				y="8.6"
				width="6.8"
				height="6.8"
				rx="0.6"
				fill={filled ? 'var(--surface)' : 'none'}
				stroke={filled ? 'var(--brass)' : 'currentColor'}
				strokeWidth="1.6"
			/>
		</svg>
	)
}

/** The hanko: a vermilion stamp with the crest cut into it. A mark, not a letter. */
export function HankoMark({ size = 36, className }: IconProps) {
	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 40 40"
			width={size}
			height={size}
			className={cn('shrink-0', className)}
			style={{ transform: 'rotate(-4deg)' }}
		>
			<rect x="2" y="2" width="36" height="36" rx="5" fill="var(--accent)" />
			<rect
				x="5.5"
				y="5.5"
				width="29"
				height="29"
				rx="3"
				fill="none"
				stroke="#fff8ec"
				strokeOpacity="0.55"
				strokeWidth="1.2"
			/>
			<circle cx="20" cy="20" r="9" fill="none" stroke="#fff8ec" strokeWidth="2.2" />
			<path d="M20 12.5l5.5 7.5-5.5 7.5-5.5-7.5z" fill="#fff8ec" />
		</svg>
	)
}

/**
 * The rank emblem: an ink enso painted with a dry brush, its stroke filled in brass as XP
 * grows toward the next rank, and one vermilion brush stroke for each rank held.
 */
export function RankEmblem({
	level,
	pct = 0,
	size = 120,
	className
}: {
	level: number
	pct?: number
	size?: number
	className?: string
}) {
	const id = useId()
	const bars = Math.min(Math.max(level, 1), 7)
	const gap = 7.5
	const start = 50 - ((bars - 1) * gap) / 2
	return (
		<svg
			role="img"
			aria-label={`Rank ${level}`}
			viewBox="0 0 100 100"
			width={size}
			height={size}
			className={cn('dj-rank-emblem shrink-0', className)}
		>
			<defs>
				<filter id={`${id}-b`} x="-10%" y="-10%" width="120%" height="120%">
					<feTurbulence
						type="fractalNoise"
						baseFrequency="0.9"
						numOctaves="2"
						seed="4"
						result="n"
					/>
					<feDisplacementMap in="SourceGraphic" in2="n" scale="2.6" />
				</filter>
			</defs>
			<g transform="rotate(-125 50 50)" filter={`url(#${id}-b)`}>
				<circle
					cx="50"
					cy="50"
					r="40"
					fill="none"
					stroke="var(--text)"
					strokeOpacity="0.28"
					strokeWidth="7"
					strokeLinecap="round"
					pathLength="1"
					strokeDasharray="0.86 1"
				/>
				<circle
					className="dj-rank-arc"
					cx="50"
					cy="50"
					r="40"
					fill="none"
					stroke="var(--brass)"
					strokeWidth="8"
					strokeLinecap="round"
					pathLength="1"
					strokeDasharray={`${(0.86 * Math.min(Math.max(pct, 0.02), 1)).toFixed(3)} 1`}
				/>
			</g>
			<g filter={`url(#${id}-b)`} fill="var(--accent)">
				{Array.from({ length: bars }, (_, i) => (
					<rect
						key={i}
						x={start + i * gap - 1.7}
						y={36 + (i % 2) * 1.5}
						width="4"
						height={26 - (i % 2) * 3}
						rx="1.7"
					/>
				))}
			</g>
		</svg>
	)
}

/** A short ink-brush stroke used as a section divider: heavy at one end, dry at the other. */
export function BrushDivider({ className }: { className?: string }) {
	const id = useId()
	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 300 14"
			preserveAspectRatio="none"
			className={cn('dj-brush h-3 w-full', className)}
		>
			<defs>
				<filter id={id}>
					<feTurbulence
						type="fractalNoise"
						baseFrequency="0.6 0.08"
						numOctaves="2"
						seed="9"
						result="n"
					/>
					<feDisplacementMap in="SourceGraphic" in2="n" scale="5" />
				</filter>
			</defs>
			<path
				d="M2 8c40-5 90-6 150-3s110 2 146 0c-40 5-90 7-150 5S50 11 2 8z"
				fill="var(--text)"
				fillOpacity="0.75"
				filter={`url(#${id})`}
			/>
		</svg>
	)
}
