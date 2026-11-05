import { listChallenges } from '@/features/practice/challenge-repository'
import { toSummaryDto } from '@/features/practice/dto'
import { bestScores } from '@/features/practice/practice-repository'
import { challengeQuerySchema } from '@/features/practice/stored'
import { db } from '@/server/db/client'
import { failure, json, signedIn } from '@/server/http/json-route'

/**
 * GET /api/prompting-guru/challenges?skill&difficulty&type&search&page&pageSize
 * A page of the active library, read from PostgreSQL, with the caller's own
 * best score on each. Retired challenges, criteria and strong answers are
 * never in it. An unknown filter value is a 400 rather than silently ignored.
 */
export const GET = signedIn(async ({ request, userId }) => {
	const params = Object.fromEntries(new URL(request.url).searchParams)
	const query = challengeQuerySchema.safeParse(params)
	if (!query.success) return failure(400, 'Those filters are not valid.')
	const { page, pageSize, ...filters } = query.data
	const result = await listChallenges({ db, filters, page, pageSize })
	const best = await bestScores({
		db,
		userId,
		slugs: result.items.map((item) => item.slug)
	})
	return json({
		items: result.items.map((item) => ({
			...toSummaryDto(item),
			bestScore: best.get(item.slug) ?? null
		})),
		total: result.total,
		page: result.page,
		pageSize: result.pageSize,
		pageCount: Math.max(1, Math.ceil(result.total / result.pageSize))
	})
})
