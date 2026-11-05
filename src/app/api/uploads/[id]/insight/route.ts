import { z } from 'zod'
import { sessionAnalysis } from '@/features/ai-insights/insights'
import { answeringAiFailures, insightJson, statusOf } from '@/server/http/ai-insight-response'
import { failure, signedIn } from '@/server/http/json-route'

const NOT_FOUND = 'That upload could not be found.'

/**
 * GET  /api/uploads/:id/insight  the stored AI analysis of one of the caller's
 *      uploads ({ insight: null } if none yet). Never generates.
 * POST /api/uploads/:id/insight  generates it from a capped, re-redacted
 *      sample of the upload's prompts and its metrics (never whole logs), or
 *      reuses the stored one for the same input. Every evidence quote in the
 *      answer is checked against what was sent; unverified ones are dropped.
 * Another user's upload is a 404, the same as one that does not exist.
 */
const handle = (create: boolean) =>
	signedIn<{ params: Promise<{ id: string }> }>(async ({ context, userId }) => {
		const id = z
			.string()
			.uuid()
			.safeParse((await context.params).id)
		if (!id.success) return failure(404, NOT_FOUND)
		return answeringAiFailures(async () => {
			const { result, found } = await sessionAnalysis({ userId, uploadId: id.data, create })
			if (!found) return failure(404, NOT_FOUND)
			return insightJson(result, create ? statusOf(result) : 200)
		})
	})

export const GET = handle(false)
export const POST = handle(true)
