import { z } from 'zod'
import { assessmentExplanation } from '@/features/ai-insights/insights'
import { answeringAiFailures, insightJson, statusOf } from '@/server/http/ai-insight-response'
import { failure, signedIn } from '@/server/http/json-route'

const NOT_FOUND = 'That assessment could not be found.'

/**
 * GET  /api/assessments/:id/insight  the stored AI explanation of one of the
 *      caller's assessments ({ insight: null } if none yet). Never generates.
 * POST /api/assessments/:id/insight  generates it, or reuses the stored one
 *      for the same assessment, prompt version and model.
 * The explanation reads the official scores and never changes them. Another
 * user's assessment is a 404, the same as one that does not exist.
 */
const handle = (create: boolean) =>
	signedIn<{ params: Promise<{ id: string }> }>(async ({ context, userId }) => {
		const id = z
			.string()
			.uuid()
			.safeParse((await context.params).id)
		if (!id.success) return failure(404, NOT_FOUND)
		return answeringAiFailures(async () => {
			const { result, found } = await assessmentExplanation({
				userId,
				assessmentId: id.data,
				create
			})
			if (!found) return failure(404, NOT_FOUND)
			return insightJson(result, create ? statusOf(result) : 200)
		})
	})

export const GET = handle(false)
export const POST = handle(true)
