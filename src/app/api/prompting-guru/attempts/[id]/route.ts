import { getChallengeVersion } from '@/features/practice/challenge-repository'
import { toAttemptDto } from '@/features/practice/dto'
import { getAttempt } from '@/features/practice/practice-repository'
import { attemptIdSchema } from '@/features/practice/stored'
import { db } from '@/server/db/client'
import { failure, json, signedIn } from '@/server/http/json-route'

/**
 * GET /api/prompting-guru/attempts/:id
 * One of the caller's attempts with its full evaluation and the strong answer
 * of the version it was scored against. The lookup is scoped to the caller,
 * so another user's attempt is a 404, the same as one that does not exist.
 */
export const GET = signedIn<{ params: Promise<{ id: string }> }>(async ({ context, userId }) => {
	const id = attemptIdSchema.safeParse((await context.params).id)
	if (!id.success) return failure(404, 'That attempt could not be found.')
	const attempt = await getAttempt({ db, userId, attemptId: id.data })
	if (attempt == null) return failure(404, 'That attempt could not be found.')
	const version =
		attempt.challengeVersionId == null
			? null
			: await getChallengeVersion({ db, versionId: attempt.challengeVersionId })
	return json(toAttemptDto(attempt, version))
})
