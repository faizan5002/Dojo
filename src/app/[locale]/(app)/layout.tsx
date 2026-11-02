import type { Metadata } from 'next'
import { Onest } from 'next/font/google'
import { getTranslations } from 'next-intl/server'
import { DotMark } from '@/components/brand/dot-mark'
import { AppNav } from '@/features/app-shell/app-nav'
import { WorkspaceShell } from '@/features/app-shell/workspace-shell'
import { getAppUser } from '@/server/auth/current-user'
import { isDevMockUser } from '@/server/auth/dev-frontend-mode'
import { Link } from '@/i18n/routing'
import { cn } from '@/lib/cn'
import './app.css'

// The landing page's typeface. next/font self-hosts it at build time, so a
// visitor's browser never requests Google Fonts.
const onest = Onest({ subsets: ['latin'], variable: '--font-onest', display: 'swap' })

// The application pages show a person's own data and are never indexed.
export const metadata: Metadata = {
	robots: { index: false, follow: false }
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
	const [t, user] = await Promise.all([getTranslations('AppShell'), getAppUser()])

	return (
		<div
			data-surface="app"
			className={cn(onest.variable, 'bg-bg text-text relative isolate min-h-dvh')}
		>
			<div aria-hidden="true" className="app-backdrop" />
			{isDevMockUser(user) ? (
				<p
					role="status"
					data-testid="dev-frontend-banner"
					className="border-border text-text-muted border-b px-5 py-2 text-center text-xs md:px-14"
				>
					{t('devMode')}
				</p>
			) : null}
			{user == null ? (
				<>
					<header className="border-border border-b">
						<nav className="flex h-20 items-center justify-between gap-6 px-5 md:px-14">
							<Link href="/" className="app-brand flex items-center gap-3">
								<span className="sr-only">{t('home')}</span>
								<DotMark className="h-5 w-16" />
								<span className="app-eyebrow text-text-faint hidden sm:block">{t('tagline')}</span>
							</Link>
							<AppNav isSignedIn={false} />
						</nav>
					</header>
					{children}
				</>
			) : (
				<WorkspaceShell email={user.email}>{children}</WorkspaceShell>
			)}
		</div>
	)
}
