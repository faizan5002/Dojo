'use client'

import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/routing'
import { signOut } from '@/server/actions/auth'

const SIGNED_IN_LINKS = [
	{ href: '/sessions', key: 'sessions' },
	{ href: '/assessment', key: 'assessment' },
	{ href: '/prompting-guru', key: 'promptingGuru' },
	{ href: '/account', key: 'account' }
] as const

export function AppNav({ isSignedIn }: { isSignedIn: boolean }) {
	const t = useTranslations('AppShell')
	const pathname = usePathname()
	const links = isSignedIn ? SIGNED_IN_LINKS : ([{ href: '/sign-in', key: 'signIn' }] as const)

	return (
		<div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2 md:gap-x-10">
			<Link href="/" className="app-nav-link hidden sm:inline">
				{t('landing')}
			</Link>
			{links.map((link) => (
				<Link
					key={link.href}
					href={link.href}
					aria-current={
						pathname === link.href || pathname.startsWith(`${link.href}/`) ? 'page' : undefined
					}
					className="app-nav-link"
				>
					{t(link.key)}
				</Link>
			))}
			{isSignedIn ? (
				<form action={signOut}>
					<button type="submit" className="app-nav-link">
						{t('signOut')}
					</button>
				</form>
			) : null}
		</div>
	)
}
