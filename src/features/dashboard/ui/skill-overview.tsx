import { useFormatter, useTranslations } from 'next-intl'
import { ArrowUpRightIcon } from '@/components/ui/icons'
import { PROFICIENCY_BANDS } from '@/features/assessment/rubric'
import { Link } from '@/i18n/routing'
import type { DashboardModel } from '../dashboard-model'
import { Change } from './change'

const MARKERS = PROFICIENCY_BANDS.filter((band) => band.min > 0).map((band) => band.min)

function LevelBar({ score }: { score: number }) {
	return (
		<span aria-hidden="true" className="bg-border relative block h-1.5 w-full">
			<span className="bg-text block h-1.5" style={{ width: `${score}%` }} />
			{MARKERS.map((marker) => (
				<span
					key={marker}
					className="bg-bg absolute top-0 block h-1.5 w-px"
					style={{ left: `${marker}%` }}
				/>
			))}
		</span>
	)
}

/**
 * The five skills of the assessment on one 0 to 100 scale. Each row is a link to
 * the evidence for that skill and says so: an arrow, and a name that includes the
 * score and level. The focus skill and the strongest one are tagged once, here.
 */
export function SkillOverview({
	skills,
	assessmentId
}: {
	skills: DashboardModel['skills']
	assessmentId: string
}) {
	const t = useTranslations('Dashboard.skills')
	const tSkill = useTranslations('Assessment.skills')
	const tLevel = useTranslations('Assessment.proficiency')
	const tConfidence = useTranslations('Assessment.confidence')
	const format = useFormatter()
	const anyProvisional = skills.some((row) => row.comparison.status === 'provisional')
	return (
		<section
			aria-labelledby="skills-heading"
			className="border-border bg-surface flex flex-col gap-4 border p-6"
		>
			<div className="flex flex-col gap-1">
				<h2 id="skills-heading" className="app-eyebrow">
					{t('heading')}
				</h2>
				<p className="text-text-muted text-sm">{t('intro')}</p>
			</div>
			<ul className="flex flex-col">
				{skills.map((row) => {
					const name = tSkill(`${row.skill}.name`)
					const level = row.proficiency == null ? null : tLevel(row.proficiency)
					return (
						<li key={row.skill} className="border-border border-t first:border-t-0">
							<Link
								href={`/assessment?id=${assessmentId}#skill-${row.skill}`}
								aria-label={
									row.score == null || level == null
										? t('linkNameUnscored', { skill: name })
										: t('linkName', { skill: name, score: row.score, level })
								}
								className="group hover:bg-surface-hover -mx-2 flex flex-col gap-2.5 px-2 py-3.5"
							>
								<span className="flex items-baseline justify-between gap-4">
									<span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
										<span className="text-base">{name}</span>
										{row.isFocus ? (
											<span className="app-chip app-chip-risk">{t('focusTag')}</span>
										) : null}
										{row.isStrongest ? <span className="app-chip">{t('strongestTag')}</span> : null}
									</span>
									<span className="flex items-baseline gap-3">
										{row.score == null ? null : (
											<Change
												comparison={row.comparison}
												label={(signed) =>
													row.comparison.status === 'provisional'
														? t('changeProvisional', { value: signed })
														: t('changeLabel', { value: signed })
												}
											/>
										)}
										{row.score == null ? (
											<span className="app-eyebrow">{t('notScored')}</span>
										) : (
											<span className="app-number text-xl">{format.number(row.score)}</span>
										)}
										<ArrowUpRightIcon
											size={12}
											className="text-text-faint group-hover:text-text self-center"
										/>
									</span>
								</span>
								{row.score == null ? null : <LevelBar score={row.score} />}
								<span className="text-text-muted text-xs">
									{[level, tConfidence(`${row.confidence}.label`)]
										.filter((part): part is string => part != null)
										.join(' · ')}
								</span>
							</Link>
						</li>
					)
				})}
			</ul>
			<p className="text-text-faint text-xs">
				{t('markers')}
				{anyProvisional ? ` ${t('provisionalNote')}` : ''}
			</p>
		</section>
	)
}
