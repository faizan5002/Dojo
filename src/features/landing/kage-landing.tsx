'use client'

import { useEffect, useRef } from 'react'
import { KageLandingPage } from '@designcodeio/threeui/components/KageLandingPage'
import '@designcodeio/threeui/style.css'

// The package's frame hardcodes its title ("Kage — ...") and has no prop for
// it, so the accessible name is corrected on the rendered iframe.
const FRAME_TITLE = 'Dojo: train how you work with AI agents'

// The frame loads /landing-pages/kage.html, which is Dojo's adaptation of the
// package document (see public/landing-pages/ADAPTATION.md). Props are the
// documented configuration.
export function KageLanding() {
	const container = useRef<HTMLDivElement>(null)

	useEffect(() => {
		const frame = container.current?.querySelector('iframe')
		if (frame) frame.title = FRAME_TITLE
	}, [])

	return (
		<div ref={container} className="h-dvh w-full bg-black">
			<KageLandingPage
				headingFont="onest"
				bodyFont="onest"
				headingWeight="400"
				bodyWeight="300"
				primaryColor="#e0231c"
				headingSize={46}
				bodySize={17}
				headingLetterSpacing={-0.012}
			/>
		</div>
	)
}
