/** Marks a band whose numbers are the demo's, not the assessment's. */
export function DemoTag({ className }: { className?: string }) {
	return (
		<span
			className={`dj-demo-tag ${className ?? ''}`}
			title="Illustrative demo progression, kept in this browser. Your five skill scores are real."
		>
			Demo
		</span>
	)
}
