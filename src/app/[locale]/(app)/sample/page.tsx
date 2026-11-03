import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { ArrowUpRightIcon } from '@/components/ui/icons'
import { PageHeader, SectionHeading } from '@/features/app-shell/section'
import { loadSample } from '@/features/sample/sample-session'
import { SampleBanner } from '@/features/sample/ui/sample-banner'
import { Link } from '@/i18n/routing'

export async function generateMetadata({
	params
}: {
	params: Promise<{ locale: string }>
}): Promise<Metadata> {
	const t = await getTranslations({ locale: (await params).locale, namespace: 'Sample' })
	return { title: { absolute: t('meta.title') } }
}

// Public and read-only: no account, no upload, no database. The sample is a fixed,
// invented session; this page shows its prompts and offers to run the assessment.
export default async function SamplePage() {
	const t = await getTranslations('Sample')
	const sample = await loadSample()
	const prompts = sample.sessions.flatMap((session) =>
		session.turns.flatMap((turn) => (turn.prompt == null ? [] : [turn.prompt.text]))
	)
	return (
		<>
			<SampleBanner />
			<main className="flex flex-col gap-16 px-5 py-14 md:px-14 md:py-20">
				<PageHeader
					eyebrow={t('eyebrow')}
					title={t('title')}
					intro={t('intro')}
					note={t('how.body')}
				/>
				<section aria-labelledby="session-heading" className="flex flex-col gap-8">
					<SectionHeading id="session-heading" number="01">
						{t('session.heading')}
					</SectionHeading>
					<p className="text-text-muted max-w-2xl text-sm">{t('session.note')}</p>
					<p className="app-eyebrow">
						{t('session.file', { name: sample.fileName })} ·{' '}
						{t('session.count', { count: prompts.length })}
					</p>
					<ol
						className="border-border flex max-w-3xl flex-col border-t"
						data-testid="sample-prompts"
					>
						{prompts.map((text, index) => (
							<li key={index} className="border-border flex flex-col gap-1 border-b py-4">
								<span className="app-eyebrow">{t('session.prompt', { number: index + 1 })}</span>
								<span className="break-words whitespace-pre-wrap">{text}</span>
							</li>
						))}
					</ol>
				</section>
				<div className="flex flex-wrap items-center gap-x-8 gap-y-4">
					<Link href="/sample/assessment" className="app-pill">
						{t('run')}
						<ArrowUpRightIcon size={14} />
					</Link>
					<Link href="/sessions" className="app-nav-link">
						{t('ownLogs')}
					</Link>
				</div>
			</main>
		</>
	)
}
