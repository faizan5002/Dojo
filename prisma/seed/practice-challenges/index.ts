import type { ChallengeDefinition } from '@/features/practice/types'
import { CLARITY_CHALLENGES } from './clarity'
import { CLARITY_EXPANSION } from './clarity-expansion'
import { ITERATION_CHALLENGES } from './iteration'
import { ITERATION_EXPANSION } from './iteration-expansion'
import { PLANNING_CHALLENGES } from './planning'
import { PLANNING_EXPANSION } from './planning-expansion'
import { SCOPE_CHALLENGES } from './scope'
import { SCOPE_EXPANSION } from './scope-expansion'
import { VERIFICATION_CHALLENGES } from './verification'
import { VERIFICATION_EXPANSION } from './verification-expansion'

// The seed content of the Prompting Guru library. The app never imports this:
// `scripts/seed-practice-challenges.mts` writes it to PostgreSQL, and the app
// reads challenges from there. Editing a challenge here means bumping its
// `version`; the seed refuses changed content under an unchanged version.

export const CHALLENGE_DEFINITIONS: readonly ChallengeDefinition[] = [
	...CLARITY_CHALLENGES,
	...CLARITY_EXPANSION,
	...PLANNING_CHALLENGES,
	...PLANNING_EXPANSION,
	...VERIFICATION_CHALLENGES,
	...VERIFICATION_EXPANSION,
	...ITERATION_CHALLENGES,
	...ITERATION_EXPANSION,
	...SCOPE_CHALLENGES,
	...SCOPE_EXPANSION
]
