'use client'

import { useFormatter, useTranslations } from 'next-intl'
import { CheckIcon, CloseIcon } from '@/components/ui/icons'
import { SkillGlyph } from '@/features/app-shell/skill-glyph'
import { SuggestionBlock } from '@/features/assessment/ui/evidence-item'
import { Link } from '@/i18n/routing'
import type { Finding, ViewTurn } from '../session-view'

const CONTEXT_CHARS = 140

const firstLine = (text: string | null) => {
	if (text == null) return null
	const line = text.trim().split('\n')[0] ?? ''
	return line.length > CONTEXT_CHARS ? `${line.slice(0, CONTEXT_CHARS)}…` : line
}

/**
 * One finding, opened inline under its source: the quote with the conversation
 * around it, what the rubric identified, why it matters and what to do instead.
 * Everything comes from the assessment's own evidence and criterion copy.
 */
export function FindingCard({
	finding,
	index,
	total,
	turns,
	reviewedAt,
	isActive,
	practiceHref,
	onReview,
	onCollapse
}: {
	finding: Finding
	index: number
	total: number
	turns: readonly ViewTurn[]
	reviewedAt: string | null
	isActive: boolean
	practiceHref: string
	onReview: () => void
	onCollapse: () => void
}) {
	const t = useTranslations('Review')
	const tAssessment = useTranslations('Assessment')
	const format = useFormatter()
	const criterion = `criteria.${finding.criterion}`
	const isStrength = finding.polarity === 'strength'
	const position = turns.findIndex((turn) => turn.promptNumber === finding.promptNumber)
	const before = position > 0 ? firstLine(turns[position - 1]?.response ?? null) : null
	const after = firstLine(turns[position + 1]?.prompt ?? null)

	return (
		<article
			id={`card-${finding.id}`}
			aria-labelledby={`card-title-${finding.id}`}
			data-testid="finding-card"
			data-finding={finding.id}
			data-active={isActive}
			className={`bg-surface relative flex flex-col gap-5 border p-5 pl-6 ${isActive ? 'border-accent' : 'border-border-strong'}`}
		>
			<header className="flex flex-wrap items-start justify-between gap-3">
				<div className="flex items-start gap-4">
					<SkillGlyph skill={finding.skill} active={!isStrength} />
					<div className="flex flex-col gap-1">
						<p className="app-eyebrow">
							{t('finding.position', { number: index + 1, total })} ·{' '}
							{t(`severity.${finding.polarity}`)}
						</p>
						<h3 id={`card-title-${finding.id}`} className="text-lg font-normal">
							{tAssessment(`skills.${finding.skill}.name`)}: {tAssessment(`${criterion}.label`)}
						</h3>
					</div>
				</div>
				<button
					type="button"
					onClick={onCollapse}
					className="app-nav-link inline-flex items-center gap-2"
					aria-label={t('finding.collapse')}
				>
					<CloseIcon size={14} />
					<span className="hidden sm:inline">{t('finding.collapse')}</span>
				</button>
			</header>

			<section aria-labelledby={`ev-${finding.id}`} className="flex flex-col gap-2">
				<h4 id={`ev-${finding.id}`} className="app-eyebrow">
					{t('finding.evidence')}
				</h4>
				<p className="text-text-muted text-xs">
					{t('finding.fromPrompt', { number: finding.promptNumber })}
				</p>
				{before == null ? null : (
					<p className="text-text-faint text-xs">
						{t('finding.before')} “{before}”
					</p>
				)}
				<blockquote className="border-accent border-l-2 pl-4 break-words whitespace-pre-wrap">
					{finding.excerpt}
				</blockquote>
				{after == null ? null : (
					<p className="text-text-faint text-xs">
						{t('finding.after')} “{after}”
					</p>
				)}
			</section>

			<section aria-labelledby={`id-${finding.id}`} className="flex flex-col gap-1">
				<h4 id={`id-${finding.id}`} className="app-eyebrow">
					{t('finding.identified')}
				</h4>
				<p className="text-sm">{tAssessment(`${criterion}.${isStrength ? 'shows' : 'missing'}`)}</p>
			</section>

			<section aria-labelledby={`why-${finding.id}`} className="flex flex-col gap-1">
				<h4 id={`why-${finding.id}`} className="app-eyebrow">
					{t('finding.why')}
				</h4>
				<p className="text-text-muted text-sm">{tAssessment(`${criterion}.why`)}</p>
			</section>

			<section aria-labelledby={`do-${finding.id}`} className="flex flex-col gap-3">
				<h4 id={`do-${finding.id}`} className="app-eyebrow">
					{t('finding.coaching')}
				</h4>
				<p className="text-sm">
					{isStrength ? t('finding.keepDoing') : tAssessment(`${criterion}.practice`)}
				</p>
				{finding.suggestion == null ? null : <SuggestionBlock suggestion={finding.suggestion} />}
			</section>

			<footer className="border-border flex flex-wrap items-center gap-x-5 gap-y-3 border-t pt-4">
				{reviewedAt == null ? (
					<button type="button" onClick={onReview} className="app-pill">
						<CheckIcon size={14} />
						{t('finding.markReviewed')}
					</button>
				) : (
					<p className="app-eyebrow text-text inline-flex items-center gap-2" role="status">
						<CheckIcon size={14} />
						{t('finding.reviewed')} ·{' '}
						{format.dateTime(new Date(reviewedAt), { dateStyle: 'medium', timeStyle: 'short' })}
					</p>
				)}
				{isStrength ? null : (
					<Link href={practiceHref} className="app-nav-link">
						{t('finding.practise')}
					</Link>
				)}
			</footer>
		</article>
	)
}
