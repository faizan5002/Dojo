'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { SuggestionBlock } from '@/features/assessment/ui/evidence-item'
import type { CriterionId, SkillId } from '@/features/assessment/rubric'
import type { Suggestion } from '@/features/assessment/types'
import { Link } from '@/i18n/routing'
import { scoreRewrite, type DrillResult } from '../score-rewrite'

export interface RewriteDrillProps {
	skill: SkillId
	criterion: CriterionId
	quote: { excerpt: string; clippedBefore: boolean; clippedAfter: boolean }
	suggestion: Suggestion | null
	assessment: { id: string; score: number; observations: number }
}

const CONTEXT_NOTES = new Set<SkillId>(['verification', 'iteration'])

/**
 * One rewrite drill. The check runs in this tab with the assessment's own
 * rules; nothing is sent or saved, and the result says so.
 */
export function RewriteDrill({
	skill,
	criterion,
	quote,
	suggestion,
	assessment
}: RewriteDrillProps) {
	const t = useTranslations('Practice')
	const tAssessment = useTranslations('Assessment')
	const [text, setText] = useState('')
	const [result, setResult] = useState<DrillResult | null>(null)
	const criterionKey = `criteria.${criterion}`

	return (
		<div className="flex flex-col gap-10">
			<section aria-labelledby="habit-heading" className="flex flex-col gap-5">
				<h2 id="habit-heading" className="app-eyebrow">
					{t('habit')}
				</h2>
				<p className="text-lg">{tAssessment(`${criterionKey}.missing`)}</p>
				<p className="text-text-muted text-sm">{tAssessment(`${criterionKey}.practice`)}</p>
				<figure className="flex flex-col gap-2">
					<figcaption className="app-eyebrow">{tAssessment('evidence.yourPrompt')}</figcaption>
					<blockquote className="border-accent border-l-2 pl-5 leading-relaxed break-words whitespace-pre-wrap">
						{quote.clippedBefore ? '… ' : ''}
						{quote.excerpt}
						{quote.clippedAfter ? ' …' : ''}
					</blockquote>
				</figure>
				{suggestion == null ? null : <SuggestionBlock suggestion={suggestion} />}
			</section>

			<section aria-labelledby="rewrite-heading" className="flex flex-col gap-4">
				<h2 id="rewrite-heading" className="app-eyebrow">
					{t('form.label')}
				</h2>
				<form
					className="flex flex-col gap-4"
					onSubmit={(event) => {
						event.preventDefault()
						setResult(scoreRewrite({ text, skill, criterion }))
					}}
				>
					<label htmlFor="rewrite" className="sr-only">
						{t('form.label')}
					</label>
					<textarea
						id="rewrite"
						name="rewrite"
						value={text}
						rows={6}
						placeholder={t('form.placeholder')}
						onChange={(event) => {
							setText(event.target.value)
							setResult(null)
						}}
						className="border-border-strong bg-surface min-h-36 w-full border p-4 leading-relaxed"
					/>
					<p className="text-text-muted text-xs">
						{t(`context.${CONTEXT_NOTES.has(skill) ? skill : 'default'}`)}
					</p>
					<div className="flex flex-wrap items-center gap-4">
						<button type="submit" className="app-pill" disabled={text.trim() === ''}>
							{t('form.check')}
						</button>
						<button
							type="button"
							className="app-nav-link"
							onClick={() => {
								setText('')
								setResult(null)
							}}
						>
							{t('form.reset')}
						</button>
					</div>
				</form>
			</section>

			{result == null ? null : (
				<section
					aria-labelledby="result-heading"
					aria-live="polite"
					className="border-border-strong flex flex-col gap-6 border p-6"
					data-testid="drill-result"
					data-verdict={result.verdict}
				>
					<h2 id="result-heading" className="app-eyebrow">
						{t('result.heading')}
					</h2>
					<p className="text-lg">{t(`result.verdict.${result.verdict}`)}</p>

					{result.verdict === 'notEvaluable' ? (
						<p className="text-text-muted text-sm">{t(`result.notEvaluable.${skill}`)}</p>
					) : (
						<>
							{result.weakness == null ? null : (
								<div className="flex flex-col gap-1">
									<p className="app-eyebrow">{t('result.stillFlagged')}</p>
									<p className="text-sm">
										{tAssessment(`criteria.${result.weakness.criterion}.missing`)}
									</p>
									<blockquote className="border-accent border-l-2 pl-4 text-sm whitespace-pre-wrap">
										{result.weakness.quote}
									</blockquote>
								</div>
							)}
							<div className="flex flex-col gap-2">
								<p className="app-eyebrow">{t('result.found')}</p>
								{result.strengths.length === 0 ? (
									<p className="text-text-muted text-sm">{t('result.foundNone')}</p>
								) : (
									<ul className="flex flex-col gap-3 text-sm">
										{result.strengths.map((strength) => (
											<li
												key={`${strength.criterion}:${strength.quote}`}
												className="flex flex-col gap-1"
											>
												<span>{tAssessment(`criteria.${strength.criterion}.shows`)}</span>
												<span className="text-text-muted whitespace-pre-wrap">
													“{strength.quote}”
												</span>
											</li>
										))}
									</ul>
								)}
							</div>
							<dl className="border-border grid gap-6 border-t pt-5 sm:grid-cols-2">
								<div className="flex flex-col gap-1">
									<dt className="app-eyebrow">{t('compare.before')}</dt>
									<dd className="app-number" data-testid="drill-before">
										{assessment.score}
									</dd>
									<dd className="text-text-muted text-xs">
										{t('compare.beforeDetail', {
											count: assessment.observations,
											unit: tAssessment(`skills.${skill}.unit`, { count: assessment.observations })
										})}
									</dd>
								</div>
								<div className="flex flex-col gap-1">
									<dt className="app-eyebrow">{t('compare.after')}</dt>
									<dd className="app-number" data-testid="drill-after">
										{result.value}
									</dd>
									<dd className="text-text-muted text-xs">{t('compare.afterDetail')}</dd>
								</div>
								<p className="text-text-faint text-xs sm:col-span-2">{t('compare.note')}</p>
							</dl>
						</>
					)}
					<p className="text-text-muted text-sm">{t('next.saved')}</p>
					<div className="flex flex-wrap items-center gap-x-6 gap-y-2">
						<Link href="/sessions" className="app-pill">
							{t('next.upload')}
						</Link>
						<Link href={`/assessment?id=${assessment.id}#skill-${skill}`} className="app-nav-link">
							{t('next.evidence')}
						</Link>
					</div>
				</section>
			)}
		</div>
	)
}
