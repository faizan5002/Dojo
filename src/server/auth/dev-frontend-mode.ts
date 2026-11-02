// Temporary, development-only "frontend mode": lets the app pages render with a
// labelled mock user and fixture data while Supabase sign-in is not set up.
//
// It is off unless BOTH hold: the build is not a production build, and
// DOJO_DEV_FRONTEND_MODE is exactly "true". `next build` and `next start` always
// run with NODE_ENV=production, so a deployment cannot switch it on whatever
// its environment says. It never touches the real session code: a real signed-in
// user is always preferred, and the mock user is only a fallback when there is none.
// No server-only import: the guard is a pure function so tests can prove it.

export const DEV_FRONTEND_FLAG = 'DOJO_DEV_FRONTEND_MODE'

/** The fixed, obviously fake user shown in frontend mode. Never stored anywhere. */
export const DEV_MOCK_USER = {
	id: '00000000-0000-4000-8000-0000000000d0',
	email: 'frontend-dev@dojo.invalid',
	name: 'Frontend dev user'
} as const

interface ModeEnv {
	readonly NODE_ENV?: string
	readonly DOJO_DEV_FRONTEND_MODE?: string
}

export function isDevFrontendMode(env: ModeEnv = process.env): boolean {
	return env.NODE_ENV !== 'production' && env.DOJO_DEV_FRONTEND_MODE === 'true'
}

/** True only for the mock user, and only while frontend mode is on. */
export function isDevMockUser(user: { readonly id: string } | null, env: ModeEnv = process.env) {
	return user != null && user.id === DEV_MOCK_USER.id && isDevFrontendMode(env)
}
