'use client'

import { useEffect, useRef } from 'react'
import { KageLandingPage } from '@designcodeio/threeui/components/KageLandingPage'
import { useRouter } from '@/i18n/routing'
import '@designcodeio/threeui/style.css'

// The package's frame hardcodes its title ("Kage — ...") and has no prop for
// it, so the accessible name is corrected on the rendered iframe.
const FRAME_TITLE = 'Dojo: train how you work with AI agents'

// The frame loads /landing-pages/kage.html, which is Dojo's adaptation of the
// package document (see public/landing-pages/ADAPTATION.md). Props are the
// documented configuration.
export function KageLanding() {
	const container = useRef<HTMLDivElement>(null)
	const router = useRouter()

	useEffect(() => {
		const frame = container.current?.querySelector('iframe')
		if (frame == null) return
		frame.title = FRAME_TITLE

		// The package's sandbox has no allow-top-navigation and no prop to add
		// it, so a link cannot leave the frame by itself. The frame is
		// same-origin, so its target="_top" links are followed from here.
		const listeners = new AbortController()
		const followLinks = () => {
			frame.contentDocument?.querySelectorAll('a[target="_top"]').forEach((link) => {
				link.addEventListener(
					'click',
					(event) => {
						const href = link.getAttribute('href')
						if (href == null) return
						event.preventDefault()
						router.push(href)
					},
					{ signal: listeners.signal }
				)
			})
		}
		frame.addEventListener('load', followLinks, { signal: listeners.signal })
		followLinks()
		return () => listeners.abort()
	}, [router])

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
