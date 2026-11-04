import { requireUser } from '@/server/auth/current-user'

// The sign-in check runs here, above this segment's loading.tsx boundary. In the
// page it would sit inside the boundary, and a signed-out request would get a 200
// skeleton with a client-side redirect instead of the 307 that /sessions,
// /assessment and /account return. requireUser is cached per request, so the page
// asking again costs nothing.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
	await requireUser()
	return children
}
