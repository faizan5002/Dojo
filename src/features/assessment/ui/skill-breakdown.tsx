import { useTranslations } from 'next-intl'
import { CRITERIA } from '../rubric'
import type { CriterionTally, SkillAssessment } from '../types'
import { EvidenceItem } from './evidence-item'

function Tallies({ label, tallies }: { label: string; tallies: readonly CriterionTally[] }) {
	const t = useTranslations('Assessment.criteria')
	if (tallies.length === 0) return null
	return (
		<div className="flex flex-col gap-1">
			<dt className="app-eyebrow">{label}</dt>
			<dd>
				<ul className="flex flex-col gap-1 text-sm">
					{tallies.map((tally) => (
						<li key={tally.criterion} className="flex justify-between gap-4">
							<span>{t(`${tally.criterion}.label`)}</span>
							<span className="text-text-muted tabular-nums">{tally.count}</span>
						</li>
					))}
				</ul>
			</dd>
		</div>
	)
}

function SkillRow({ skill }: { skill: SkillAssessment }) {
	const t = useTranslations('Assessment')
	const unit = t(`skills.${skill.skill}.unit`, { count: skill.observations })
	return (
		<li id={`skill-${skill.skill}`} className="border-border flex flex-col gap-4 border-b py-7">
			<div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
				<h3 className="text-xl font-normal">{t(`skills.${skill.skill}.name`)}</h3>
				{skill.score == null || skill.proficiency == null ? (
					<p className="app-eyebrow">{t('confidence.insufficient.label')}</p>
				) : (
					<p className="flex items-baseline gap-3">
						<span className="app-number">{skill.score}</span>
						<span className="app-eyebrow">{t(`proficiency.${skill.proficiency}`)}</span>
					</p>
				)}
			</div>
			{skill.score == null ? null : (
				<span aria-hidden="true" className="bg-border block h-0.5">
					<span className="bg-accent block h-0.5" style={{ width: `${skill.score}%` }} />
				</span>
			)}
			<p className="text-text-muted text-sm">{t(`skills.${skill.skill}.summary`)}</p>
			<p className="text-sm">
				<span className="app-eyebrow">{t(`confidence.${skill.confidence}.label`)}</span>
				<span className="text-text-muted">
					{' — '}
					{t(`confidence.${skill.confidence}.detail`, { count: skill.observations, unit })}
				</span>
			</p>
			<dl className="grid gap-4 sm:grid-cols-3">
				<div className="flex flex-col gap-1">
					<dt className="app-eyebrow">{t('breakdown.lookFor')}</dt>
					<dd className="text-text-muted text-sm">
						{CRITERIA[skill.skill].strength
							.map((criterion) => t(`criteria.${criterion}.label`))
							.join(', ')}
					</dd>
				</div>
				<Tallies
					label={t('breakdown.seen')}
					tallies={skill.tallies.filter((tally) => tally.polarity === 'strength')}
				/>
				<Tallies
					label={t('breakdown.missed')}
					tallies={skill.tallies.filter((tally) => tally.polarity === 'opportunity')}
				/>
			</dl>
			{skill.evidence.length === 0 ? (
				<p className="text-text-faint text-sm">{t('breakdown.noEvidence')}</p>
			) : (
				<details className="border-border border-t pt-4">
					<summary className="app-eyebrow text-text cursor-pointer">
						{t('breakdown.evidence', { count: skill.evidence.length })}
					</summary>
					<div className="mt-2 flex flex-col">
						{skill.evidence.map((evidence) => (
							<EvidenceItem key={evidence.id} evidence={evidence} />
						))}
					</div>
				</details>
			)}
		</li>
	)
}

export function SkillBreakdown({ skills }: { skills: readonly SkillAssessment[] }) {
	return (
		<ol className="border-border flex flex-col border-t">
			{skills.map((skill) => (
				<SkillRow key={skill.skill} skill={skill} />
			))}
		</ol>
	)
}
