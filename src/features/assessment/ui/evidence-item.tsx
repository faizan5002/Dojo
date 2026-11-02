import { useTranslations } from 'next-intl'
import type { Evidence, Suggestion } from '../types'

const SHORT_SESSION_ID = 8

/** The user's own line, quoted exactly, with what the rubric read in it. */
export function EvidenceQuote({ evidence }: { evidence: Evidence }) {
	const t = useTranslations('Assessment.evidence')
	return (
		<figure className="flex flex-col gap-2">
			<figcaption className="app-eyebrow">
				{t('yourPrompt')} ·{' '}
				{t('location', {
					session: evidence.sessionId.slice(0, SHORT_SESSION_ID),
					number: evidence.promptNumber
				})}
			</figcaption>
			<blockquote className="border-accent border-l-2 pl-4 leading-relaxed break-words whitespace-pre-wrap">
				{evidence.clippedBefore ? '… ' : ''}
				{evidence.excerpt}
				{evidence.clippedAfter ? ' …' : ''}
			</blockquote>
		</figure>
	)
}

/** A template around the user's opening sentence, labelled as such. */
export function SuggestionBlock({ suggestion }: { suggestion: Suggestion }) {
	const t = useTranslations('Assessment')
	return (
		<div className="border-border flex flex-col gap-3 border p-4">
			<p className="app-eyebrow">{t('evidence.suggestion')}</p>
			<div className="flex flex-col gap-1 text-sm break-words">
				<p>{suggestion.base}</p>
				{suggestion.additions.map((line) => (
					<p key={line} className="text-text-muted">
						{t(`rewrite.${line}`)}
					</p>
				))}
			</div>
			<p className="text-text-faint text-xs">{t('evidence.suggestionNote')}</p>
		</div>
	)
}

export function EvidenceItem({ evidence }: { evidence: Evidence }) {
	const t = useTranslations('Assessment')
	const criterion = `criteria.${evidence.criterion}`
	const isStrength = evidence.polarity === 'strength'
	return (
		<article className="border-border flex flex-col gap-4 border-b py-5 last:border-b-0">
			<EvidenceQuote evidence={evidence} />
			<dl className="grid gap-4 text-sm sm:grid-cols-2">
				<div className="flex flex-col gap-1">
					<dt className="app-eyebrow">{t('evidence.shows')}</dt>
					<dd>{t(`${criterion}.${isStrength ? 'shows' : 'missing'}`)}</dd>
				</div>
				<div className="flex flex-col gap-1">
					<dt className="app-eyebrow">{t('evidence.why')}</dt>
					<dd className="text-text-muted">{t(`${criterion}.why`)}</dd>
				</div>
				{isStrength ? null : (
					<div className="flex flex-col gap-1 sm:col-span-2">
						<dt className="app-eyebrow">{t('evidence.better')}</dt>
						<dd>{t(`${criterion}.practice`)}</dd>
					</div>
				)}
			</dl>
			{evidence.suggestion == null ? null : <SuggestionBlock suggestion={evidence.suggestion} />}
		</article>
	)
}
