import type { ParsedSession } from '@/features/sessions/types'
import { prepareSessions, type Interaction } from './interactions'
import { summarizeSkill } from './observation'
import { workflowProfile } from './profile'
import { recommendations } from './recommendations'
import {
	MIN_SKILLS_FOR_OVERALL,
	RUBRIC_VERSION,
	SKILL_IDS,
	proficiencyOf,
	type SkillId
} from './rubric'
import { evaluateClarity } from './skills/clarity'
import { evaluateIteration } from './skills/iteration'
import { evaluatePlanning } from './skills/planning'
import { evaluateScope } from './skills/scope'
import { evaluateVerification } from './skills/verification'
import type { Assessment, OverallAssessment, SkillAssessment } from './types'

const EVALUATORS = {
	promptClarity: evaluateClarity,
	planning: evaluatePlanning,
	verification: evaluateVerification,
	iteration: evaluateIteration,
	scopeControl: evaluateScope
} satisfies Record<SkillId, (sessions: readonly (readonly Interaction[])[]) => unknown>

const promptKey = (sessionId: string, promptNumber: number) => `${sessionId}\u0000${promptNumber}`

/**
 * Drops any quote that is not, character for character, the stated slice of a
 * prompt this upload contains. Nothing is shown that the user did not write.
 */
function keepTraceable({
	skill,
	sources
}: {
	skill: SkillAssessment
	sources: ReadonlyMap<string, string>
}): SkillAssessment {
	return {
		...skill,
		evidence: skill.evidence.filter((evidence) => {
			const source = sources.get(promptKey(evidence.sessionId, evidence.promptNumber))
			return (
				source != null &&
				evidence.excerpt.length > 0 &&
				source.slice(evidence.start, evidence.end) === evidence.excerpt
			)
		})
	}
}

/**
 * Equal-weighted mean of the scored skills, rounded. With fewer than
 * MIN_SKILLS_FOR_OVERALL scored there is no overall score: the skills that
 * could be scored are still shown on their own.
 */
export function aggregate(skills: readonly SkillAssessment[]): OverallAssessment {
	const scored = skills.flatMap((skill) =>
		skill.score == null ? [] : [{ skill: skill.skill, score: skill.score }]
	)
	const byScore = [...scored].sort(
		(a, b) => a.score - b.score || SKILL_IDS.indexOf(a.skill) - SKILL_IDS.indexOf(b.skill)
	)
	const hasOverall = scored.length >= MIN_SKILLS_FOR_OVERALL
	const score = hasOverall
		? Math.round(scored.reduce((total, each) => total + each.score, 0) / scored.length)
		: null
	const isComparable = scored.length >= 2
	return {
		score,
		proficiency: score == null ? null : proficiencyOf(score),
		skillsAssessed: scored.length,
		strongest: isComparable ? (byScore.at(-1)?.skill ?? null) : null,
		weakest: isComparable ? (byScore[0]?.skill ?? null) : null
	}
}

/** Scores parsed sessions against the rubric. Pure, synchronous and local. */
export function assessSessions(sessions: readonly ParsedSession[]): Assessment {
	const prepared = prepareSessions(sessions)
	const sources = new Map(
		prepared.sessions
			.flat()
			.map((interaction) => [
				promptKey(interaction.sessionId, interaction.promptNumber),
				interaction.text
			])
	)
	const skills = SKILL_IDS.map((skill) =>
		keepTraceable({
			skill: summarizeSkill({ skill, observations: EVALUATORS[skill](prepared.sessions) }),
			sources
		})
	)
	return {
		rubricVersion: RUBRIC_VERSION,
		sessionCount: sessions.length,
		promptCount: sources.size,
		redactions: prepared.redactions,
		overall: aggregate(skills),
		skills,
		profile: workflowProfile(skills),
		recommendations: recommendations(skills)
	}
}
