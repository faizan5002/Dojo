import { useId } from 'react'
import { cn } from '@/lib/cn'

/** The streak flame, painted with a dry brush in flat vermilion and gold; a cold ember in grey ink when out. */
export function Flame({
	size = 96,
	lit = true,
	className
}: {
	size?: number
	lit?: boolean
	className?: string
}) {
	const id = useId()
	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 100 124"
			width={size}
			height={(size * 124) / 100}
			className={cn('pg-flame', lit && 'pg-flame-lit', className)}
		>
			<defs>
				<filter id={`${id}-b`} x="-10%" y="-10%" width="120%" height="120%">
					<feTurbulence
						type="fractalNoise"
						baseFrequency="0.75"
						numOctaves="2"
						seed="7"
						result="n"
					/>
					<feDisplacementMap in="SourceGraphic" in2="n" scale="3.4" />
				</filter>
			</defs>
			<g filter={`url(#${id}-b)`}>
				<path
					className="pg-flame-outer"
					fill={lit ? '#d6452b' : '#8f8573'}
					d="M52 4c4 18 24 30 32 52 8 22 0 44-18 56-8 6-18 8-27 6C22 114 10 98 12 78c1-14 9-22 15-32 3 10 8 14 13 14-6-22 0-42 12-56z"
				/>
				<path
					className="pg-flame-inner"
					fill={lit ? '#f1c15a' : '#b8ae98'}
					d="M51 54c3 12 16 22 20 36 4 14-4 26-16 30-12 3-26-6-25-22 1-9 6-14 10-20 2 6 5 8 8 8-3-12-1-22 3-32z"
				/>
			</g>
		</svg>
	)
}

const EMBERS = [
	{ x: '34%', s: '3px', d: '3.2s', w: '0s', dx: '-14px' },
	{ x: '48%', s: '2px', d: '2.6s', w: '0.7s', dx: '10px' },
	{ x: '58%', s: '4px', d: '3.6s', w: '1.3s', dx: '18px' },
	{ x: '42%', s: '2px', d: '2.9s', w: '1.9s', dx: '-8px' },
	{ x: '52%', s: '3px', d: '3.4s', w: '2.4s', dx: '6px' }
]

/** A few embers drifting up behind the flame. Decorative, and off under reduced motion. */
export function Embers() {
	return (
		<div className="dj-embers" aria-hidden="true">
			{EMBERS.map((ember) => (
				<i
					key={ember.x}
					style={
						{
							'--x': ember.x,
							'--s': ember.s,
							'--d': ember.d,
							'--w': ember.w,
							'--dx': ember.dx
						} as React.CSSProperties
					}
				/>
			))}
		</div>
	)
}
