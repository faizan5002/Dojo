import { useFormatter, useTranslations } from 'next-intl'
import { SectionHeading, Stat } from '@/features/app-shell/section'
import type { MetricsOverview } from '@/features/sessions/metrics'
import { MIN_SKILLS_FOR_OVERALL } from '../rubric'
import type { Assessment, Evidence } from '../types'
import { EvidenceExplorer } from './evidence-explorer'
import { RecommendationList } from './recommendation-list'
import { SkillBreakdown } from './skill-breakdown'
import { WorkflowProfile } from './workflow-profile'

const ONE_DECIMAL = { maximumFractionDigits: 1 } as const
const TWO_DECIMALS = { maximumFractionDigits: 2 } as const
const WHOLE_PERCENT = { style: 'percent', maximumFractionDigits: 0 } as const

// The free metrics, beside the rubric as context only: none of them feeds a score.
function MetricsContext({ overview }: { overview: MetricsOverview }) {
	const t = useTranslations('Assessment.context')
	const tSessions = useTranslations('Sessions')
	const format = useFormatter()
	const show = (
		value: number | null,
		options: typeof ONE_DECIMAL | typeof TWO_DECIMALS | typeof WHOLE_PERCENT
	) => (value == null ? tSessions('notAvailable') : format.number(value, options))
	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-1">
				<h3 className="app-eyebrow">{t('heading')}</h3>
				<p className="text-text-muted text-sm">{t('note')}</p>
			</div>
			<dl className="border-border grid grid-cols-2 border-t border-l lg:grid-cols-4">
				<Stat
					label={tSessions('overview.averagePromptWords')}
					value={tSessions('units.words', {
						value: show(overview.averagePromptWords, ONE_DECIMAL)
					})}
				/>
				<Stat
					label={tSessions('overview.pasteRatio')}
					value={show(overview.pasteRatio, WHOLE_PERCENT)}
				/>
				<Stat
					label={tSessions('overview.promptToResponseRatio')}
					value={show(overview.promptToResponseRatio, TWO_DECIMALS)}
				/>
				<Stat
					label={tSessions('overview.averageGap')}
					value={
						overview.averageGapMinutes == null
							? tSessions('notAvailable')
							: tSessions('units.minutes', { value: show(overview.averageGapMinutes, ONE_DECIMAL) })
					}
				/>
			</dl>
		</div>
	)
}

export function AssessmentReport({
	assessment,
	overview
}: {
	assessment: Assessment
	overview: MetricsOverview | null
}) {
	const t = useTranslations('Assessment')
	const { overall } = assessment
	const evidenceById = new Map<string, Evidence>(
		assessment.skills.flatMap((skill) => skill.evidence.map((evidence) => [evidence.id, evidence]))
	)
	const skillName = (skill: typeof overall.strongest) =>
		skill == null ? t('overall.notComparable') : t(`skills.${skill}.name`)

	return (
		<div className="flex flex-col gap-20">
			<section aria-labelledby="overall-heading" className="flex flex-col gap-8">
				<SectionHeading id="overall-heading" number="02">
					{t('overall.heading')}
				</SectionHeading>
				<div className="grid gap-10 lg:grid-cols-2 lg:items-end">
					{overall.score == null || overall.proficiency == null ? (
						<div className="flex flex-col gap-3">
							<p className="app-heading">{t('overall.noScore')}</p>
							<p className="text-text-muted text-sm">
								{t('overall.noScoreDetail', {
									min: MIN_SKILLS_FOR_OVERALL,
									count: overall.skillsAssessed
								})}
							</p>
						</div>
					) : (
						<div className="flex flex-col gap-3">
							<p className="flex items-baseline gap-4">
								<span className="app-display" data-testid="overall-score">
									{overall.score}
								</span>
								<span className="app-eyebrow">{t('overall.outOf')}</span>
							</p>
							<p className="app-eyebrow text-text">{t(`proficiency.${overall.proficiency}`)}</p>
						</div>
					)}
					<div className="flex flex-col gap-3">
						<h3 className="app-eyebrow">{t('overall.summary')}</h3>
						{assessment.profile.length === 0 ? (
							<p className="text-text-muted text-sm">{t('overall.summaryEmpty')}</p>
						) : (
							<ul className="flex flex-wrap gap-2">
								{assessment.profile.map((pattern) => (
									<li
										key={pattern.id}
										className={pattern.kind === 'strength' ? 'app-chip' : 'app-chip app-chip-risk'}
									>
										{t(`profile.patterns.${pattern.id}.name`)}
									</li>
								))}
							</ul>
						)}
					</div>
				</div>
				<dl className="border-border grid grid-cols-2 border-t border-l lg:grid-cols-5">
					<Stat label={t('overall.sessions')} value={String(assessment.sessionCount)} />
					<Stat label={t('overall.prompts')} value={String(assessment.promptCount)} />
					<Stat
						label={t('overall.coverage')}
						value={t('overall.coverageValue', { count: overall.skillsAssessed })}
					/>
					<Stat label={t('overall.strongest')} value={skillName(overall.strongest)} />
					<Stat
						className="col-span-2 lg:col-span-1"
						label={t('overall.weakest')}
						value={skillName(overall.weakest)}
					/>
				</dl>
				<div className="text-text-muted flex flex-col gap-1 text-sm">
					<p>{t('overall.coaching', { version: assessment.rubricVersion })}</p>
					<p>{t('overall.redactions', { count: assessment.redactions })}</p>
				</div>
				{overview == null ? null : <MetricsContext overview={overview} />}
			</section>

			<section aria-labelledby="skills-heading" className="flex flex-col gap-8">
				<div className="flex flex-col gap-3">
					<SectionHeading id="skills-heading" number="03">
						{t('breakdown.heading')}
					</SectionHeading>
					<p className="text-text-muted max-w-2xl text-sm">{t('breakdown.description')}</p>
				</div>
				<SkillBreakdown skills={assessment.skills} />
			</section>

			<section aria-labelledby="profile-heading" className="flex flex-col gap-8">
				<div className="flex flex-col gap-3">
					<SectionHeading id="profile-heading" number="04">
						{t('profile.heading')}
					</SectionHeading>
					<p className="text-text-muted max-w-2xl text-sm">{t('profile.description')}</p>
				</div>
				<WorkflowProfile patterns={assessment.profile} evidenceById={evidenceById} />
			</section>

			<section aria-labelledby="explorer-heading" className="flex flex-col gap-8">
				<div className="flex flex-col gap-3">
					<SectionHeading id="explorer-heading" number="05">
						{t('explorer.heading')}
					</SectionHeading>
					<p className="text-text-muted max-w-2xl text-sm">{t('explorer.description')}</p>
				</div>
				<EvidenceExplorer skills={assessment.skills} />
			</section>

			<section aria-labelledby="recommendations-heading" className="flex flex-col gap-8">
				<div className="flex flex-col gap-3">
					<SectionHeading id="recommendations-heading" number="06">
						{t('recommendations.heading')}
					</SectionHeading>
					<p className="text-text-muted max-w-2xl text-sm">{t('recommendations.description')}</p>
				</div>
				<RecommendationList
					recommendations={assessment.recommendations}
					evidenceById={evidenceById}
				/>
			</section>

			<section
				aria-labelledby="about-heading"
				className="border-border flex max-w-3xl flex-col gap-3 border-t pt-8"
			>
				<h2 id="about-heading" className="app-eyebrow">
					{t('about.heading')}
				</h2>
				<p className="text-text-muted text-sm leading-relaxed">
					{t('about.body', { version: assessment.rubricVersion })}
				</p>
			</section>
		</div>
	)
}
