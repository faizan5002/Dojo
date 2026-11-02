import { DOTS, DOT_RADIUS, DOT_VIEWBOX } from './dot-grid'

export function DotMark({ className }: { className?: string }) {
	return (
		<svg
			viewBox={`0 0 ${DOT_VIEWBOX.width} ${DOT_VIEWBOX.height}`}
			fill="currentColor"
			aria-hidden="true"
			className={className}
		>
			{DOTS.map(({ x, y }) => (
				<circle key={`${x}:${y}`} cx={x} cy={y} r={DOT_RADIUS} />
			))}
		</svg>
	)
}
