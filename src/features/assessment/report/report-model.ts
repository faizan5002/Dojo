import { CRITERIA, MIN_SKILLS_FOR_OVERALL } from '../rubric'
import type { Evidence, Suggestion } from '../types'
import type { MetricsOverview } from '@/features/sessions/metrics'
import type { StoredAssessment } from '@/features/workspace/repository'

// Everything the PDF report says, built from one saved assessment and the
// app's own copy. Nothing is scored or recomputed here: every number, quote
// and label comes from the stored assessment, so an old report stays exactly
// what that assessment was. The layout lives in report-document.ts.

/** A translator over the whole message catalog, as next-intl returns it. */
export type Translate = (key: string, values?: Record<string, string | number>) => string

export interface Fact {
	readonly label: string
	readonly value: string
}

export interface Quote {
	/** Exactly the stored excerpt; clipping is shown separately, never written into it. */
	readonly text: string
	readonly clippedBefore: boolean
	readonly clippedAfter: boolean
	readonly location: string
}

export interface ReportSuggestion {
	readonly base: string
	readonly lines: readonly string[]
}

export interface EvidenceItem {
	readonly quote: Quote
	readonly isStrength: boolean
	readonly shows: string
	readonly why: string
	readonly better: string | null
	readonly suggestion: ReportSuggestion | null
}

export interface SkillSection {
	readonly name: string
	readonly score: number | null
	readonly proficiency: string | null
	readonly confidenceLabel: string
	readonly confidenceDetail: string
	readonly summary: string
	readonly lookFor: string
	readonly seen: readonly Fact[]
	readonly missing: readonly Fact[]
	readonly evidence: readonly EvidenceItem[]
}

export interface PatternItem {
	readonly name: string
	readonly detail: string
	readonly quote: Quote | null
}

export interface RecommendationItem {
	readonly skillName: string
	readonly title: string
	readonly observed: string
	readonly problem: string
	readonly matters: string
	readonly practice: string
	readonly quote: Quote | null
	readonly suggestion: ReportSuggestion | null
}

export interface ReportModel {
	readonly filename: string
	readonly reference: string
	readonly assessedOn: string
	readonly preparedFor: string | null
	readonly overview: {
		readonly score: number | null
		readonly proficiency: string | null
		readonly noScore: string | null
		readonly summary: string
		readonly facts: readonly Fact[]
		readonly habits: readonly string[]
	}
	readonly skills: readonly SkillSection[]
	readonly profile: {
		readonly strengths: readonly PatternItem[]
		readonly risks: readonly PatternItem[]
	}
	readonly recommendations: readonly RecommendationItem[]
	readonly metrics: readonly Fact[] | null
	readonly about: {
		readonly rubricVersion: string
		readonly redactions: string
	}
}

const SHORT_SESSION_ID = 8
const SHORT_REFERENCE = 8
const ONE_DECIMAL = { maximumFractionDigits: 1 }
const TWO_DECIMALS = { maximumFractionDigits: 2 }
const WHOLE_PERCENT = { style: 'percent', maximumFractionDigits: 0 } as const

/** dojo-assessment-YYYY-MM-DD-<reference>.pdf: the reference keeps same-day reports apart. */
export function reportFilename({ id, createdAt }: { id: string; createdAt: Date }): string {
	return `dojo-assessment-${createdAt.toISOString().slice(0, 10)}-${id.slice(0, SHORT_REFERENCE)}.pdf`
}

function formatNumber(value: number, options: Intl.NumberFormatOptions): string {
	return new Intl.NumberFormat('en', options).format(value)
}

export function buildReportModel({
	stored,
	preparedFor,
	t
}: {
	stored: StoredAssessment
	preparedFor: string | null
	t: Translate
}): ReportModel {
	const { assessment } = stored
	const skillName = (skill: string) => t(`Assessment.skills.${skill}.name`)
	const notAvailable = t('Sessions.notAvailable')
	const evidenceById = new Map(
		assessment.skills.flatMap((skill) => skill.evidence.map((item) => [item.id, item] as const))
	)

	const quoteOf = (evidence: Evidence): Quote => ({
		text: evidence.excerpt,
		clippedBefore: evidence.clippedBefore,
		clippedAfter: evidence.clippedAfter,
		location: t('Assessment.evidence.location', {
			session: evidence.sessionId.slice(0, SHORT_SESSION_ID),
			number: evidence.promptNumber
		})
	})
	const suggestionOf = (suggestion: Suggestion | null): ReportSuggestion | null =>
		suggestion == null
			? null
			: {
					base: suggestion.base,
					lines: suggestion.additions.map((line) => t(`Assessment.rewrite.${line}`))
				}

	const { overall } = assessment
	const strongest = overall.strongest == null ? null : skillName(overall.strongest)
	const weakest = overall.weakest == null ? null : skillName(overall.weakest)
	const proficiency =
		overall.proficiency == null ? null : t(`Assessment.proficiency.${overall.proficiency}`)

	const skills = assessment.skills.map((skill): SkillSection => {
		const unit = t(`Assessment.skills.${skill.skill}.unit`, { count: skill.observations })
		const tallies = (polarity: 'strength' | 'opportunity') =>
			skill.tallies
				.filter((tally) => tally.polarity === polarity)
				.map((tally) => ({
					label: t(`Assessment.criteria.${tally.criterion}.label`),
					value: String(tally.count)
				}))
		return {
			name: skillName(skill.skill),
			score: skill.score,
			proficiency:
				skill.proficiency == null ? null : t(`Assessment.proficiency.${skill.proficiency}`),
			confidenceLabel: t(`Assessment.confidence.${skill.confidence}.label`),
			confidenceDetail: t(`Assessment.confidence.${skill.confidence}.detail`, {
				count: skill.observations,
				unit
			}),
			summary: t(`Assessment.skills.${skill.skill}.summary`),
			lookFor: CRITERIA[skill.skill].strength
				.map((criterion) => t(`Assessment.criteria.${criterion}.label`))
				.join(', '),
			seen: tallies('strength'),
			missing: tallies('opportunity'),
			evidence: skill.evidence.map((item) => {
				const isStrength = item.polarity === 'strength'
				const criterion = `Assessment.criteria.${item.criterion}`
				return {
					quote: quoteOf(item),
					isStrength,
					shows: t(`${criterion}.${isStrength ? 'shows' : 'missing'}`),
					why: t(`${criterion}.why`),
					better: isStrength ? null : t(`${criterion}.practice`),
					suggestion: suggestionOf(item.suggestion)
				}
			})
		}
	})

	const patterns = (kind: 'strength' | 'opportunity'): PatternItem[] =>
		assessment.profile
			.filter((pattern) => pattern.kind === kind)
			.map((pattern) => {
				const evidence = evidenceById.get(pattern.evidenceIds[0] ?? '')
				return {
					name: t(`Assessment.profile.patterns.${pattern.id}.name`),
					detail: t(`Assessment.profile.patterns.${pattern.id}.detail`, {
						count: pattern.count,
						total: pattern.total
					}),
					quote: evidence == null ? null : quoteOf(evidence)
				}
			})

	const recommendations = assessment.recommendations.map((recommendation): RecommendationItem => {
		const evidence = evidenceById.get(recommendation.evidenceId)
		const criterion = `Assessment.criteria.${recommendation.criterion}`
		return {
			skillName: skillName(recommendation.skill),
			title: t(`${criterion}.label`),
			observed: t('Assessment.recommendations.observed', {
				count: recommendation.count,
				total: recommendation.total,
				unit: t(`Assessment.skills.${recommendation.skill}.unit`, { count: recommendation.total })
			}),
			problem: t(`${criterion}.missing`),
			matters: t(`${criterion}.why`),
			practice: t(`${criterion}.practice`),
			quote: evidence == null ? null : quoteOf(evidence),
			suggestion: evidence == null ? null : suggestionOf(evidence.suggestion)
		}
	})

	return {
		filename: reportFilename(stored),
		reference: stored.id,
		assessedOn: new Intl.DateTimeFormat('en-GB', {
			dateStyle: 'long',
			timeStyle: 'short',
			timeZone: 'UTC'
		}).format(stored.createdAt),
		preparedFor,
		overview: {
			score: overall.score,
			proficiency,
			noScore:
				overall.score == null
					? t('Assessment.overall.noScoreDetail', {
							min: MIN_SKILLS_FOR_OVERALL,
							count: overall.skillsAssessed
						})
					: null,
			summary:
				proficiency == null
					? t('Report.summaryNoScore', { count: overall.skillsAssessed })
					: t('Report.summary', {
							proficiency,
							count: overall.skillsAssessed,
							strongest: strongest ?? notAvailable,
							weakest: weakest ?? notAvailable
						}),
			facts: [
				{ label: t('Assessment.overall.sessions'), value: String(assessment.sessionCount) },
				{ label: t('Assessment.overall.prompts'), value: String(assessment.promptCount) },
				{
					label: t('Assessment.overall.coverage'),
					value: t('Assessment.overall.coverageValue', { count: overall.skillsAssessed })
				},
				{
					label: t('Assessment.overall.strongest'),
					value: strongest ?? t('Assessment.overall.notComparable')
				},
				{
					label: t('Assessment.overall.weakest'),
					value: weakest ?? t('Assessment.overall.notComparable')
				}
			],
			habits: assessment.profile.map((pattern) =>
				t(`Assessment.profile.patterns.${pattern.id}.name`)
			)
		},
		skills,
		profile: { strengths: patterns('strength'), risks: patterns('opportunity') },
		recommendations,
		metrics:
			stored.overview == null ? null : metricFacts({ overview: stored.overview, t, notAvailable }),
		about: {
			rubricVersion: assessment.rubricVersion,
			redactions: t('Assessment.overall.redactions', { count: assessment.redactions })
		}
	}
}

function metricFacts({
	overview,
	t,
	notAvailable
}: {
	overview: MetricsOverview
	t: Translate
	notAvailable: string
}): Fact[] {
	const show = (value: number | null, options: Intl.NumberFormatOptions) =>
		value == null ? notAvailable : formatNumber(value, options)
	return [
		{ label: t('Sessions.overview.sessions'), value: String(overview.sessionCount) },
		{ label: t('Sessions.overview.prompts'), value: String(overview.promptCount) },
		{
			label: t('Sessions.overview.averagePromptWords'),
			value:
				overview.averagePromptWords == null
					? notAvailable
					: t('Sessions.units.words', { value: show(overview.averagePromptWords, ONE_DECIMAL) })
		},
		{ label: t('Sessions.overview.pasteRatio'), value: show(overview.pasteRatio, WHOLE_PERCENT) },
		{
			label: t('Sessions.overview.promptToResponseRatio'),
			value: show(overview.promptToResponseRatio, TWO_DECIMALS)
		},
		{
			label: t('Sessions.overview.averageGap'),
			value:
				overview.averageGapMinutes == null
					? notAvailable
					: t('Sessions.units.minutes', { value: show(overview.averageGapMinutes, ONE_DECIMAL) })
		},
		{
			label: t('Report.metrics.perPrompt'),
			value: [
				t('Sessions.overview.codeBlocks', {
					count: show(overview.codeBlocksPerPrompt, ONE_DECIMAL)
				}),
				t('Sessions.overview.filePaths', { count: show(overview.filePathsPerPrompt, ONE_DECIMAL) }),
				t('Sessions.overview.urls', { count: show(overview.urlsPerPrompt, ONE_DECIMAL) })
			].join(' · ')
		}
	]
}
