import { attemptFeedback } from '@/features/ai-insights/insights'
import { attemptIdSchema } from '@/features/practice/stored'
import { answeringAiFailures, insightJson, statusOf } from '@/server/http/ai-insight-response'
import { failure, signedIn } from '@/server/http/json-route'

const NOT_FOUND = 'That attempt could not be found.'

/**
 * GET  /api/prompting-guru/attempts/:id/ai-feedback  the stored AI feedback on
 *      one of the caller's scored attempts ({ insight: null } if none yet).
 * POST /api/prompting-guru/attempts/:id/ai-feedback  generates it: feedback, a
 *      stronger example and a rewrite that keeps the answer's intent. Stored
 *      apart from the attempt; the rule-based score stays the official one.
 * Another user's attempt is a 404, the same as one that does not exist.
 */
const handle = (create: boolean) =>
	signedIn<{ params: Promise<{ id: string }> }>(async ({ context, userId }) => {
		const id = attemptIdSchema.safeParse((await context.params).id)
		if (!id.success) return failure(404, NOT_FOUND)
		return answeringAiFailures(async () => {
			const { result, found } = await attemptFeedback({ userId, attemptId: id.data, create })
			if (!found) return failure(404, NOT_FOUND)
			return insightJson(result, create ? statusOf(result) : 200)
		})
	})

export const GET = handle(false)
export const POST = handle(true)
