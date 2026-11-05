'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Tab, TabList, TabPanel, Tabs } from '@/components/base/tabs/tabs'
import { SKILL_IDS, type SkillId } from '../rubric'
import type { Polarity, SkillAssessment } from '../types'
import { EvidenceItem } from './evidence-item'

const isSkillId = (key: unknown): key is SkillId =>
	typeof key === 'string' && SKILL_IDS.some((skill) => skill === key)

/**
 * The evidence of one skill at a time, as tabs: arrow keys move between skills,
 * the selected tab owns its panel, and each tab shows how many quotes it holds.
 * The tabs and their keyboard behaviour are BoardUI's Tabs (React Aria).
 */
export function EvidenceExplorer({ skills }: { skills: readonly SkillAssessment[] }) {
	const t = useTranslations('Assessment')
	const [selected, setSelected] = useState<SkillId>(
		() => skills.find((skill) => skill.evidence.length > 0)?.skill ?? 'promptClarity'
	)

	return (
		<Tabs
			selectedKey={selected}
			onSelectionChange={(key) => {
				if (isSkillId(key)) setSelected(key)
			}}
			className="gap-8"
		>
			<TabList aria-label={t('explorer.heading')}>
				{skills.map((each) => (
					<Tab key={each.skill} id={each.skill} count={each.evidence.length}>
						{t(`skills.${each.skill}.name`)}
					</Tab>
				))}
			</TabList>
			{skills.map((skill) => {
				const group = (polarity: Polarity) =>
					skill.evidence.filter((evidence) => evidence.polarity === polarity)
				return (
					<TabPanel key={skill.skill} id={skill.skill}>
						{skill.evidence.length === 0 ? (
							<p className="text-text-faint text-sm">{t('breakdown.noEvidence')}</p>
						) : (
							<div className="grid gap-10 lg:grid-cols-2">
								{(['strength', 'opportunity'] as const).map((polarity) => (
									<div key={polarity} className="flex flex-col gap-2">
										<h3 className="app-eyebrow">
											{polarity === 'strength'
												? t('explorer.strengths')
												: t('explorer.opportunities')}
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
					</TabPanel>
				)
			})}
		</Tabs>
	)
}
