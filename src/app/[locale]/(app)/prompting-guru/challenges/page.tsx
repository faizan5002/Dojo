import type { Metadata } from 'next'
import { Suspense } from 'react'
import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/features/app-shell/section'
import { loadPracticeContext } from '@/features/practice/load-practice'
import { ChallengeBrowser } from '@/features/practice/ui/challenge-browser'
import { requireUser } from '@/server/auth/current-user'

export async function generateMetadata({
	params
}: {
	params: Promise<{ locale: string }>
}): Promise<Metadata> {
	const t = await getTranslations({ locale: (await params).locale, namespace: 'Guru' })
	return { title: { absolute: t('meta.challengesTitle') } }
}

// The library itself is fetched in the browser from /api/prompting-guru/challenges,
// with its filters in the URL; the page adds the user's recommended challenge,
// which needs their assessment and history.
export default async function ChallengeLibraryPage() {
	const user = await requireUser()
	const [t, context] = await Promise.all([getTranslations('Guru'), loadPracticeContext(user.id)])

	return (
		<main className="flex flex-col gap-12 px-5 py-14 md:px-14 md:py-20">
			<PageHeader eyebrow={t('eyebrow')} title={t('library.title')} intro={t('library.intro')} />
			<Suspense fallback={<p className="text-text-muted">{t('library.loading')}</p>}>
				<ChallengeBrowser recommendedSlug={context.plan.next?.slug ?? null} />
			</Suspense>
		</main>
	)
}
