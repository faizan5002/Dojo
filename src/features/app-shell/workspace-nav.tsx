'use client'

import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/routing'
import { signOut } from '@/server/actions/auth'

export const WORKSPACE_LINKS = [
	{ href: '/dashboard', key: 'dashboard' },
	{ href: '/sessions', key: 'sessions' },
	{ href: '/assessment', key: 'assessment' },
	{ href: '/prompting-guru', key: 'promptingGuru' },
	{ href: '/account', key: 'account' }
] as const

/**
 * The workspace's one navigation: a left rail from the desktop breakpoint up, a
 * wrapping bar below it. One element, so there is one set of links.
 */
export function WorkspaceNav() {
	const t = useTranslations('AppShell')
	const pathname = usePathname()
	return (
		<nav
			aria-label={t('workspaceNav')}
			className="flex flex-wrap items-stretch gap-1 px-2 pb-2 lg:flex-1 lg:flex-col lg:flex-nowrap lg:px-0 lg:pb-0"
		>
			{WORKSPACE_LINKS.map((link, index) => (
				<Link
					key={link.href}
					href={link.href}
					aria-current={
						pathname === link.href || pathname.startsWith(`${link.href}/`) ? 'page' : undefined
					}
					className="app-side-link"
				>
					<b aria-hidden="true" className="hidden lg:inline">
						{String(index + 1).padStart(2, '0')}
					</b>
					{t(link.key)}
				</Link>
			))}
			<form action={signOut} className="ml-auto lg:mt-auto lg:ml-0">
				<button type="submit" className="app-side-link w-full">
					{t('signOut')}
				</button>
			</form>
		</nav>
	)
}
