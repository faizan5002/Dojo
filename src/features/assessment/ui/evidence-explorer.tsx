'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { SkillId } from '../rubric'
import type { Polarity, SkillAssessment } from '../types'
import { EvidenceItem } from './evidence-item'

export function EvidenceExplorer({ skills }: { skills: readonly SkillAssessment[] }) {
	const t = useTranslations('Assessment')
	const [selected, setSelected] = useState<SkillId>(
		() => skills.find((skill) => skill.evidence.length > 0)?.skill ?? 'promptClarity'
	)
	const skill = skills.find((each) => each.skill === selected)
	const group = (polarity: Polarity) =>
		skill?.evidence.filter((evidence) => evidence.polarity === polarity) ?? []

	return (
		<div className="flex flex-col gap-8">
			<div
				className="flex flex-wrap gap-x-6 gap-y-3"
				role="group"
				aria-label={t('explorer.heading')}
			>
				{skills.map((each) => (
					<button
						key={each.skill}
						type="button"
						aria-pressed={each.skill === selected}
						className="app-nav-link"
						onClick={() => setSelected(each.skill)}
					>
						{t(`skills.${each.skill}.name`)} ({each.evidence.length})
					</button>
				))}
			</div>
			{skill == null || skill.evidence.length === 0 ? (
				<p className="text-text-faint text-sm">{t('breakdown.noEvidence')}</p>
			) : (
				<div className="grid gap-10 lg:grid-cols-2">
					{(['strength', 'opportunity'] as const).map((polarity) => (
						<div key={polarity} className="flex flex-col gap-2">
							<h3 className="app-eyebrow">
								{polarity === 'strength' ? t('explorer.strengths') : t('explorer.opportunities')}
							</h3>
							{group(polarity).length === 0 ? (
								<p className="text-text-faint text-sm">{t('profile.none')}</p>
							) : (
								<div className="border-border flex flex-col border-t">
									{group(polarity).map((evidence) => (
										<EvidenceItem key={evidence.id} evidence={evidence} />
									))}
								</div>
							)}
						</div>
					))}
				</div>
			)}
		</div>
	)
}
