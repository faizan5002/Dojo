import { useTranslations } from 'next-intl'
import type { Evidence, Recommendation } from '../types'
import { EvidenceQuote, SuggestionBlock } from './evidence-item'

export function RecommendationList({
	recommendations,
	evidenceById
}: {
	recommendations: readonly Recommendation[]
	evidenceById: ReadonlyMap<string, Evidence>
}) {
	const t = useTranslations('Assessment')
	if (recommendations.length === 0) {
		return <p className="text-text-muted text-sm">{t('recommendations.none')}</p>
	}
	return (
		<ol className="border-border flex flex-col border-t">
			{recommendations.map((recommendation) => {
				const evidence = evidenceById.get(recommendation.evidenceId)
				const criterion = `criteria.${recommendation.criterion}`
				return (
					<li
						key={`${recommendation.skill}:${recommendation.criterion}`}
						className="border-border flex flex-col gap-5 border-b py-7"
					>
						<div className="flex flex-col gap-2">
							<p className="app-eyebrow">{t(`skills.${recommendation.skill}.name`)}</p>
							<h3 className="text-xl font-normal">{t(`${criterion}.label`)}</h3>
							<p className="text-text-muted text-sm">
								{t('recommendations.observed', {
									count: recommendation.count,
									total: recommendation.total,
									unit: t(`skills.${recommendation.skill}.unit`, { count: recommendation.total })
								})}
							</p>
						</div>
						<dl className="grid gap-5 text-sm lg:grid-cols-2">
							<div className="flex flex-col gap-1">
								<dt className="app-eyebrow">{t('recommendations.problem')}</dt>
								<dd>{t(`${criterion}.missing`)}</dd>
							</div>
							<div className="flex flex-col gap-1">
								<dt className="app-eyebrow">{t('recommendations.matters')}</dt>
								<dd className="text-text-muted">{t(`${criterion}.why`)}</dd>
							</div>
							<div className="flex flex-col gap-1 lg:col-span-2">
								<dt className="app-eyebrow">{t('recommendations.practice')}</dt>
								<dd>{t(`${criterion}.practice`)}</dd>
							</div>
						</dl>
						{evidence == null ? null : (
							<div className="grid gap-5 lg:grid-cols-2">
								<div className="flex flex-col gap-2">
									<p className="app-eyebrow">{t('recommendations.evidence')}</p>
									<EvidenceQuote evidence={evidence} />
								</div>
								{evidence.suggestion == null ? null : (
									<div className="flex flex-col gap-2">
										<p className="app-eyebrow">{t('recommendations.example')}</p>
										<SuggestionBlock suggestion={evidence.suggestion} />
									</div>
								)}
							</div>
						)}
					</li>
				)
			})}
		</ol>
	)
}
