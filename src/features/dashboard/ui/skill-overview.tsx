import { useFormatter, useTranslations } from 'next-intl'
import { ArrowUpRightIcon } from '@/components/ui/icons'
import { PROFICIENCY_BANDS } from '@/features/assessment/rubric'
import { SkillGlyph } from '@/features/app-shell/skill-glyph'
import { Link } from '@/i18n/routing'
import type { DashboardModel } from '../dashboard-model'
import { Change } from './change'

const MARKERS = PROFICIENCY_BANDS.filter((band) => band.min > 0).map((band) => band.min)
const PIPS = { insufficient: 0, limited: 2, strong: 3 } as const

/** Evidence strength drawn as three pips, and always written out beside them. */
function Pips({ level }: { level: keyof typeof PIPS }) {
	return (
		<span aria-hidden="true" className="app-pips">
			{[1, 2, 3].map((pip) => (
				<i key={pip} data-on={PIPS[level] >= pip} />
			))}
		</span>
	)
}

/**
 * The five skills of the assessment on one 0 to 100 scale, as five cards. Each card is a
 * link to the evidence for that skill and says so: its name includes the score and
 * level. Each carries its own glyph, a ring and level bar for the score, and a pip
 * indicator for how much evidence stands behind it. The focus skill and the strongest one
 * are tagged once, here.
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
		<section aria-labelledby="skills-heading" className="flex flex-col gap-5">
			<div className="flex flex-col gap-1">
				<h2 id="skills-heading" className="app-eyebrow">
					<b>●</b> {t('heading')}
				</h2>
				<p className="text-text-muted text-sm max-md:hidden">{t('intro')}</p>
			</div>
			<ul
				className="grid gap-4 max-md:-mx-4 max-md:flex max-md:snap-x max-md:overflow-x-auto max-md:px-4 max-md:pb-2 sm:grid-cols-2 xl:grid-cols-5"
				data-testid="skill-cards"
			>
				{skills.map((row) => {
					const name = tSkill(`${row.skill}.name`)
					const level = row.proficiency == null ? null : tLevel(row.proficiency)
					return (
						<li
							key={row.skill}
							className="flex max-md:w-[10.5rem] max-md:shrink-0 max-md:snap-start"
						>
							<Link
								href={`/assessment?id=${assessmentId}#skill-${row.skill}`}
								aria-label={
									row.score == null || level == null
										? t('linkNameUnscored', { skill: name })
										: t('linkName', { skill: name, score: row.score, level })
								}
								className={`app-skill-card group flex w-full flex-col gap-3 border p-4 md:gap-4 md:p-5 ${
									row.isFocus ? 'border-accent bg-surface' : 'border-border-strong bg-surface'
								}`}
							>
								<span className="flex items-start justify-between gap-3">
									<SkillGlyph skill={row.skill} active={row.isFocus} />
									<ArrowUpRightIcon
										size={14}
										className="text-text-faint group-hover:text-text mt-1"
									/>
								</span>
								<span className="flex flex-col gap-2">
									<span className="text-base leading-snug">{name}</span>
									<span className="flex flex-wrap gap-2">
										{row.isFocus ? (
											<span className="app-chip app-chip-risk">{t('focusTag')}</span>
										) : null}
										{row.isStrongest ? <span className="app-chip">{t('strongestTag')}</span> : null}
									</span>
								</span>
								{row.score == null ? (
									<span className="app-eyebrow">{t('notScored')}</span>
								) : (
									<span className="flex items-center gap-4">
										<span
											className={`app-ring app-ring-sm ${row.isFocus ? '' : 'app-ring-quiet'}`}
											style={{ '--v': row.score } as React.CSSProperties}
										>
											<span className="app-number !text-lg">{format.number(row.score)}</span>
										</span>
										<span className="flex min-w-0 flex-1 flex-col gap-2">
											<span className="text-text-muted text-xs">{level}</span>
											<span
												aria-hidden="true"
												className={`app-meter ${row.isFocus ? '' : 'app-meter-quiet'}`}
											>
												<span style={{ width: `${row.score}%` }} />
												{MARKERS.map((marker) => (
													<i key={marker} style={{ left: `${marker}%` }} />
												))}
											</span>
										</span>
									</span>
								)}
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
								<span className="border-border text-text-muted mt-auto flex items-center justify-between gap-3 border-t pt-3 text-xs max-md:hidden">
									<Pips level={row.confidence} />
									<span>{tConfidence(`${row.confidence}.label`)}</span>
								</span>
							</Link>
						</li>
					)
				})}
			</ul>
			<p className="text-text-faint text-xs max-md:hidden">
				{t('markers')}
				{anyProvisional ? ` ${t('provisionalNote')}` : ''}
			</p>
		</section>
	)
}
