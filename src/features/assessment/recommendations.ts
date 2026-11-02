import { MAX_RECOMMENDATIONS, RECOMMEND_BELOW } from './rubric'
import type { Recommendation, SkillAssessment } from './types'

/**
 * For the weakest reliably scored skills, the gap seen most often, with a
 * quote of it. A skill without a quotable gap gets no recommendation.
 */
export function recommendations(skills: readonly SkillAssessment[]): Recommendation[] {
	return skills
		.filter(
			(skill) =>
				skill.score != null && skill.confidence !== 'insufficient' && skill.score < RECOMMEND_BELOW
		)
		.sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
		.flatMap((skill) => {
			for (const tally of skill.tallies) {
				if (tally.polarity !== 'opportunity') continue
				const evidence = skill.evidence.find(
					(each) => each.polarity === 'opportunity' && each.criterion === tally.criterion
				)
				if (evidence != null) {
					return [
						{
							skill: skill.skill,
							criterion: tally.criterion,
							count: Math.min(tally.count, skill.observations),
							total: skill.observations,
							evidenceId: evidence.id
						}
					]
				}
			}
			return []
		})
		.slice(0, MAX_RECOMMENDATIONS)
}
