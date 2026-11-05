import { cn } from '@/lib/cn'

/**
 * A sumi-e banner for the head of a screen: ink ridges, a pine, a torii, a small red moon and
 * two paper lanterns that breathe. It is drawn in the page's own ink colour, so it sits on paper
 * by day and on lantern-lit charcoal by night. Decorative only.
 */
export function InkBanner({ className }: { className?: string }) {
	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 800 170"
			preserveAspectRatio="xMaxYMax slice"
			className={cn('dj-ink-banner', className)}
		>
			<circle className="dj-banner-moon" cx="610" cy="62" r="30" fill="var(--accent)" />
			<path
				d="M180 170L300 96l60 40 90-78 90 70 70-40 110 82z"
				fill="var(--text)"
				fillOpacity="0.07"
			/>
			<path
				d="M330 170L460 112l70 36 80-62 80 58 70-34 10 60z"
				fill="var(--text)"
				fillOpacity="0.12"
			/>
			<g fill="var(--text)" fillOpacity="0.8">
				<rect x="528" y="88" width="9" height="82" />
				<rect x="624" y="88" width="9" height="82" />
				<path d="M508 92c28 7 142 7 170 0l-5-14c-28 6-132 6-160 0z" />
				<rect x="534" y="108" width="94" height="7" />
			</g>
			<g
				stroke="var(--text)"
				strokeOpacity="0.55"
				strokeWidth="2.2"
				strokeLinecap="round"
				fill="none"
			>
				<path d="M730 170v-48" />
				<path d="M714 134c10-3 16-8 16-14 0 6 6 11 16 14M716 148c9-3 14-6 14-12 0 6 5 9 14 12" />
			</g>
			{/* lanterns */}
			<g>
				<ellipse
					className="dj-lantern-glow"
					cx="468"
					cy="132"
					rx="26"
					ry="30"
					fill="#e0a640"
					fillOpacity="0.3"
				/>
				<g fill="var(--text)" fillOpacity="0.85">
					<rect x="466" y="86" width="3" height="22" />
					<path d="M456 108h24l-3 30h-18z" fill="#d6452b" fillOpacity="0.9" />
					<rect x="454" y="105" width="28" height="4" />
					<rect x="456" y="138" width="24" height="4" />
				</g>
			</g>
		</svg>
	)
}
