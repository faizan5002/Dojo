import { getChallengeVersion } from '@/features/practice/challenge-repository'
import { toAttemptDto } from '@/features/practice/dto'
import { recordAttempt } from '@/features/practice/practice-repository'
import { slugSchema, submissionSchema } from '@/features/practice/stored'
import { db } from '@/server/db/client'
import { failure, json, signedIn } from '@/server/http/json-route'

/**
 * POST /api/prompting-guru/challenges/:slug/submit  { answer }
 * Loads the challenge's current version from PostgreSQL, redacts the answer,
 * scores it on the server against that version's stored criteria, and saves
 * the attempt linked to the version. The response is the scored attempt and,
 * now that the user has tried it, the strong answer. The body may carry only
 * the answer: the user, the score and the version are all decided here. The
 * answer is never logged.
 */
export const POST = signedIn<{ params: Promise<{ slug: string }> }>(
	async ({ request, context, userId }) => {
		const slug = slugSchema.safeParse((await context.params).slug)
		if (!slug.success) return failure(404, 'That challenge could not be found.')
		const body = submissionSchema.safeParse(await request.json().catch(() => null))
		if (!body.success) return failure(400, 'Write an answer of up to 8,000 characters.')

		const attempt = await recordAttempt({ db, userId, slug: slug.data, prompt: body.data.answer })
		if (attempt == null) return failure(404, 'That challenge is not available.')
		const version =
			attempt.challengeVersionId == null
				? null
				: await getChallengeVersion({ db, versionId: attempt.challengeVersionId })
		return json(toAttemptDto(attempt, version), 201)
	}
)
