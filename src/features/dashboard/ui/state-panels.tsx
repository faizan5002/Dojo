import { useTranslations } from 'next-intl'
import { ArrowUpRightIcon } from '@/components/ui/icons'
import { Link } from '@/i18n/routing'
import type { DashboardModel } from '../dashboard-model'

const FRAME = 'border-border-strong bg-surface flex flex-col items-start gap-6 border p-6 md:p-8'
const STEPS = ['upload', 'score', 'practise'] as const

/** A brand-new account: what Dojo does, what uploading gives you, one way to start. */
export function EmptyPanel() {
	const t = useTranslations('Dashboard.empty')
	return (
		<section aria-labelledby="state-heading" className={FRAME}>
			<div className="flex max-w-2xl flex-col gap-3">
				<h2 id="state-heading" className="app-heading">
					{t('title')}
				</h2>
				<p className="text-text-muted">{t('body')}</p>
			</div>
			<ol className="grid w-full gap-6 md:grid-cols-3">
				{STEPS.map((step, index) => (
					<li key={step} className="border-border flex flex-col gap-2 border-t pt-4">
						<span className="app-eyebrow">
							<b>{String(index + 1).padStart(2, '0')}</b> · {t(`steps.${step}.title`)}
						</span>
						<p className="text-text-muted text-sm">{t(`steps.${step}.body`)}</p>
					</li>
				))}
			</ol>
			<Link href="/sessions" className="app-pill">
				{t('action')}
				<ArrowUpRightIcon size={14} />
			</Link>
		</section>
	)
}

/** Uploaded, not scored: scoring is the one primary action; uploading more is secondary. */
export function ToScorePanel({ uploadId }: { uploadId: string }) {
	const t = useTranslations('Dashboard.toScore')
	return (
		<section aria-labelledby="state-heading" className={FRAME}>
			<div className="flex max-w-2xl flex-col gap-3">
				<h2 id="state-heading" className="app-heading">
					{t('title')}
				</h2>
				<p className="text-text-muted">{t('body')}</p>
			</div>
			<div className="flex flex-wrap items-center gap-x-6 gap-y-2">
				<Link href={`/assessment?upload=${uploadId}`} className="app-pill">
					{t('action')}
					<ArrowUpRightIcon size={14} />
				</Link>
				<Link href="/sessions" className="app-nav-link">
					{t('secondary')}
				</Link>
			</div>
		</section>
	)
}

/**
 * Scored, but with too little evidence for an overall score. One panel, not five:
 * the rubric's own rule, and for each skill how much it has against how much it needs.
 */
export function InsufficientPanel({
	insufficient
}: {
	insufficient: NonNullable<DashboardModel['insufficient']>
}) {
	const t = useTranslations('Dashboard.insufficient')
	const tSkill = useTranslations('Assessment.skills')
	return (
		<section aria-labelledby="state-heading" className={FRAME}>
			<div className="flex max-w-2xl flex-col gap-3">
				<h2 id="state-heading" className="app-heading">
					{t('title')}
				</h2>
				<p className="text-text-muted">
					{t('body', { min: insufficient.minSkills, count: insufficient.skillsAssessed })}
				</p>
			</div>
			<div className="flex w-full max-w-2xl flex-col gap-2">
				<h3 className="app-eyebrow">{t('needsHeading')}</h3>
				<ul className="border-border border-t">
					{insufficient.needs.map((need) => (
						<li
							key={need.skill}
							className="border-border flex items-baseline justify-between gap-4 border-b py-2.5 text-sm"
						>
							<span>{tSkill(`${need.skill}.name`)}</span>
							<span className="text-text-muted tabular-nums">
								{t('need', {
									observations: need.observations,
									needed: need.needed,
									unit: tSkill(`${need.skill}.unit`, { count: need.needed })
								})}
							</span>
						</li>
					))}
				</ul>
			</div>
			<p className="text-text-muted max-w-2xl text-sm">{t('next')}</p>
			<div className="flex flex-wrap items-center gap-x-6 gap-y-2">
				<Link href="/sessions" className="app-pill">
					{t('action')}
					<ArrowUpRightIcon size={14} />
				</Link>
				<Link href={`/assessment?id=${insufficient.assessmentId}`} className="app-nav-link">
					{t('secondary')}
				</Link>
			</div>
		</section>
	)
}
