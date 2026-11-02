'use client'

import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/routing'

const LINKS = [
	{ href: '/', key: 'landing' },
	{ href: '/sessions', key: 'sessions' },
	{ href: '/assessment', key: 'assessment' }
] as const

export function AppNav() {
	const t = useTranslations('AppShell')
	const pathname = usePathname()

	return (
		<div className="flex items-center gap-5 md:gap-10">
			{LINKS.map((link) => (
				<Link
					key={link.href}
					href={link.href}
					aria-current={pathname === link.href ? 'page' : undefined}
					className="app-nav-link"
				>
					{t(link.key)}
				</Link>
			))}
		</div>
	)
}
