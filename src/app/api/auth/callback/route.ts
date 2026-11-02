import { NextResponse, type NextRequest } from 'next/server'
import { captureError } from '@/lib/observability/capture-error'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { provisionUser } from '@/server/auth/provision-user'

const DEFAULT_NEXT = '/sessions'

// Only a path on this site: never `//host` or a full URL, so the link in an
// email cannot be turned into a redirect somewhere else.
function safeNext(value: string | null): string {
	return value != null && value.startsWith('/') && !value.startsWith('//') ? value : DEFAULT_NEXT
}

// Where Supabase's email links land (confirm sign-up, reset password): trade
// the one-time code for a session cookie, make sure the user row exists, go on.
export async function GET(request: NextRequest) {
	const code = request.nextUrl.searchParams.get('code')
	const next = safeNext(request.nextUrl.searchParams.get('next'))
	if (code != null) {
		const supabase = await createServerSupabaseClient()
		const { data, error } = await supabase.auth.exchangeCodeForSession(code)
		if (error == null && data.user.email != null) {
			await provisionUser({ id: data.user.id, email: data.user.email })
			return NextResponse.redirect(new URL(next, request.url))
		}
		if (error != null) captureError(error)
	}
	return NextResponse.redirect(new URL('/sign-in?error=link', request.url))
}
