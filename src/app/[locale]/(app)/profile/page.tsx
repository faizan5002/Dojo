import type { Metadata } from 'next'
import { ProfileActions } from '@/features/app-shell/profile-actions'
import { BadgeShowcase } from '@/features/progression/ui/badge-showcase'
import { Heatmap } from '@/features/progression/ui/heatmap'
import { InkBanner } from '@/features/progression/ui/ink-banner'
import { TrainingBand } from '@/features/progression/ui/progression-bands'
import { requireUser } from '@/server/auth/current-user'

export const metadata: Metadata = { title: { absolute: 'Your profile | Dojo' } }

export default async function ProfilePage() {
	const user = await requireUser()
	const initial = user.email.trim().charAt(0).toUpperCase() || '?'
	return (
		<main className="flex flex-col gap-8 px-5 py-8 md:px-10 md:py-10">
			<header className="dj-banner dj-rise">
				<InkBanner />
				<span
					aria-hidden="true"
					className="border-accent flex size-12 shrink-0 items-center justify-center rounded-full border text-xl md:size-16 md:text-2xl"
				>
					{initial}
				</span>
				<div className="flex min-w-0 flex-col gap-1">
					<h1 className="app-heading !text-[clamp(22px,3vw,38px)] max-md:!text-[20px]">
						Your training record
					</h1>
					<p className="text-text-muted truncate text-sm">{user.email}</p>
				</div>
			</header>
			<TrainingBand />
			<ProfileActions />
			<p className="dj-divider" aria-hidden="true">
				<i /> Training history
			</p>
			<Heatmap />
			<BadgeShowcase />
		</main>
	)
}
