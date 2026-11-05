import { challengeExample } from '@/features/ai-insights/insights'
import { slugSchema } from '@/features/practice/stored'
import { answeringAiFailures, insightJson, statusOf } from '@/server/http/ai-insight-response'
import { failure, signedIn } from '@/server/http/json-route'

const NOT_FOUND = 'That challenge could not be found.'

/**
 * GET  /api/prompting-guru/challenges/:slug/ai-example  the caller's stored
 *      AI-generated example answer for the challenge's current version.
 * POST /api/prompting-guru/challenges/:slug/ai-example  generates it from the
 *      challenge's public brief only, independently of Dojo's own strong answer.
 * Like that answer, it is never shown before the user has submitted an attempt:
 * without one, both methods answer 403. An unknown challenge is a 404.
 */
const handle = (create: boolean) =>
	signedIn<{ params: Promise<{ slug: string }> }>(async ({ context, userId }) => {
		const slug = slugSchema.safeParse((await context.params).slug)
		if (!slug.success) return failure(404, NOT_FOUND)
		return answeringAiFailures(async () => {
			const { result, access } = await challengeExample({ userId, slug: slug.data, create })
			if (access === 'not_found') return failure(404, NOT_FOUND)
			if (access === 'attempt_first') {
				return failure(403, 'Submit an attempt at this challenge before asking for an example.')
			}
			return insightJson(result, create ? statusOf(result) : 200)
		})
	})

export const GET = handle(false)
export const POST = handle(true)
