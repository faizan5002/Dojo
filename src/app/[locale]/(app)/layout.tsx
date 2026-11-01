import type { Metadata } from 'next'
import { Onest } from 'next/font/google'
import { getTranslations } from 'next-intl/server'
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
	const t = await getTranslations('AppShell')

	return (
		<div data-surface="app" className={cn(onest.variable, 'bg-bg text-text min-h-dvh')}>
			<header className="border-border border-b">
				<nav className="mx-auto flex max-w-6xl items-center gap-8 px-6 py-4">
					<Link
						href="/"
						className="focus-visible:outline-accent text-lg font-semibold tracking-tight focus-visible:outline-2"
					>
						<span className="sr-only">{t('home')}</span>
						<span aria-hidden="true">Dojo</span>
					</Link>
					<Link
						href="/sessions"
						className="text-text-muted hover:text-text focus-visible:outline-accent text-sm focus-visible:outline-2"
					>
						{t('sessions')}
					</Link>
				</nav>
			</header>
			{children}
		</div>
	)
}
