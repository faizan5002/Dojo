'use client'

import { useTranslations } from 'next-intl'
import { ChevronRightIcon, SettingsIcon, SignOutIcon, UploadIcon } from '@/components/ui/icons'
import { clearReviewMemory } from '@/features/review/review-store'
import { Link } from '@/i18n/routing'
import { signOut } from '@/server/actions/auth'

/**
 * Where the phone keeps what the top bar keeps elsewhere: sessions and upload, account and
 * sign out. Tablet and desktop reach these from the top bar, so this list is phone-only.
 */
export function ProfileActions() {
	const t = useTranslations('AppShell')
	return (
		<ul
			className="dj-only-phone border-border-strong flex flex-col border"
			data-testid="profile-actions"
		>
			<li className="border-border border-b">
				<Link href="/sessions" className="dj-row">
					<UploadIcon size={20} />
					<span>{t('sessions')}</span>
					<ChevronRightIcon size={16} />
				</Link>
			</li>
			<li className="border-border border-b">
				<Link href="/account" className="dj-row">
					<SettingsIcon size={20} />
					<span>{t('account')}</span>
					<ChevronRightIcon size={16} />
				</Link>
			</li>
			<li>
				<form action={signOut} onSubmit={() => clearReviewMemory()}>
					<button type="submit" className="dj-row w-full">
						<SignOutIcon size={20} />
						<span className="text-left">{t('signOut')}</span>
						<span />
					</button>
				</form>
			</li>
		</ul>
	)
}
