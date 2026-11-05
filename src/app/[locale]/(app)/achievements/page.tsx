import type { Metadata } from 'next'
import { ACHIEVEMENTS, type Rarity } from '@/features/progression/model'
import { BadgeArt } from '@/features/progression/ui/badge-art'
import { BadgeShowcase } from '@/features/progression/ui/badge-showcase'
import { DemoBanner } from '@/features/progression/ui/demo-banner'
import { CrestIcon } from '@/features/progression/ui/dojo-icons'
import { InkBanner } from '@/features/progression/ui/ink-banner'
import { requireUser } from '@/server/auth/current-user'

export const metadata: Metadata = { title: { absolute: 'Achievements | Dojo' } }

const RARITIES: readonly { rarity: Rarity; name: string; shape: string }[] = [
	{ rarity: 'common', name: 'Common', shape: 'Round seal, carved ink' },
	{ rarity: 'rare', name: 'Rare', shape: 'Indigo seal' },
	{ rarity: 'epic', name: 'Epic', shape: 'Scalloped brass' },
	{ rarity: 'legendary', name: 'Legendary', shape: 'Scalloped vermilion and gold' }
]

export default async function AchievementsPage() {
	await requireUser()
	return (
		<main className="flex flex-col gap-6 px-5 py-8 md:px-10 md:py-10">
			<header className="dj-banner dj-rise">
				<InkBanner />
				<CrestIcon size={34} className="text-text" />
				<h1 className="app-heading !text-[clamp(24px,3vw,38px)] max-md:!text-[22px]">
					Seal cabinet
				</h1>
			</header>
			<DemoBanner />
			<ul
				className="grid grid-cols-[repeat(4,minmax(0,1fr))] gap-2 md:gap-6"
				aria-label="Rarity guide"
			>
				{RARITIES.map(({ rarity, name, shape }) => {
					const sample = ACHIEVEMENTS.find((achievement) => achievement.rarity === rarity)
					return (
						<li
							key={rarity}
							className="flex flex-col items-center gap-1 text-center md:flex-row md:gap-3 md:text-left"
							title={shape}
						>
							{sample == null ? null : <BadgeArt achievement={sample} size={44} />}
							<b className="text-text text-xs font-normal md:text-sm">{name}</b>
						</li>
					)
				})}
			</ul>
			<BadgeShowcase />
		</main>
	)
}
