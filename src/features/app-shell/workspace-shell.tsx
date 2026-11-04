import { useTranslations } from 'next-intl'
import { DotMark } from '@/components/brand/dot-mark'
import { Link } from '@/i18n/routing'
import { WorkspaceHeader } from './workspace-header'
import { WorkspaceNav } from './workspace-nav'

/**
 * The signed-in frame: a sidebar (a top bar on small screens), a header and the
 * page. Signed-out pages (sign in, sign up, reset) keep the plain top bar in the
 * app layout.
 */
export function WorkspaceShell({ email, children }: { email: string; children: React.ReactNode }) {
	const t = useTranslations('AppShell')
	return (
		<div className="min-h-dvh lg:grid lg:grid-cols-[16.5rem_minmax(0,1fr)]">
			<a href="#workspace-content" className="app-skip">
				{t('skip')}
			</a>
			<aside
				aria-label={t('sidebar')}
				className="border-border bg-bg/80 flex flex-col gap-3 border-b backdrop-blur-sm lg:sticky lg:top-0 lg:h-dvh lg:gap-8 lg:border-r lg:border-b-0 lg:py-8"
			>
				<Link href="/" className="app-brand flex items-center gap-3 px-5 pt-4 lg:px-6 lg:pt-0">
					<span className="sr-only">{t('home')}</span>
					<DotMark className="h-5 w-16" />
					<span className="app-eyebrow text-text-faint hidden sm:block lg:hidden xl:block">
						{t('tagline')}
					</span>
				</Link>
				<WorkspaceNav />
			</aside>
			<div className="flex min-w-0 flex-col">
				<WorkspaceHeader email={email} />
				<div id="workspace-content" tabIndex={-1} className="outline-none">
					{children}
				</div>
			</div>
		</div>
	)
}
