import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/features/app-shell/section'
import type { StoredAssessment } from '@/features/workspace/repository'
import { Link } from '@/i18n/routing'
import { buildPlan } from '../scenarios/plan'
import { ScenarioSession, type ScenarioLinks } from './scenario-session'

/**
 * The scenario practice page for one assessment: the plan comes from the
 * assessment's own scores and starts at once, with no setup screen. Shared by the
 * signed-in `/practice/session` and the public `/sample/practice/session`; it
 * reads the assessment it is given and writes nothing.
 */
export async function ScenarioView({
	stored,
	links,
	emptyHref
}: {
	stored: StoredAssessment | null
	links: ScenarioLinks
	emptyHref: string
}) {
	const t = await getTranslations('Practice.session')
	const tAssessment = await getTranslations('Assessment')
	const plan = stored == null ? null : buildPlan(stored.assessment)

	if (plan == null) {
		return (
			<main className="flex flex-col gap-10 px-5 py-14 md:px-14 md:py-20">
				<PageHeader eyebrow={t('heading')} title={t('empty.title')} intro={t('empty.body')} />
				<Link href={emptyHref} className="app-pill self-start">
					{t('empty.action')}
				</Link>
			</main>
		)
	}

	const skills = plan.skills
		.map((each) => `${tAssessment(`skills.${each.skill}.name`)} (${each.score})`)
		.join(', ')

	return (
		<main className="flex flex-col gap-8 px-5 py-10 md:px-14 md:py-14">
			<h1 className="sr-only">{t('heading')}</h1>
			<ScenarioSession plan={plan} assessmentLabel={t('from', { skills })} links={links} />
		</main>
	)
}
