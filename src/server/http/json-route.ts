import 'server-only'
import { NextResponse } from 'next/server'
import { captureError } from '@/lib/observability/capture-error'
import { getCurrentUser } from '@/server/auth/current-user'

// The plumbing every signed-in JSON endpoint shares: a 401 without a session,
// private no-store responses (the body is the user's own data, or depends on
// who asks), and one place that turns an unexpected error into a safe message
// through captureError. Handlers return `json(...)` or `failure(...)`.

const PRIVATE = { 'Cache-Control': 'private, no-store' }

export const json = (data: unknown, status = 200) =>
	NextResponse.json(data, { status, headers: PRIVATE })

export const failure = (status: number, error: string) =>
	NextResponse.json({ error }, { status, headers: PRIVATE })

type SignedInHandler<Context> = (input: {
	request: Request
	context: Context
	userId: string
}) => Promise<NextResponse>

/** Wraps a route handler so it only runs for a signed-in user, with errors captured. */
export function signedIn<Context>(handler: SignedInHandler<Context>) {
	return async (request: Request, context: Context): Promise<NextResponse> => {
		const user = await getCurrentUser()
		if (user == null) return failure(401, 'Your session has expired. Sign in again.')
		try {
			return await handler({ request, context, userId: user.id })
		} catch (error) {
			const { userMessage, status } = captureError(error)
			return failure(status, userMessage)
		}
	}
}
