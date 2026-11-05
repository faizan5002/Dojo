import { BadgeShowcase } from './badge-showcase'
import { DemoBanner } from './demo-banner'
import { Heatmap } from './heatmap'
import { LevelCard } from './level-card'
import { MobileHome } from './mobile-home'
import { QuestsPanel } from './quests-panel'
import { StreakCard } from './streak-card'

/**
 * The first thing under the headline: rank and XP, the flame, and the day's objectives.
 * The flame stands tall on one side; rank and objectives stack on the other, so the three
 * read as different things, not as three equal cards.
 */
export function TrainingBand() {
	return (
		<section aria-label="Training status" className="flex flex-col gap-4">
			<DemoBanner />
			<div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
				<div className="dj-rise flex flex-col gap-7" style={{ '--i': 1 } as React.CSSProperties}>
					<LevelCard className="dj-hide-phone" />
					<MobileHome className="dj-only-phone" />
					<QuestsPanel />
				</div>
				<StreakCard className="dj-rise dj-hide-phone" />
			</div>
		</section>
	)
}

/** Training grounds (the heatmap) beside the seal cabinet. */
export function CollectionBand() {
	return (
		<div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[1.15fr_1fr] xl:items-start">
			<Heatmap />
			<BadgeShowcase layout="shelf" />
		</div>
	)
}
