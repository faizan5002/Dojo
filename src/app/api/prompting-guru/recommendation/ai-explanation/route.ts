import { recommendationExplanation } from '@/features/ai-insights/insights'
import { answeringAiFailures, insightJson, statusOf } from '@/server/http/ai-insight-response'
import { signedIn } from '@/server/http/json-route'

/**
 * GET  /api/prompting-guru/recommendation/ai-explanation  the stored AI note on
 *      why the caller's current recommended challenge suits them.
 * POST /api/prompting-guru/recommendation/ai-explanation  generates it.
 * The challenge is chosen by Dojo's deterministic planner (from the latest
 * assessment, practice history, difficulty progression and due reviews); the
 * AI only explains that choice and never picks or invents a challenge. The
 * response names the recommended `slug`, null when nothing is recommended.
 */
const handle = (create: boolean) =>
	signedIn(async ({ userId }) =>
		answeringAiFailures(async () => {
			const { result, slug } = await recommendationExplanation({ userId, create })
			return insightJson(result, create ? statusOf(result) : 200, { slug })
		})
	)

export const GET = handle(false)
export const POST = handle(true)
