import { useTranslations } from 'next-intl'
import type { Evidence, Polarity, ProfilePattern } from '../types'
import { EvidenceQuote } from './evidence-item'

function PatternList({
	kind,
	patterns,
	evidenceById
}: {
	kind: Polarity
	patterns: readonly ProfilePattern[]
	evidenceById: ReadonlyMap<string, Evidence>
}) {
	const t = useTranslations('Assessment.profile')
	const shown = patterns.filter((pattern) => pattern.kind === kind)
	return (
		<div className="flex flex-col gap-4">
			<h3 className="app-eyebrow">{kind === 'strength' ? t('strengths') : t('risks')}</h3>
			{shown.length === 0 ? (
				<p className="text-text-faint text-sm">{t('none')}</p>
			) : (
				<ul className="border-border flex flex-col border-t">
					{shown.map((pattern) => {
						const evidence = evidenceById.get(pattern.evidenceIds[0] ?? '')
						return (
							<li key={pattern.id} className="border-border flex flex-col gap-3 border-b py-5">
								<p className="text-lg">{t(`patterns.${pattern.id}.name`)}</p>
								<p className="text-text-muted text-sm">
									{t(`patterns.${pattern.id}.detail`, {
										count: pattern.count,
										total: pattern.total
									})}
								</p>
								{evidence == null ? null : <EvidenceQuote evidence={evidence} />}
							</li>
						)
					})}
				</ul>
			)}
		</div>
	)
}

export function WorkflowProfile({
	patterns,
	evidenceById
}: {
	patterns: readonly ProfilePattern[]
	evidenceById: ReadonlyMap<string, Evidence>
}) {
	return (
		<div className="grid gap-10 lg:grid-cols-2">
			<PatternList kind="strength" patterns={patterns} evidenceById={evidenceById} />
			<PatternList kind="opportunity" patterns={patterns} evidenceById={evidenceById} />
		</div>
	)
}
