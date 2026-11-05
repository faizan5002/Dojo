'use client'

import { useTranslations } from 'next-intl'
import { CopyButton } from '@/features/practice/ui/copy-button'
import { INSIGHT_SCHEMAS, joinParagraphs, type InsightFeature } from '../schemas'

// How each AI insight reads on the page: headings and lists in Dojo's own
// style, never raw JSON. The content is checked against its schema here too,
// so a stored answer that somehow no longer fits is reported, not rendered.
// Everything is rendered as text, so nothing a model wrote can become markup.

function List({ heading, items }: { heading: string; items: readonly string[] }) {
	if (items.length === 0) return null
	return (
		<div className="flex flex-col gap-2">
			<h4 className="app-eyebrow">{heading}</h4>
			<ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
				{items.map((item) => (
					<li key={item}>{item}</li>
				))}
			</ul>
		</div>
	)
}

function Block({ heading, text, copy }: { heading: string; text: string; copy?: boolean }) {
	return (
		<div className="flex flex-col gap-2">
			<h4 className="app-eyebrow">{heading}</h4>
			<pre className="border-border border-l-2 pl-5 font-sans text-sm leading-relaxed whitespace-pre-wrap">
				{text}
			</pre>
			{copy ? <CopyButton text={text} /> : null}
		</div>
	)
}

export function InsightContent({
	feature,
	content
}: {
	feature: InsightFeature
	content: unknown
}) {
	const t = useTranslations('AiInsight')
	const tSkills = useTranslations('Assessment.skills')
	const skill = (id: string) => tSkills(`${id}.name`)

	if (feature === 'session_analysis') {
		const parsed = INSIGHT_SCHEMAS.session_analysis.safeParse(content)
		if (!parsed.success) return <p className="text-sm">{t('unreadable')}</p>
		const data = parsed.data
		return (
			<div className="flex flex-col gap-6">
				<p className="max-w-3xl leading-relaxed">{data.summary}</p>
				{data.observations.length === 0 ? null : (
					<ul className="border-border flex flex-col border-t">
						{data.observations.map((item) => (
							<li
								key={`${item.skill}-${item.observation}`}
								className="border-border flex flex-col gap-2 border-b py-4"
							>
								<p className="app-eyebrow">
									{skill(item.skill)} · {t(`basis.${item.basis}`)} ·{' '}
									{t(`confidence.${item.confidence}`)}
								</p>
								<p>{item.observation}</p>
								{item.evidence.map((quote) => (
									<p key={quote} className="text-text-muted text-sm">
										{t('quote')}: “{quote}”
									</p>
								))}
								<p className="text-sm">
									<span className="text-text-muted">{t('recommendation')}: </span>
									{item.recommendation}
								</p>
							</li>
						))}
					</ul>
				)}
				<div className="grid gap-6 sm:grid-cols-2">
					<List heading={t('strengths')} items={data.strengths} />
					<List heading={t('improvementAreas')} items={data.improvementAreas} />
				</div>
				<List heading={t('recommendedActions')} items={data.recommendedActions} />
			</div>
		)
	}

	if (feature === 'assessment_explanation') {
		const parsed = INSIGHT_SCHEMAS.assessment_explanation.safeParse(content)
		if (!parsed.success) return <p className="text-sm">{t('unreadable')}</p>
		const data = parsed.data
		return (
			<div className="flex flex-col gap-6">
				<p className="max-w-3xl leading-relaxed">{data.summary}</p>
				<div className="grid gap-6 lg:grid-cols-2">
					{data.strongAreas.length === 0 ? null : (
						<div className="flex flex-col gap-3">
							<h4 className="app-eyebrow">{t('strongAreas')}</h4>
							{data.strongAreas.map((item) => (
								<div key={item.skill} className="flex flex-col gap-1 text-sm">
									<p className="text-text">{skill(item.skill)}</p>
									<p className="text-text-muted">{item.explanation}</p>
								</div>
							))}
						</div>
					)}
					{data.weakAreas.length === 0 ? null : (
						<div className="flex flex-col gap-3">
							<h4 className="app-eyebrow">{t('weakAreas')}</h4>
							{data.weakAreas.map((item) => (
								<div key={item.skill} className="flex flex-col gap-1 text-sm">
									<p className="text-text">{skill(item.skill)}</p>
									<p className="text-text-muted">{item.explanation}</p>
									<p>
										<span className="text-text-muted">{t('whyItMatters')}: </span>
										{item.whyItMatters}
									</p>
									<p>
										<span className="text-text-muted">{t('recommendation')}: </span>
										{item.recommendation}
									</p>
								</div>
							))}
						</div>
					)}
				</div>
				<List heading={t('nextSteps')} items={data.nextSteps} />
			</div>
		)
	}

	if (feature === 'attempt_feedback') {
		const parsed = INSIGHT_SCHEMAS.attempt_feedback.safeParse(content)
		if (!parsed.success) return <p className="text-sm">{t('unreadable')}</p>
		const data = parsed.data
		return (
			<div className="flex flex-col gap-6">
				<p className="max-w-3xl leading-relaxed">{data.summary}</p>
				<div className="grid gap-6 sm:grid-cols-2">
					<List heading={t('strengths')} items={data.strengths} />
					<List heading={t('weaknesses')} items={data.weaknesses} />
					<List heading={t('missingRequirements')} items={data.missingRequirements} />
					<List heading={t('suggestedImprovements')} items={data.suggestedImprovements} />
				</div>
				<Block heading={t('rewrittenPrompt')} text={joinParagraphs(data.rewrite.prompt)} copy />
				<p className="text-text-muted -mt-3 text-xs">{t('rewriteNote')}</p>
				<div className="grid gap-6 sm:grid-cols-2">
					<List heading={t('requirements')} items={data.rewrite.requirements} />
					<List heading={t('constraints')} items={data.rewrite.constraints} />
					<List heading={t('acceptanceCriteria')} items={data.rewrite.acceptanceCriteria} />
					<List heading={t('verification')} items={data.rewrite.verification} />
				</div>
				<div className="flex flex-col gap-2">
					<h4 className="app-eyebrow">{t('expectedOutput')}</h4>
					<p className="text-sm">{data.rewrite.expectedOutput}</p>
				</div>
				<Block heading={t('improvedExample')} text={joinParagraphs(data.improvedExample)} />
			</div>
		)
	}

	if (feature === 'challenge_example') {
		const parsed = INSIGHT_SCHEMAS.challenge_example.safeParse(content)
		if (!parsed.success) return <p className="text-sm">{t('unreadable')}</p>
		return (
			<div className="flex flex-col gap-6">
				<Block heading={t('exampleAnswer')} text={joinParagraphs(parsed.data.exampleAnswer)} copy />
				<List heading={t('whyItWorks')} items={parsed.data.whyItWorks} />
			</div>
		)
	}

	const parsed = INSIGHT_SCHEMAS.recommendation_explanation.safeParse(content)
	if (!parsed.success) return <p className="text-sm">{t('unreadable')}</p>
	return (
		<div className="flex flex-col gap-4">
			<p className="leading-relaxed">{parsed.data.headline}</p>
			<List heading={t('reasons')} items={parsed.data.reasons} />
			<p className="text-sm">
				<span className="text-text-muted">{t('focusTip')}: </span>
				{parsed.data.focusTip}
			</p>
		</div>
	)
}
