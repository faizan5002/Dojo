import { getChallenge } from '@/features/practice/challenge-repository'
import { toDetailDto } from '@/features/practice/dto'
import { slugSchema } from '@/features/practice/stored'
import { db } from '@/server/db/client'
import { failure, json, signedIn } from '@/server/http/json-route'

/**
 * GET /api/prompting-guru/challenges/:slug
 * What a user needs to start the exercise: scenario, instructions and the given
 * prompt or reply. Never the criteria or the strong answer. A retired or
 * unknown challenge is a 404.
 */
export const GET = signedIn<{ params: Promise<{ slug: string }> }>(async ({ context }) => {
	const slug = slugSchema.safeParse((await context.params).slug)
	if (!slug.success) return failure(404, 'That challenge could not be found.')
	const challenge = await getChallenge({ db, slug: slug.data })
	if (challenge == null || !challenge.isActive) {
		return failure(404, 'That challenge could not be found.')
	}
	return json(toDetailDto(challenge))
})
