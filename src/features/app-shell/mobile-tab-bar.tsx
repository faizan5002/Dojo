'use client'

import { useTranslations } from 'next-intl'
import { levelOf } from '@/features/progression/model'
import { useProgress } from '@/features/progression/store'
import { RankEmblem, ScrollIcon, SwordsIcon, ToriiIcon } from '@/features/progression/ui/dojo-icons'
import { Link, usePathname } from '@/i18n/routing'

const TABS = [
	{ href: '/dashboard', match: ['/dashboard'], key: 'dashboard' },
	{ href: '/practice/session', match: ['/practice'], key: 'training' },
	{ href: '/assessment', match: ['/assessment', '/sessions'], key: 'progress' },
	{ href: '/profile', match: ['/profile', '/achievements', '/account'], key: 'profile' }
] as const

/**
 * The phone's navigation: four places along a cedar beam at the bottom edge, thumb height, with
 * the home indicator's inset below. Dojo is the gate, Train the crossed swords, Progress the
 * assessment scroll, Profile your rank emblem: the same icons those ideas wear everywhere else.
 * Sessions, upload, account and sign out live in the header and on the profile screen. It is the
 * workspace landmark on phones; the top bar's links are the landmark from tablet width up, and
 * only one of the two is ever displayed.
 */
export function MobileTabBar() {
	const t = useTranslations('AppShell')
	const pathname = usePathname()
	const { state } = useProgress()
	const info = state == null ? null : levelOf(state.xp)
	return (
		<nav aria-label={t('workspaceNav')} className="dj-tabbar md:hidden">
			<ul>
				{TABS.map(({ href, match, key }) => {
					const isCurrent = match.some((m) => pathname === m || pathname.startsWith(`${m}/`))
					return (
						<li key={key}>
							<Link href={href} aria-current={isCurrent ? 'page' : undefined} className="dj-tab">
								{key === 'dashboard' ? (
									<ToriiIcon size={26} />
								) : key === 'training' ? (
									<SwordsIcon size={26} />
								) : key === 'progress' ? (
									<ScrollIcon size={26} />
								) : (
									<span className="dj-tab-rank" aria-hidden="true">
										<RankEmblem level={info?.level ?? 1} pct={0} size={28} />
									</span>
								)}
								<span>{t(`tab.${key}`)}</span>
							</Link>
						</li>
					)
				})}
			</ul>
		</nav>
	)
}
