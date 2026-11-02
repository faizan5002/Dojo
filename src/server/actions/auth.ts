'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { captureError } from '@/lib/observability/capture-error'
import { siteUrl } from '@/lib/seo/site'
import { createSecretKeyClient } from '@/lib/supabase/secret-key'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { deleteUserData } from '@/features/workspace/repository'
import { getCurrentUser, isAuthConfigured, requireActionUser } from '@/server/auth/current-user'
import { isDevFrontendMode } from '@/server/auth/dev-frontend-mode'
import { provisionUser } from '@/server/auth/provision-user'
import { db } from '@/server/db/client'

// Sign-up, sign-in, sign-out, password reset and account deletion, through
// Supabase Auth (docs/rules/auth.md). Each returns a message code the form
// shows; none ever echoes a password back or writes one to a log.

export type AuthFormCode =
	| 'invalidInput'
	| 'weakPassword'
	| 'emailTaken'
	| 'invalidCredentials'
	| 'emailNotConfirmed'
	| 'notConfigured'
	| 'unavailable'
	| 'checkEmail'
	| 'resetSent'
	| 'confirmMismatch'
	| 'devFrontendMode'

export interface AuthFormState {
	readonly status: 'idle' | 'error' | 'notice'
	readonly code?: AuthFormCode
}

const MIN_PASSWORD_LENGTH = 10
const MAX_PASSWORD_LENGTH = 72
const MAX_EMAIL_LENGTH = 254
const SESSION_HOME = '/sessions'

const email = z.string().trim().toLowerCase().email().max(MAX_EMAIL_LENGTH)
const password = z.string().min(MIN_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH)
const credentials = z.object({ email, password })

const error = (code: AuthFormCode): AuthFormState => ({ status: 'error', code })
const notice = (code: AuthFormCode): AuthFormState => ({ status: 'notice', code })

function field(formData: FormData, name: string): string {
	const value = formData.get(name)
	return typeof value === 'string' ? value : ''
}

const callbackUrl = (next: string) =>
	`${siteUrl()}/api/auth/callback?next=${encodeURIComponent(next)}`

// Supabase's error codes for what a person can fix; anything else is ours.
function codeFor(supabaseCode: string | undefined): AuthFormCode {
	switch (supabaseCode) {
		case 'weak_password':
			return 'weakPassword'
		case 'user_already_exists':
		case 'email_exists':
			return 'emailTaken'
		case 'invalid_credentials':
			return 'invalidCredentials'
		case 'email_not_confirmed':
			return 'emailNotConfirmed'
		default:
			return 'unavailable'
	}
}

function reportUnexpected(code: AuthFormCode, cause: unknown): AuthFormState {
	if (code === 'unavailable') captureError(cause)
	return error(code)
}

export async function signUp(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
	if (!isAuthConfigured()) return error('notConfigured')
	const parsed = credentials.safeParse({
		email: field(formData, 'email'),
		password: field(formData, 'password')
	})
	if (!parsed.success) {
		return error(
			parsed.error.issues.some((issue) => issue.path[0] === 'password')
				? 'weakPassword'
				: 'invalidInput'
		)
	}
	const supabase = await createServerSupabaseClient()
	const { data, error: failure } = await supabase.auth.signUp({
		...parsed.data,
		options: { emailRedirectTo: callbackUrl(SESSION_HOME) }
	})
	if (failure != null) return reportUnexpected(codeFor(failure.code), failure)
	// With email confirmation on, Supabase answers a taken address with a user
	// that has no identities instead of an error, so as not to reveal it.
	if (data.user != null && data.user.identities?.length === 0) return error('emailTaken')
	if (data.session == null || data.user?.email == null) return notice('checkEmail')
	await provisionUser({ id: data.user.id, email: data.user.email })
	redirect(SESSION_HOME)
}

export async function signIn(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
	if (!isAuthConfigured()) return error('notConfigured')
	const parsed = z
		.object({ email, password: z.string().min(1).max(MAX_PASSWORD_LENGTH) })
		.safeParse({ email: field(formData, 'email'), password: field(formData, 'password') })
	if (!parsed.success) return error('invalidCredentials')
	const supabase = await createServerSupabaseClient()
	const { data, error: failure } = await supabase.auth.signInWithPassword(parsed.data)
	if (failure != null) return reportUnexpected(codeFor(failure.code), failure)
	if (data.user.email != null) await provisionUser({ id: data.user.id, email: data.user.email })
	redirect(SESSION_HOME)
}

export async function signOut(): Promise<void> {
	if (isAuthConfigured()) {
		const supabase = await createServerSupabaseClient()
		await supabase.auth.signOut()
	}
	redirect('/')
}

export async function requestPasswordReset(
	_previous: AuthFormState,
	formData: FormData
): Promise<AuthFormState> {
	if (!isAuthConfigured()) return error('notConfigured')
	const parsed = email.safeParse(field(formData, 'email'))
	if (!parsed.success) return error('invalidInput')
	const supabase = await createServerSupabaseClient()
	const { error: failure } = await supabase.auth.resetPasswordForEmail(parsed.data, {
		redirectTo: callbackUrl('/reset-password')
	})
	if (failure != null && failure.status !== 429) captureError(failure)
	// The same answer whether or not the address has an account.
	return notice('resetSent')
}

export async function updatePassword(
	_previous: AuthFormState,
	formData: FormData
): Promise<AuthFormState> {
	if (!isAuthConfigured()) return error('notConfigured')
	const parsed = password.safeParse(field(formData, 'password'))
	if (!parsed.success) return error('weakPassword')
	const supabase = await createServerSupabaseClient()
	const { error: failure } = await supabase.auth.updateUser({ password: parsed.data })
	if (failure != null) return reportUnexpected(codeFor(failure.code), failure)
	redirect(SESSION_HOME)
}

/**
 * Deletes the caller's workspace, then their sign-in account. The caller
 * types their email to confirm; the id deleted is always the session's own.
 */
export async function deleteAccount(
	_previous: AuthFormState,
	formData: FormData
): Promise<AuthFormState> {
	// Frontend dev mode has no account to delete; say so instead of throwing.
	if ((await getCurrentUser()) == null && isDevFrontendMode()) return error('devFrontendMode')
	const user = await requireActionUser()
	if (field(formData, 'confirm').trim().toLowerCase() !== user.email.toLowerCase()) {
		return error('confirmMismatch')
	}
	await deleteUserData({ db, userId: user.id })
	if (process.env.SUPABASE_SECRET_KEY) {
		const { error: failure } = await createSecretKeyClient().auth.admin.deleteUser(user.id)
		if (failure != null) captureError(failure)
	}
	const supabase = await createServerSupabaseClient()
	await supabase.auth.signOut()
	redirect('/')
}
