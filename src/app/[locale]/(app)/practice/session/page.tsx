import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { z } from 'zod'
import { ScenarioView } from '@/features/practice/ui/scenario-view'
import { getAssessment } from '@/features/workspace/workspace-data'
import { requireUser } from '@/server/auth/current-user'

const uuid = z.string().uuid()

export async function generateMetadata({
	params
}: {
	params: Promise<{ locale: string }>
}): Promise<Metadata> {
	const t = await getTranslations({ locale: (await params).locale, namespace: 'Practice.session' })
	return { title: { absolute: t('meta.title') } }
}

// A scenario practice session built from the signed-in user's own assessment. Every
// lookup is scoped to them; nothing is written, and the session's answers stay in the tab.
export default async function PracticeSessionPage({
	searchParams
}: {
	searchParams: Promise<{ assessment?: string }>
}) {
	const user = await requireUser()
	const requested = uuid.safeParse((await searchParams).assessment)
	const stored = await getAssessment(user, requested.success ? requested.data : undefined)
	const id = stored?.id ?? ''
	return (
		<ScenarioView
			stored={stored}
			emptyHref="/dashboard"
			links={{
				assessment: `/assessment?id=${id}`,
				conversation: `/assessment/session?id=${id}`,
				drill: `/practice?assessment=${id}`,
				upload: '/sessions',
				restart: `/practice/session?assessment=${id}`
			}}
		/>
	)
}
