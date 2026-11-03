import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { z } from 'zod'
import { PracticeView } from '@/features/practice/ui/practice-view'
import { getAssessment } from '@/features/workspace/workspace-data'
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
// same criterion and the same quote the dashboard's "Focus next" shows. Every
// lookup is scoped to the signed-in user. Nothing is written.
export default async function PracticePage({
	searchParams
}: {
	searchParams: Promise<{ assessment?: string }>
}) {
	const user = await requireUser()
	const requested = uuid.safeParse((await searchParams).assessment)
	const stored = await getAssessment(user, requested.success ? requested.data : undefined)
	return <PracticeView stored={stored} emptyHref="/dashboard" />
}
