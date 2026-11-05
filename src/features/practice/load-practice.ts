import 'server-only'
import { getAssessment } from '@/features/workspace/repository'
import { db } from '@/server/db/client'
import { listCatalog } from './challenge-repository'
import { listAttempts, type StoredAttempt } from './practice-repository'
import {
	buildPracticePlan,
	summarizePractice,
	type AssessedSkill,
	type PracticePlan,
	type PracticeSummary
} from './plan'
import type { CatalogEntry } from './types'

export interface PracticeContext {
	readonly assessmentId: string | null
	readonly assessed: readonly AssessedSkill[] | null
	readonly attempts: readonly StoredAttempt[]
	/** The active challenges, from the database. */
	readonly catalog: readonly CatalogEntry[]
	readonly plan: PracticePlan
	readonly summary: PracticeSummary
}

/**
 * Everything the Prompting Guru pages and the overview endpoint need, for the
 * signed-in user: their latest assessment's skill scores, their attempts and
 * the active challenge library, read once and in parallel, then the plan and
 * summary built from them.
 */
export async function loadPracticeContext(userId: string): Promise<PracticeContext> {
	const now = new Date()
	const [latest, attempts, catalog] = await Promise.all([
		getAssessment({ db, userId }),
		listAttempts({ db, userId }),
		listCatalog({ db })
	])
	const assessed =
		latest == null
			? null
			: latest.assessment.skills.map((skill) => ({ skill: skill.skill, score: skill.score }))
	return {
		assessmentId: latest?.id ?? null,
		assessed,
		attempts,
		catalog,
		plan: buildPracticePlan({ assessed, attempts, catalog, now }),
		summary: summarizePractice({ attempts, now })
	}
}
