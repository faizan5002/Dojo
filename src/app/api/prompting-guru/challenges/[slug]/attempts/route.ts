import { toAttemptSummaryDto } from '@/features/practice/dto'
import { listAttemptsFor } from '@/features/practice/practice-repository'
import { slugSchema } from '@/features/practice/stored'
import { db } from '@/server/db/client'
import { failure, json, signedIn } from '@/server/http/json-route'

/**
 * GET /api/prompting-guru/challenges/:slug/attempts
 * The caller's own attempts at this challenge, newest first. Another user's
 * attempts are never included; for a challenge the caller has not tried, the
 * list is empty.
 */
export const GET = signedIn<{ params: Promise<{ slug: string }> }>(async ({ context, userId }) => {
	const slug = slugSchema.safeParse((await context.params).slug)
	if (!slug.success) return failure(404, 'That challenge could not be found.')
	const attempts = await listAttemptsFor({ db, userId, slug: slug.data })
	return json({ items: attempts.map(toAttemptSummaryDto) })
})
