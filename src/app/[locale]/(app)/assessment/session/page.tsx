import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { z } from 'zod'
import { PageHeader } from '@/features/app-shell/section'
import { buildSessionView, pickSession } from '@/features/review/session-view'
import { SessionReviewer } from '@/features/review/ui/session-reviewer'
import { getAssessment, getAssessmentSessions } from '@/features/workspace/workspace-data'
import { Link } from '@/i18n/routing'
import { requireUser } from '@/server/auth/current-user'

const uuid = z.string().uuid()
const MAX_PARAM_CHARS = 128

export async function generateMetadata({
	params
}: {
	params: Promise<{ locale: string }>
}): Promise<Metadata> {
	const t = await getTranslations({ locale: (await params).locale, namespace: 'Review' })
	return { title: { absolute: t('meta.title') } }
}

// A saved assessment's original conversation with its findings on the exact words
// they quote. Every read is scoped to the signed-in user: an id that is not theirs
// is a 404, like the assessment page. Nothing here writes to the account; the review
// marks and notes live in this browser (see review-store.ts).
export default async function AssessmentSessionPage({
	searchParams
}: {
	searchParams: Promise<{ id?: string; session?: string; finding?: string }>
}) {
	const user = await requireUser()
	const t = await getTranslations('Review')
	const params = await searchParams
	const id = uuid.safeParse(params.id)
	if (!id.success) notFound()
	const stored = await getAssessment(user, id.data)
	if (stored == null) notFound()
	const sessions = await getAssessmentSessions(user, stored)
	const clip = (value: string | undefined) => value?.slice(0, MAX_PARAM_CHARS)
	const session = pickSession(sessions, stored.assessment.skills, {
		sessionId: clip(params.session),
		findingId: clip(params.finding)
	})
	if (session == null) notFound()
	const view = buildSessionView(session, stored.assessment.skills)
	const others = sessions.filter((each) => each.sessionId !== session.sessionId)

	return (
		<main className="flex flex-col gap-12 px-5 py-14 md:px-14 md:py-20">
			<PageHeader eyebrow={t('eyebrow')} title={t('title')} intro={t('intro')} />
			<SessionReviewer
				key={`${stored.id}:${session.sessionId}`}
				view={view}
				scope={`u:${user.id}:a:${stored.id}`}
				scopeNote="browser"
				initialFindingId={clip(params.finding) ?? null}
				links={{
					assessment: `/assessment?id=${stored.id}`,
					practice: `/practice/session?assessment=${stored.id}`
				}}
			/>
			<div className="flex flex-wrap items-center gap-x-8 gap-y-3">
				<Link href={`/assessment?id=${stored.id}`} className="app-nav-link">
					{t('backToAssessment')}
				</Link>
				{others.length === 0 ? null : (
					<nav aria-label={t('otherSessions')} className="flex flex-wrap items-center gap-4">
						<span className="app-eyebrow">{t('otherSessions')}</span>
						{others.map((each) => (
							<Link
								key={each.sessionId}
								href={`/assessment/session?id=${stored.id}&session=${encodeURIComponent(each.sessionId)}`}
								className="app-nav-link"
							>
								{each.project ?? each.sessionId.slice(0, 8)}
							</Link>
						))}
					</nav>
				)}
			</div>
		</main>
	)
}
