import 'server-only'
import { getFlag } from '@/lib/flags/server'
import { isAiConfigured } from '@/server/ai/llm'
import { isDevMockUser } from '@/server/auth/dev-frontend-mode'

/**
 * Whether a page should offer AI insights to this user: AI is switched on and
 * configured, the `ai_insights` kill switch is on, and the user is real (the
 * dev-mode mock user has no rows for the endpoints to find). When this is
 * false the pages simply leave the AI panels out; nothing else changes.
 */
export async function aiInsightsAvailable(user: { readonly id: string }): Promise<boolean> {
	if (isDevMockUser(user) || !isAiConfigured()) return false
	return getFlag('ai_insights', { userId: user.id })
}
