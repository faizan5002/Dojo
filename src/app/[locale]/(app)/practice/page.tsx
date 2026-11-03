import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { z } from 'zod'
import { focusOf } from '@/features/dashboard/dashboard-model'
import { PageHeader } from '@/features/app-shell/section'
import { RewriteDrill } from '@/features/practice/ui/rewrite-drill'
import { getAssessment } from '@/features/workspace/workspace-data'
import { Link } from '@/i18n/routing'
import { requireUser } from '@/server/auth/current-user'

const uuid = z.string().uuid()

export async function generateMetadata({
	params
}: {
	params: Promise<{ locale: string }>
}): Promise<Metadata> {
	const t = await getTranslations({ locale: (await params).locale, namespace: 'Practice' })
	return { title: { absolute: t('meta.title') } }
}

// One drill, from the assessment's own first recommendation: the same skill, the
// same criterion and the same quote the dashboard's "Focus next" shows. With no
// recommendation there is nothing honest to practise, so the page says so.
export default async function PracticePage({
	searchParams
}: {
	searchParams: Promise<{ assessment?: string }>
}) {
	const user = await requireUser()
	const t = await getTranslations('Practice')
	const tAssessment = await getTranslations('Assessment')
	const requested = uuid.safeParse((await searchParams).assessment)
	const stored = await getAssessment(user, requested.success ? requested.data : undefined)
	const focus = stored == null ? null : focusOf(stored, null)

	if (stored == null || focus == null || focus.kind !== 'ready') {
		return (
			<main className="flex flex-col gap-10 px-5 py-14 md:px-14 md:py-20">
				<PageHeader eyebrow={t('eyebrow')} title={t('empty.title')} intro={t('empty.body')} />
				<Link href="/dashboard" className="app-pill self-start">
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
				/>
			</div>
		</main>
	)
}
