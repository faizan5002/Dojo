import { useTranslations } from 'next-intl'
import { DotMark } from '@/components/brand/dot-mark'
import { UploadIcon } from '@/components/ui/icons'
import { Celebration } from '@/features/progression/ui/celebration'
import { NavChip } from '@/features/progression/ui/nav-chip'
import { Link } from '@/i18n/routing'
import { MobileTabBar } from './mobile-tab-bar'
import { WorkspaceNav } from './workspace-nav'

/**
 * The signed-in frame. From tablet width: a sticky top bar (brand, the places you work,
 * upload, who you are, sign out). On a phone: a compact header (brand, streak, upload,
 * profile) and a bottom tab bar, like an app. Signed-out pages (sign in, sign up, reset)
 * keep the plain top bar in the app layout.
 */
export function WorkspaceShell({ email, children }: { email: string; children: React.ReactNode }) {
	const t = useTranslations('AppShell')
	const initial = email.trim().charAt(0).toUpperCase() || '?'
	return (
		<div className="dj-frame min-h-dvh">
			<a href="#workspace-content" className="app-skip">
				{t('skip')}
			</a>
			<header aria-label={t('pageHeader')} className="app-topbar">
				<div className="mx-auto flex max-w-[96rem] items-center gap-x-6 px-4 md:px-10 xl:flex-nowrap">
					<Link href="/" className="app-brand flex shrink-0 items-center gap-3 py-3 xl:py-0">
						<span className="sr-only">{t('home')}</span>
						<DotMark className="h-5 w-16" />
					</Link>
					<WorkspaceNav email={email} />
					<div className="ml-auto flex items-center gap-1 md:hidden">
						<NavChip />
						<Link href="/sessions" className="dj-icon-btn" aria-label={t('sessionsShort')}>
							<UploadIcon size={22} />
						</Link>
						<Link href="/profile" className="dj-avatar" aria-label={t('tab.profile')}>
							{initial}
						</Link>
					</div>
				</div>
			</header>
			<Celebration />
			<div id="workspace-content" tabIndex={-1} className="mx-auto max-w-[96rem] outline-none">
				{children}
			</div>
			<MobileTabBar />
		</div>
	)
}
