import { useFormatter, useTranslations } from 'next-intl'
import { ArrowUpRightIcon } from '@/components/ui/icons'
import { SkillGlyph } from '@/features/app-shell/skill-glyph'
import { Link } from '@/i18n/routing'
import type { Focus } from '../dashboard-model'

const FRAME = 'app-panel app-panel-accent p-6 md:p-10'

/**
 * The coaching block, first on the page: the one skill to work on, why (a line from
 * the user's own prompt, quoted exactly), and the one thing to practise. Everything
 * shown is the assessment's own recommendation and evidence; when either is missing
 * it says so and shows nothing in its place.
 */
/** Where each link goes; the defaults are the signed-in workspace's own routes. */
export interface FocusLinks {
	readonly overview: string
	readonly evidence: string
	readonly practise: string
	/** The quote in its original conversation; the default is the signed-in viewer. */
	readonly conversation?: string
	/** The scenario practice session; the default is the signed-in one. */
	readonly scenarios?: string
}

export function FocusNext({
	focus,
	assessmentId,
	links
}: {
	focus: Focus
	assessmentId: string
	links?: FocusLinks
}) {
	const t = useTranslations('Dashboard.focus')
	const tAssessment = useTranslations('Assessment')
	const tLevel = useTranslations('Assessment.proficiency')
	const format = useFormatter()

	if (focus.kind !== 'ready') {
		const missing = focus.kind === 'missingQuote'
		const skillName = missing ? tAssessment(`skills.${focus.skill}.name`) : ''
		return (
			<section
				aria-labelledby="focus-heading"
				className={`${FRAME} flex flex-col items-start gap-4`}
			>
				<h2 id="focus-heading" className="app-eyebrow">
					{t('heading')}
				</h2>
				<h3 className="text-xl font-normal">
					{missing ? t('missingQuote.title', { skill: skillName }) : t('none.title')}
				</h3>
				<p className="text-text-muted max-w-2xl">
					{missing
						? t('missingQuote.body', { skill: skillName, score: focus.score })
						: t('none.body')}
				</p>
				<div className="flex flex-wrap items-center gap-x-6 gap-y-2">
					<Link href={links?.overview ?? `/assessment?id=${assessmentId}`} className="app-pill">
						{missing ? t('missingQuote.action') : t('none.action')}
						<ArrowUpRightIcon size={14} />
					</Link>
					{missing ? null : (
						<Link href="/sessions" className="app-nav-link">
							{t('none.secondary')}
						</Link>
					)}
				</div>
			</section>
		)
	}

	const { quote } = focus
	const criterion = `criteria.${focus.criterion}`
	const unit = tAssessment(`skills.${focus.skill}.unit`, { count: focus.observations })
	const when = quote.startedAt == null ? Number.NaN : Date.parse(quote.startedAt)
	const place = [
		quote.project,
		Number.isNaN(when) ? null : format.dateTime(when, { dateStyle: 'medium' })
	]
		.filter((part): part is string => part != null && part !== '')
		.join(' · ')
	return (
		<section
			aria-labelledby="focus-heading"
			className={`${FRAME} grid gap-x-12 gap-y-7 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]`}
		>
			<div className="flex flex-col gap-4 lg:col-start-1 lg:row-start-1">
				<h2 id="focus-heading" className="app-eyebrow">
					{t('heading')}
				</h2>
				<div className="flex items-center gap-4">
					<SkillGlyph skill={focus.skill} size={22} active />
					<h3 className="app-heading">{tAssessment(`skills.${focus.skill}.name`)}</h3>
				</div>
				<div className="flex items-center gap-5">
					<div
						className="app-ring app-ring-md"
						style={{ '--v': focus.score } as React.CSSProperties}
					>
						<span className="app-number" data-testid="focus-score">
							{focus.score}
						</span>
					</div>
					{focus.proficiency == null ? null : (
						<span className="app-chip app-chip-risk">{tLevel(focus.proficiency)}</span>
					)}
				</div>
				<p className="text-text-muted text-sm">
					{tAssessment(`confidence.${focus.confidence}.label`)}.{' '}
					{tAssessment(`confidence.${focus.confidence}.detail`, {
						count: focus.observations,
						unit
					})}
				</p>
			</div>

			<div className="flex flex-col gap-6 lg:col-start-2 lg:row-span-2 lg:row-start-1">
				<figure className="flex flex-col gap-3">
					<figcaption className="flex flex-col gap-1">
						<span className="app-eyebrow">{t('quoteLabel')}</span>
						<span className="text-text-muted text-xs">
							{t('where', { number: quote.promptNumber })}{' '}
							<span className="font-mono break-all">{quote.sessionId}</span>
							{place === '' ? null : ` · ${place}`}
						</span>
					</figcaption>
					<blockquote className="border-accent border-l-2 pl-5 text-lg leading-relaxed break-words whitespace-pre-wrap">
						{quote.clippedBefore ? '… ' : ''}
						{quote.excerpt}
						{quote.clippedAfter ? ' …' : ''}
					</blockquote>
				</figure>
				<dl className="flex flex-col gap-4 text-sm">
					<div className="flex flex-col gap-1">
						<dt className="app-eyebrow">{tAssessment('recommendations.problem')}</dt>
						<dd>
							{tAssessment(`${criterion}.missing`)}{' '}
							<span className="text-text-muted">
								{tAssessment('recommendations.observed', {
									count: focus.seen,
									total: focus.of,
									unit: tAssessment(`skills.${focus.skill}.unit`, { count: focus.of })
								})}
							</span>
						</dd>
					</div>
					<div className="flex flex-col gap-1">
						<dt className="app-eyebrow">{tAssessment('recommendations.practice')}</dt>
						<dd>{tAssessment(`${criterion}.practice`)}</dd>
					</div>
				</dl>
			</div>

			<div className="border-border flex flex-wrap items-center gap-3 border-t pt-6 lg:col-span-2 lg:row-start-3">
				<Link
					href={links?.evidence ?? `/assessment?id=${assessmentId}#skill-${focus.skill}`}
					className="app-pill"
				>
					{t('action')}
					<ArrowUpRightIcon size={14} />
				</Link>
				<Link
					href={
						links?.conversation ??
						`/assessment/session?id=${assessmentId}&session=${encodeURIComponent(quote.sessionId)}&finding=${encodeURIComponent(quote.evidenceId)}`
					}
					className="app-pill app-pill-sm"
					data-testid="focus-conversation"
				>
					{t('conversation')}
				</Link>
				<Link
					href={links?.scenarios ?? `/practice/session?assessment=${assessmentId}`}
					className="app-pill app-pill-sm"
					data-testid="focus-scenarios"
				>
					{t('scenarios')}
				</Link>
				<Link href="/prompting-guru" className="app-pill app-pill-sm" data-testid="focus-guru">
					Prompting Guru
				</Link>
				<Link
					href={links?.practise ?? `/practice?assessment=${assessmentId}`}
					className="app-pill app-pill-sm"
				>
					{t('practise')}
				</Link>
			</div>
		</section>
	)
}
