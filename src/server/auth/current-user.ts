import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { AppError } from '@/lib/errors/app-error'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { db } from '@/server/db/client'
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

// A signed-in user always has a users row before their workspace is touched:
// the auth callback and sign-in provision it, and this covers anyone who
// signed in before either ran.
const ensureUserRow = cache(async (user: CurrentUser): Promise<void> => {
	const existing = await db.user.findUnique({ where: { id: user.id }, select: { id: true } })
	if (existing == null) await provisionUser(user)
})

/** For pages: the signed-in user, or a redirect to sign in. */
export async function requireUser(): Promise<CurrentUser> {
	const user = await getCurrentUser()
	if (user == null) redirect('/sign-in')
	await ensureUserRow(user)
	return user
}

/** For actions: the signed-in user, or a 401 the action wrapper reports. */
export async function requireActionUser(): Promise<CurrentUser> {
	const user = await getCurrentUser()
	if (user == null) {
		throw new AppError('Your session has ended. Sign in again.', {
			status: 401,
			code: 'unauthorized'
		})
	}
	await ensureUserRow(user)
	return user
}
