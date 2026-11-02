import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { AppError } from '@/lib/errors/app-error'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { db } from '@/server/db/client'
import { DEV_MOCK_USER, isDevFrontendMode, isDevMockUser } from './dev-frontend-mode'
import { provisionUser } from './provision-user'

export interface CurrentUser {
	readonly id: string
	readonly email: string
}

export function isAuthConfigured(): boolean {
	return Boolean(
		process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
	)
}

/** The signed-in user from the Supabase session, or null. One lookup per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
	if (!isAuthConfigured()) return null
	const supabase = await createServerSupabaseClient()
	const {
		data: { user }
	} = await supabase.auth.getUser()
	if (user?.email == null) return null
	return { id: user.id, email: user.email }
})

/**
 * The user the app pages act for: the real signed-in user, or, only in the
 * explicit development frontend mode (dev-frontend-mode.ts), a labelled mock
 * user. getCurrentUser stays purely real, so sign-in and sign-up behave as in
 * production.
 */
export const getAppUser = cache(async (): Promise<CurrentUser | null> => {
	const real = await getCurrentUser()
	if (real != null) return real
	return isDevFrontendMode() ? { id: DEV_MOCK_USER.id, email: DEV_MOCK_USER.email } : null
})

// A signed-in user always has a users row before their workspace is touched:
// the auth callback and sign-in provision it, and this covers anyone who
// signed in before either ran.
const ensureUserRow = cache(async (user: CurrentUser): Promise<void> => {
	const existing = await db.user.findUnique({ where: { id: user.id }, select: { id: true } })
	if (existing == null) await provisionUser(user)
})

/** For pages: the signed-in user, or a redirect to sign in. */
export async function requireUser(): Promise<CurrentUser> {
	const user = await getAppUser()
	if (user == null) redirect('/sign-in')
	// The mock user has no database row, and frontend mode never writes one.
	if (!isDevMockUser(user)) await ensureUserRow(user)
	return user
}

/** For actions: the signed-in user, or a 401 the action wrapper reports. */
export async function requireActionUser(): Promise<CurrentUser> {
	const user = await getCurrentUser()
	if (user == null && isDevFrontendMode()) {
		throw new AppError(
			'Frontend dev mode shows sample data only. Sign in with a real account to do this.',
			{ status: 403, code: 'dev_frontend_mode' }
		)
	}
	if (user == null) {
		throw new AppError('Your session has ended. Sign in again.', {
			status: 401,
			code: 'unauthorized'
		})
	}
	await ensureUserRow(user)
	return user
}
