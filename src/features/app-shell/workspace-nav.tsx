'use client'

import { useTranslations } from 'next-intl'
import { ArrowUpRightIcon, SignOutIcon } from '@/components/ui/icons'
import { SwordsIcon } from '@/features/progression/ui/dojo-icons'
import { NavChip } from '@/features/progression/ui/nav-chip'
import { clearReviewMemory } from '@/features/review/review-store'
import { Link, usePathname } from '@/i18n/routing'
import { signOut } from '@/server/actions/auth'

export const WORKSPACE_LINKS = [
	{ href: '/dashboard', match: '/dashboard', key: 'dashboard' },
	{ href: '/sessions', match: '/sessions', key: 'sessions' },
	{ href: '/assessment', match: '/assessment', key: 'assessment' },
	{ href: '/practice/session', match: '/practice', key: 'practice' },
	{ href: '/prompting-guru', match: '/prompting-guru', key: 'promptingGuru' },
	{ href: '/account', match: '/account', key: 'account' }
] as const

const OFFERS_UPLOAD = ['/sessions', '/dashboard']

/**
 * The workspace's one navigation, in the top bar: the five places you work, the one
 * action that starts the loop (upload sessions) where the page does not already
 * offer it, who you are signed in as, and sign out. One element, so there is one
 * set of links at every width; on a phone the row scrolls sideways inside itself.
 */
export function WorkspaceNav({ email }: { email: string }) {
	const t = useTranslations('AppShell')
	const pathname = usePathname()
	const initial = email.trim().charAt(0).toUpperCase() || '?'
	return (
		<nav
			aria-label={t('workspaceNav')}
			className="relative flex min-w-0 flex-1 items-center gap-1 overflow-x-auto max-md:hidden xl:overflow-visible"
		>
			<div className="flex items-center">
				{WORKSPACE_LINKS.map((link) => {
					const isCurrent = pathname === link.match || pathname.startsWith(`${link.match}/`)
					return (
						<Link
							key={link.href}
							href={link.href}
							aria-current={isCurrent ? 'page' : undefined}
							className="app-topnav-link"
						>
							{link.key === 'practice' ? <SwordsIcon size={16} /> : null}
							{t(link.key)}
						</Link>
					)
				})}
			</div>
			<div className="ml-auto flex shrink-0 items-center gap-3 pl-4">
				{OFFERS_UPLOAD.includes(pathname) ? null : (
					<Link href="/sessions" className="app-pill app-pill-sm">
						{t('uploadAction')}
						<ArrowUpRightIcon size={12} />
					</Link>
				)}
				<NavChip />
				<p
					className="text-text-muted flex items-center gap-3 text-sm"
					title={t('signedInAs', { email })}
				>
					<span
						aria-hidden="true"
						className="border-accent text-text flex size-8 shrink-0 items-center justify-center rounded-full border text-xs"
					>
						{initial}
					</span>
					<span className="sr-only">{t('signedInAs', { email })}</span>
					<span aria-hidden="true" className="hidden max-w-44 truncate xl:block">
						{email}
					</span>
				</p>
				<form action={signOut} onSubmit={() => clearReviewMemory()}>
					<button type="submit" className="app-topnav-link !min-h-11 !px-3" title={t('signOut')}>
						<SignOutIcon size={14} />
						<span className="hidden lg:inline">{t('signOut')}</span>
						<span className="sr-only lg:hidden">{t('signOut')}</span>
					</button>
				</form>
			</div>
		</nav>
	)
}
