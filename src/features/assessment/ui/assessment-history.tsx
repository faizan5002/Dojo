import { useFormatter, useTranslations } from 'next-intl'
import type { AssessmentSummary } from '@/features/workspace/repository'
import { Link } from '@/i18n/routing'

/** Every saved run, newest first. Each keeps the score and rubric it was made with. */
export function AssessmentHistory({
	assessments,
	selectedId
}: {
	assessments: readonly AssessmentSummary[]
	selectedId: string | null
}) {
	const t = useTranslations('Assessment.history')
	const format = useFormatter()
	return (
		<ol className="border-border flex flex-col border-t">
			{assessments.map((assessment) => (
				<li
					key={assessment.id}
					className="border-border flex flex-wrap items-center justify-between gap-4 border-b py-4"
				>
					<div className="flex flex-col gap-1">
						<p>
							{format.dateTime(assessment.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}
							{assessment.id === selectedId ? (
								<span className="app-eyebrow text-text ml-3">{t('viewing')}</span>
							) : null}
						</p>
						<p className="text-text-muted text-sm">
							{assessment.overallScore == null
								? t('noScore', { version: assessment.rubricVersion })
								: t('score', { score: assessment.overallScore, version: assessment.rubricVersion })}
						</p>
					</div>
					{assessment.id === selectedId ? null : (
						<Link href={`/assessment?id=${assessment.id}`} className="app-nav-link">
							{t('open')}
						</Link>
					)}
				</li>
			))}
		</ol>
	)
}
