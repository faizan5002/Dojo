import type { Metadata } from 'next'
import { getFormatter, getTranslations } from 'next-intl/server'
import { ArrowUpRightIcon } from '@/components/ui/icons'
import { PageHeader, SectionHeading, Stat } from '@/features/app-shell/section'
import { loadPracticeContext } from '@/features/practice/load-practice'
import { PRACTICE_CONFIG } from '@/features/practice/plan'
import { Link } from '@/i18n/routing'
import { requireUser } from '@/server/auth/current-user'

const PERCENT = 100
const RECENT_ATTEMPTS = 5

export async function generateMetadata({
	params
}: {
	params: Promise<{ locale: string }>
}): Promise<Metadata> {
	const t = await getTranslations({ locale: (await params).locale, namespace: 'Guru' })
	return { title: { absolute: t('meta.title') } }
}

export default async function PromptingGuruPage() {
	const user = await requireUser()
	const [t, tSkills, format, context] = await Promise.all([
		getTranslations('Guru'),
		getTranslations('Assessment.skills'),
		getFormatter(),
		loadPracticeContext(user.id)
	])
	const { plan, summary, attempts, catalog } = context
	const bySlug = (slug: string) => catalog.find((challenge) => challenge.slug === slug) ?? null
	const next = plan.next == null ? null : bySlug(plan.next.slug)
	const skillName = (skill: string) => tSkills(`${skill}.name`)
	const date = (value: Date) => format.dateTime(value, { dateStyle: 'medium' })

	return (
		<main className="flex flex-col gap-16 px-5 py-14 md:px-14 md:py-20">
			<PageHeader eyebrow={t('eyebrow')} title={t('title')} intro={t('intro')} note={t('note')} />

			{plan.mode === 'general' ? (
				<section
					className="border-border flex flex-col gap-4 border-y py-8"
					data-testid="guru-onboarding"
				>
					<h2 className="app-heading">{t('modes.general.title')}</h2>
					<p className="text-text-muted max-w-2xl">{t('modes.general.body')}</p>
					<div className="flex flex-wrap gap-3">
						<Link href="/sessions" className="app-pill">
							{t('modes.general.sessions')}
							<ArrowUpRightIcon size={14} />
						</Link>
						<Link href="/assessment" className="app-pill">
							{t('modes.general.assessment')}
						</Link>
					</div>
				</section>
			) : plan.mode === 'limited' ? (
				<section
					className="border-border flex flex-col gap-3 border-y py-6"
					data-testid="guru-limited"
				>
					<h2 className="app-eyebrow text-text">{t('modes.limited.title')}</h2>
					<p className="text-text-muted max-w-2xl text-sm">{t('modes.limited.body')}</p>
				</section>
			) : null}

			<section aria-labelledby="next-heading" className="flex flex-col gap-6">
				<SectionHeading id="next-heading" number="02">
					{t('next.heading')}
				</SectionHeading>
				{next == null || plan.next == null ? (
					<p className="text-text-muted">{t('next.none')}</p>
				) : (
					<article className="border-border flex flex-col gap-4 border p-6" data-testid="guru-next">
						<p className="app-eyebrow">
							{skillName(next.skill)} · {t(`difficulty.${next.difficulty}`)} ·{' '}
							{t('library.minutes', { minutes: next.minutes })}
						</p>
						<h3 className="app-heading">{next.title}</h3>
						<p className="text-text-muted max-w-2xl">{next.description}</p>
						<p className="text-sm">
							{t(`next.reasons.${plan.next.reason}`, { skill: skillName(plan.next.skill) })}
						</p>
						<Link href={`/prompting-guru/challenges/${next.slug}`} className="app-pill">
							{t('next.start')}
							<ArrowUpRightIcon size={14} />
						</Link>
					</article>
				)}
				<Link href="/prompting-guru/challenges" className="app-nav-link w-fit">
					{t('browse')}
				</Link>
			</section>

			<section aria-labelledby="summary-heading" className="flex flex-col gap-6">
				<SectionHeading id="summary-heading" number="03">
					{t('summary.heading')}
				</SectionHeading>
				<dl className="border-border grid grid-cols-2 border-t border-l lg:grid-cols-3">
					<Stat label={t('summary.attempted')} value={String(summary.attempted)} />
					<Stat
						label={t('summary.completed')}
						value={String(summary.completed)}
						detail={t('summary.completedHint', { score: PRACTICE_CONFIG.completedFrom })}
					/>
					<Stat label={t('summary.attempts')} value={String(summary.attemptCount)} />
					<Stat
						label={t('summary.average')}
						value={summary.averageScore == null ? '—' : String(summary.averageScore)}
					/>
					<Stat
						label={t('summary.best')}
						value={summary.bestScore == null ? '—' : String(summary.bestScore)}
					/>
					<Stat
						label={t('summary.streak')}
						value={t('summary.streakValue', { days: summary.streakDays })}
					/>
				</dl>
			</section>

			<section aria-labelledby="skills-heading" className="flex flex-col gap-6">
				<div className="flex flex-col gap-3">
					<SectionHeading id="skills-heading" number="04">
						{t('skills.heading')}
					</SectionHeading>
					<p className="text-text-muted max-w-2xl text-sm">{t('skills.description')}</p>
				</div>
				<ol className="border-border flex flex-col border-t">
					{plan.skills.map((skill) => (
						<li
							key={skill.skill}
							data-testid={`guru-skill-${skill.skill}`}
							className="border-border flex flex-col gap-3 border-b py-5"
						>
							<div className="flex flex-wrap items-baseline justify-between gap-3">
								<h3 className="text-lg font-normal">
									{skillName(skill.skill)}
									{plan.focus.includes(skill.skill) ? (
										<span className="app-chip app-chip-risk ml-3 align-middle">
											{t('skills.focus')}
										</span>
									) : null}
								</h3>
								<p className="app-eyebrow">
									{t(`priority.${skill.priority}`)} ·{' '}
									{t('skills.share', { share: Math.round(skill.share * PERCENT) })}
								</p>
							</div>
							<dl className="grid gap-4 sm:grid-cols-2">
								<ScoreBar
									label={t('skills.assessment')}
									score={skill.assessmentScore}
									empty={t('skills.notScored')}
									testId="assessment"
								/>
								<ScoreBar
									label={t('skills.practice')}
									score={skill.practiceAverage == null ? null : Math.round(skill.practiceAverage)}
									empty={t('skills.noPractice')}
									detail={
										skill.attempts === 0
											? undefined
											: [
													t('skills.attempts', { count: skill.attempts }),
													skill.trend == null ? null : t(`trend.${skill.trend}`)
												]
													.filter(Boolean)
													.join(' · ')
									}
									testId="practice"
								/>
							</dl>
						</li>
					))}
				</ol>
			</section>

			<section aria-labelledby="due-heading" className="flex flex-col gap-6">
				<SectionHeading id="due-heading" number="05">
					{t('due.heading')}
				</SectionHeading>
				{plan.due.length === 0 ? (
					<p className="text-text-muted text-sm">{t('due.none')}</p>
				) : (
					<ul className="border-border flex flex-col border-t">
						{plan.due.map((item) => {
							const challenge = bySlug(item.slug)
							if (challenge == null) return null
							return (
								<li
									key={item.slug}
									className="border-border flex flex-wrap items-center justify-between gap-3 border-b py-4"
								>
									<div>
										<p>{challenge.title}</p>
										<p className="text-text-muted text-sm">
											{skillName(challenge.skill)} · {t('due.since', { date: date(item.dueAt) })}
										</p>
									</div>
									<Link
										href={`/prompting-guru/challenges/${challenge.slug}`}
										className="app-nav-link"
									>
										{t('next.start')}
									</Link>
								</li>
							)
						})}
					</ul>
				)}
			</section>

			<section aria-labelledby="recent-heading" className="flex flex-col gap-6">
				<SectionHeading id="recent-heading" number="06">
					{t('recent.heading')}
				</SectionHeading>
				{attempts.length === 0 ? (
					<p className="text-text-muted text-sm">{t('recent.none')}</p>
				) : (
					<ul className="border-border flex flex-col border-t">
						{attempts.slice(0, RECENT_ATTEMPTS).map((attempt) => (
							<li
								key={attempt.id}
								className="border-border flex flex-wrap items-center justify-between gap-3 border-b py-4"
							>
								<div>
									<p>
										{attempt.title ?? bySlug(attempt.challengeSlug)?.title ?? attempt.challengeSlug}
									</p>
									<p className="text-text-muted text-sm">
										{skillName(attempt.skill)} · {attempt.score} ·{' '}
										{t(`band.${attempt.evaluation.band}`)} · {date(attempt.createdAt)}
									</p>
								</div>
								<Link
									href={`/prompting-guru/challenges/${attempt.challengeSlug}?attempt=${attempt.id}`}
									className="app-nav-link"
								>
									{t('recent.open')}
								</Link>
							</li>
						))}
					</ul>
				)}
			</section>
		</main>
	)
}

function ScoreBar({
	label,
	score,
	empty,
	detail,
	testId
}: {
	label: string
	score: number | null
	empty: string
	detail?: string
	testId: string
}) {
	return (
		<div className="flex flex-col gap-2" data-testid={testId}>
			<dt className="app-eyebrow">{label}</dt>
			<dd className="flex flex-col gap-2">
				<span className="text-xl tabular-nums">{score == null ? empty : score}</span>
				{score == null ? null : (
					<span aria-hidden="true" className="bg-border block h-0.5">
						<span className="bg-accent block h-0.5" style={{ width: `${score}%` }} />
					</span>
				)}
				{detail == null ? null : <span className="text-text-muted text-xs">{detail}</span>}
			</dd>
		</div>
	)
}
