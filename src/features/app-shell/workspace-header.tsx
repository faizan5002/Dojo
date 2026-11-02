'use client'

import { useTranslations } from 'next-intl'
import { ArrowUpRightIcon } from '@/components/ui/icons'
import { Link, usePathname } from '@/i18n/routing'
import { WORKSPACE_LINKS } from './workspace-nav'

const OFFERS_UPLOAD = ['/sessions', '/dashboard']

/**
 * The bar above every workspace page: where you are, who you are signed in as,
 * and the one action that starts the loop (upload sessions), which is left out
 * on the pages that already offer it (the upload page and the dashboard's own welcome block).
 */
export function WorkspaceHeader({ email }: { email: string }) {
	const t = useTranslations('AppShell')
	const pathname = usePathname()
	const current = WORKSPACE_LINKS.find((link) => link.href === pathname)
	const initial = email.trim().charAt(0).toUpperCase() || '?'
	return (
		<header
			aria-label={t('pageHeader')}
			className="border-border flex min-h-12 items-center justify-between gap-4 border-b px-5 md:min-h-16 md:px-14"
		>
			<p className="app-eyebrow text-text truncate">
				{current == null ? t('home') : t(current.key)}
			</p>
			<div className="flex min-w-0 items-center gap-4">
				<p
					className="text-text-muted flex min-w-0 items-center gap-3 text-sm"
					title={t('signedInAs', { email })}
				>
					<span
						aria-hidden="true"
						className="border-border-strong text-text flex size-8 shrink-0 items-center justify-center rounded-full border text-xs"
					>
						{initial}
					</span>
					<span className="sr-only">{t('signedInAs', { email })}</span>
					<span aria-hidden="true" className="hidden max-w-56 truncate sm:block">
						{email}
					</span>
				</p>
				{OFFERS_UPLOAD.includes(pathname) ? null : (
					<Link href="/sessions" className="app-pill app-pill-sm">
						{t('uploadAction')}
						<ArrowUpRightIcon size={12} />
					</Link>
				)}
			</div>
		</header>
	)
}
