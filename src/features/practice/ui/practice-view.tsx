import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/features/app-shell/section'
import { focusOf } from '@/features/dashboard/dashboard-model'
import type { StoredAssessment } from '@/features/workspace/repository'
import { Link } from '@/i18n/routing'
import { RewriteDrill } from './rewrite-drill'

/**
 * The drill page for one assessment: the first recommendation's skill, criterion
 * and quote, exactly what Focus next shows. With no recommendation there is
 * nothing honest to practise, so it says so. Shared by the signed-in `/practice`
 * and the public `/sample/practice`; neither writes anything.
 */
export async function PracticeView({
	stored,
	emptyHref,
	evidenceHref,
	uploadHref,
	scenariosHref
}: {
	stored: StoredAssessment | null
	emptyHref: string
	evidenceHref?: (skill: string) => string
	uploadHref?: string
	/** The scenario practice session; the default is the signed-in one. */
	scenariosHref?: string
}) {
	const t = await getTranslations('Practice')
	const tAssessment = await getTranslations('Assessment')
	const focus = stored == null ? null : focusOf(stored, null)

	if (stored == null || focus == null || focus.kind !== 'ready') {
		return (
			<main className="flex flex-col gap-10 px-5 py-14 md:px-14 md:py-20">
				<PageHeader eyebrow={t('eyebrow')} title={t('empty.title')} intro={t('empty.body')} />
				<Link href={emptyHref} className="app-pill self-start">
					{t('empty.action')}
				</Link>
			</main>
		)
	}

	const recommendation = stored.assessment.recommendations[0]
	const evidence = stored.assessment.skills
		.find((skill) => skill.skill === focus.skill)
		?.evidence.find((item) => item.id === recommendation?.evidenceId)

	return (
		<main className="flex flex-col gap-12 px-5 py-14 md:px-14 md:py-20">
			<PageHeader
				eyebrow={`${t('eyebrow')} · ${tAssessment(`skills.${focus.skill}.name`)}`}
				title={t('heading')}
				intro={t('intro')}
			/>
			<aside className="border-border max-w-2xl border p-4" aria-labelledby="honesty-heading">
				<h2 id="honesty-heading" className="app-eyebrow">
					{t('honesty.title')}
				</h2>
				<p className="mt-2 text-sm">{t('honesty.body')}</p>
			</aside>
			<div className="max-w-3xl">
				<RewriteDrill
					skill={focus.skill}
					criterion={focus.criterion}
					quote={focus.quote}
					suggestion={evidence?.suggestion ?? null}
					assessment={{ id: stored.id, score: focus.score, observations: focus.observations }}
					evidenceHref={evidenceHref?.(focus.skill)}
					uploadHref={uploadHref}
				/>
				<Link
					href={scenariosHref ?? `/practice/session?assessment=${stored.id}`}
					className="app-nav-link mt-8 inline-block"
					data-testid="to-scenarios"
				>
					{t('toScenarios')}
				</Link>
			</div>
		</main>
	)
}
