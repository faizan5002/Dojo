import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getFormatter, getTranslations } from 'next-intl/server'
import { z } from 'zod'
import { ArrowUpRightIcon } from '@/components/ui/icons'
import { aiInsightsAvailable } from '@/features/ai-insights/availability'
import { AiInsightPanel } from '@/features/ai-insights/ui/ai-insight-panel'
import { PageHeader, SectionHeading } from '@/features/app-shell/section'
import { getChallenge, getChallengeVersion } from '@/features/practice/challenge-repository'
import { judgedBy } from '@/features/practice/judge'
import { loadPracticeContext } from '@/features/practice/load-practice'
import type { StoredAttempt } from '@/features/practice/practice-repository'
import type { CatalogEntry, Challenge } from '@/features/practice/types'
import { CopyButton } from '@/features/practice/ui/copy-button'
import { PracticeEditor } from '@/features/practice/ui/practice-editor'
import { Link } from '@/i18n/routing'
import { requireUser } from '@/server/auth/current-user'
import { db } from '@/server/db/client'

const uuid = z.string().uuid()

// How the result describes its scoring, by who judged it.
const METHOD = {
	ai: 'result.methodAi',
	rules: 'result.method',
	rules_fallback: 'result.methodFallback'
} as const

export async function generateMetadata({
	params
}: {
	params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
	const { locale, slug } = await params
	const [t, challenge] = await Promise.all([
		getTranslations({ locale, namespace: 'Guru' }),
		getChallenge({ db, slug })
	])
	return {
		title: {
			absolute:
				challenge == null ? t('meta.title') : t('meta.challengeTitle', { title: challenge.title })
		}
	}
}

// The challenge comes from PostgreSQL. Without ?attempt= this is the exercise.
// With it, it is the result of one of the signed-in user's own attempts at this
// challenge: the attempts come from a per-user query, so another account's
// attempt id is a 404, not a leak. The strong answer shown there is the one of
// the version that attempt was scored against, and is only rendered there. A
// retired challenge keeps its history but takes no new attempts.
export default async function ChallengePage({
	params,
	searchParams
}: {
	params: Promise<{ slug: string }>
	searchParams: Promise<{ attempt?: string }>
}) {
	const user = await requireUser()
	const [{ slug }, query] = await Promise.all([params, searchParams])
	const requested = uuid.safeParse(query.attempt)
	if (query.attempt != null && !requested.success) notFound()

	const [t, tSkills, format, challenge, context, aiAvailable] = await Promise.all([
		getTranslations('Guru'),
		getTranslations('Assessment.skills'),
		getFormatter(),
		getChallenge({ db, slug }),
		loadPracticeContext(user.id),
		aiInsightsAvailable(user)
	])
	if (challenge == null) notFound()
	const history = context.attempts.filter((attempt) => attempt.challengeSlug === challenge.slug)
	if (!challenge.isActive && history.length === 0) notFound()
	const selected = requested.success
		? history.find((attempt) => attempt.id === requested.data)
		: undefined
	if (requested.success && selected == null) notFound()
	const scoredVersion =
		selected?.challengeVersionId == null
			? null
			: selected.challengeVersionId === challenge.versionId
				? challenge
				: await getChallengeVersion({ db, versionId: selected.challengeVersionId })
	const next =
		context.plan.next == null || context.plan.next.slug === challenge.slug
			? null
			: (context.catalog.find((entry) => entry.slug === context.plan.next?.slug) ?? null)
	const date = (value: Date) => format.dateTime(value, { dateStyle: 'medium', timeStyle: 'short' })

	return (
		<main className="flex flex-col gap-16 px-5 py-14 md:px-14 md:py-20">
			<PageHeader
				eyebrow={`${tSkills(`${challenge.skill}.name`)} · ${t(`difficulty.${challenge.difficulty}`)} · ${t(`types.${challenge.type}`)} · ${t('exercise.version', { version: challenge.version })}`}
				title={challenge.title}
				intro={challenge.description}
			/>

			<section aria-labelledby="scenario-heading" className="flex flex-col gap-6">
				<SectionHeading id="scenario-heading" number="02">
					{t('exercise.scenario')}
				</SectionHeading>
				<p className="max-w-3xl leading-relaxed">{challenge.scenario}</p>
				{challenge.given == null ? null : (
					<figure className="border-border flex max-w-3xl flex-col gap-3 border-l-2 pl-5">
						<figcaption className="app-eyebrow">{challenge.given.label}</figcaption>
						<pre className="text-text-muted font-sans text-sm leading-relaxed whitespace-pre-wrap">
							{challenge.given.text}
						</pre>
					</figure>
				)}
			</section>

			<section aria-labelledby="task-heading" className="flex flex-col gap-6">
				<SectionHeading id="task-heading" number="03">
					{t('exercise.instructions')}
				</SectionHeading>
				<p className="max-w-3xl leading-relaxed">{challenge.instructions}</p>
				<p className="text-text-faint text-sm">
					{t('library.minutes', { minutes: challenge.minutes })}
				</p>
			</section>

			{selected != null ? (
				<AttemptResult
					slug={challenge.slug}
					isActive={challenge.isActive}
					currentVersion={challenge.version}
					attempt={selected}
					scoredVersion={scoredVersion}
					next={next}
					aiAvailable={aiAvailable}
					t={t}
				/>
			) : challenge.isActive ? (
				<section aria-labelledby="answer-heading" className="flex max-w-3xl flex-col gap-6">
					<SectionHeading id="answer-heading" number="04">
						{t('exercise.heading')}
					</SectionHeading>
					<PracticeEditor slug={challenge.slug} />
				</section>
			) : (
				<p className="border-border border-y py-6" data-testid="guru-retired">
					{t('exercise.retired')}
				</p>
			)}

			{history.length === 0 ? null : (
				<section aria-labelledby="history-heading" className="flex flex-col gap-6">
					<SectionHeading id="history-heading" number="05">
						{t('result.history')}
					</SectionHeading>
					<ol className="border-border flex flex-col border-t" data-testid="guru-history">
						{history.map((attempt, index) => (
							<li
								key={attempt.id}
								className="border-border flex flex-wrap items-center justify-between gap-3 border-b py-4"
							>
								<p className="tabular-nums">
									{t('result.attemptLine', {
										number: history.length - index,
										score: attempt.score,
										date: date(attempt.createdAt)
									})}
									{index === 0 ? <span className="app-chip ml-3">{t('result.latest')}</span> : null}
								</p>
								{attempt.id === selected?.id ? (
									<span className="app-eyebrow">{t('result.viewing')}</span>
								) : (
									<Link
										href={`/prompting-guru/challenges/${challenge.slug}?attempt=${attempt.id}`}
										className="app-nav-link"
									>
										{t('recent.open')}
									</Link>
								)}
							</li>
						))}
					</ol>
				</section>
			)}
		</main>
	)
}

function AttemptResult({
	slug,
	isActive,
	currentVersion,
	attempt,
	scoredVersion,
	next,
	aiAvailable,
	t
}: {
	slug: string
	isActive: boolean
	currentVersion: number
	attempt: StoredAttempt
	/** The version this attempt was scored against: its strong answer is shown. */
	scoredVersion: Challenge | null
	next: CatalogEntry | null
	/** Whether to offer AI feedback and an AI example beside the rule-based result. */
	aiAvailable: boolean
	t: Awaited<ReturnType<typeof getTranslations<'Guru'>>>
}) {
	const { evaluation } = attempt
	return (
		<section
			aria-labelledby="result-heading"
			className="flex flex-col gap-12"
			data-testid="guru-result"
		>
			<SectionHeading id="result-heading" number="04">
				{t('result.heading')}
			</SectionHeading>

			<div className="flex flex-col gap-3">
				<p className="app-eyebrow">{t('result.scoreLabel')}</p>
				<p className="flex flex-wrap items-baseline gap-4">
					<span className="app-number" data-testid="guru-score">
						{attempt.score}
					</span>
					<span className="text-text-muted">{t('result.outOf')}</span>
					<span className="app-chip">{t(`band.${evaluation.band}`)}</span>
				</p>
				<p className="text-text-muted max-w-2xl text-sm">{t('result.notWorkflow')}</p>
				{attempt.challengeVersion === currentVersion ? null : (
					<p className="text-text-muted max-w-2xl text-sm" data-testid="guru-older-version">
						{t('result.olderVersion', { version: attempt.challengeVersion })}
					</p>
				)}
				{evaluation.caps.length === 0 ? null : (
					<div className="flex flex-col gap-1">
						<p className="app-eyebrow">{t('result.caps')}</p>
						<ul className="text-sm">
							{evaluation.caps.map((cap) => (
								<li key={cap}>{cap}</li>
							))}
						</ul>
					</div>
				)}
			</div>

			<div className="grid gap-8 lg:grid-cols-2">
				<div className="flex flex-col gap-3">
					<h3 className="app-eyebrow">{t('result.yourAnswer')}</h3>
					<pre className="border-border border p-5 font-sans text-sm leading-relaxed whitespace-pre-wrap">
						{attempt.prompt}
					</pre>
				</div>
				<div className="flex flex-col gap-3">
					<h3 className="app-eyebrow">{t('result.suggestion')}</h3>
					<pre
						className="border-border border p-5 font-sans text-sm leading-relaxed whitespace-pre-wrap"
						data-testid="guru-suggestion"
					>
						{evaluation.suggestion}
					</pre>
					<p className="text-text-muted text-xs">{t('result.suggestionNote')}</p>
					<CopyButton text={evaluation.suggestion} />
				</div>
			</div>

			<div className="flex flex-col gap-4">
				<h3 className="app-eyebrow">{t('result.criteria')}</h3>
				<ul className="border-border flex flex-col border-t">
					{evaluation.criteria.map((criterion) => (
						<li
							key={criterion.id}
							className="border-border grid gap-2 border-b py-4 sm:grid-cols-[1fr_auto]"
							data-status={criterion.status}
						>
							<div className="flex flex-col gap-1">
								<p>
									{criterion.label}
									<span
										className={
											criterion.status === 'missing'
												? 'app-chip app-chip-risk ml-3'
												: 'app-chip ml-3'
										}
									>
										{t(`result.status.${criterion.status}`)}
									</span>
								</p>
								{criterion.evidence == null ? null : (
									<p className="text-text-muted text-sm">
										{t('result.evidence')}: “{criterion.evidence}”
									</p>
								)}
								{criterion.status === 'met' ? null : (
									<p className="text-text-muted text-sm">{criterion.note}</p>
								)}
							</div>
							<p className="text-text-muted text-sm tabular-nums sm:text-right">
								{t('result.points', { points: criterion.points, weight: criterion.weight })}
							</p>
						</li>
					))}
				</ul>
			</div>

			{evaluation.pitfalls.length === 0 ? null : (
				<div className="flex flex-col gap-4">
					<h3 className="app-eyebrow">{t('result.pitfalls')}</h3>
					<ul className="border-border flex flex-col border-t">
						{evaluation.pitfalls.map((pitfall) => (
							<li
								key={pitfall.id}
								className="border-border flex justify-between gap-4 border-b py-3 text-sm"
							>
								<span>
									{pitfall.label}: “{pitfall.evidence}”
								</span>
								<span className="tabular-nums">
									{t('result.pitfallPoints', { penalty: pitfall.penalty })}
								</span>
							</li>
						))}
					</ul>
				</div>
			)}

			<div className="grid gap-8 sm:grid-cols-2">
				<div className="flex flex-col gap-3">
					<h3 className="app-eyebrow">{t('result.strengths')}</h3>
					{evaluation.strengths.length === 0 ? (
						<p className="text-text-muted text-sm">{t('result.noneStrengths')}</p>
					) : (
						<ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
							{evaluation.strengths.map((item) => (
								<li key={item}>{item}</li>
							))}
						</ul>
					)}
				</div>
				<div className="flex flex-col gap-3">
					<h3 className="app-eyebrow">{t('result.missing')}</h3>
					{evaluation.missing.length === 0 ? (
						<p className="text-text-muted text-sm">{t('result.noneMissing')}</p>
					) : (
						<ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
							{evaluation.missing.map((item) => (
								<li key={item}>{item}</li>
							))}
						</ul>
					)}
				</div>
			</div>

			{scoredVersion == null ? null : (
				<div className="flex max-w-3xl flex-col gap-3" data-testid="guru-exemplar">
					<h3 className="app-eyebrow">{t('result.example')}</h3>
					<p className="text-text-muted text-xs">{t('result.exampleNote')}</p>
					<pre className="border-border border-l-2 pl-5 font-sans text-sm leading-relaxed whitespace-pre-wrap">
						{scoredVersion.exemplar}
					</pre>
					<h4 className="app-eyebrow mt-3">{t('result.why')}</h4>
					<p className="text-sm leading-relaxed">{scoredVersion.explanation}</p>
				</div>
			)}

			{aiAvailable ? (
				<div className="flex flex-col gap-6">
					<AiInsightPanel
						feature="attempt_feedback"
						path={`/api/prompting-guru/attempts/${attempt.id}/ai-feedback`}
					/>
					{isActive ? (
						<AiInsightPanel
							feature="challenge_example"
							path={`/api/prompting-guru/challenges/${slug}/ai-example`}
						/>
					) : null}
				</div>
			) : null}

			<p className="text-text-faint max-w-3xl text-xs">
				{t(METHOD[judgedBy(attempt.evaluator)], { version: attempt.evaluator })}
			</p>

			<div className="flex flex-wrap items-center gap-4">
				{isActive ? (
					<Link href={`/prompting-guru/challenges/${slug}`} className="app-pill">
						{t('exercise.retry')}
					</Link>
				) : null}
				{next == null ? null : (
					<Link href={`/prompting-guru/challenges/${next.slug}`} className="app-pill">
						{t('result.next')}
						<ArrowUpRightIcon size={14} />
					</Link>
				)}
				<Link href="/prompting-guru" className="app-nav-link">
					{t('result.overview')}
				</Link>
			</div>
		</section>
	)
}
