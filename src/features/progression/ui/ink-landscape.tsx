/**
 * A sumi-e landscape for the lower half of a hanging scroll: layered ink mountains, a gold
 * moon and a pine. It fills what would otherwise be empty space with something to look at.
 */
export function InkLandscape({ className }: { className?: string }) {
	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 300 160"
			preserveAspectRatio="xMidYMax slice"
			className={className}
		>
			<circle cx="206" cy="54" r="11" fill="#c9a24a" fillOpacity="0.6" />
			<path
				d="M0 120L46 70l24 28 38-52 44 66 30-30 50 56 68-40v62H0z"
				fill="var(--text)"
				fillOpacity="0.07"
			/>
			<path
				d="M0 138l52-46 30 30 46-56 40 52 34-24 44 48 54-30v46H0z"
				fill="var(--text)"
				fillOpacity="0.12"
			/>
			<path d="M0 160v-14c40-10 80-4 120-8s90-14 180 6v16z" fill="var(--text)" fillOpacity="0.2" />
			<g
				stroke="var(--text)"
				strokeOpacity="0.45"
				strokeWidth="1.6"
				strokeLinecap="round"
				fill="none"
			>
				<path d="M246 156v-32" />
				<path d="M236 134c7-2 10-6 10-10 0 4 3 8 10 10M238 144c6-2 8-5 8-9 0 4 2 7 8 9" />
			</g>
		</svg>
	)
}
