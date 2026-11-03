import { toOverviewDto } from '@/features/practice/dto'
import { loadPracticeContext } from '@/features/practice/load-practice'
import { json, signedIn } from '@/server/http/json-route'

/**
 * GET /api/prompting-guru/overview
 * The caller's plan (mode, next challenge and why, focus skills, per-skill
 * shares and scores), due reviews, summary and recent attempts: the same data
 * the overview page renders, built by the same loader.
 */
export const GET = signedIn(async ({ userId }) =>
	json(toOverviewDto(await loadPracticeContext(userId)))
)
