import { renderToBuffer } from '@react-pdf/renderer'
import { scoringMethodOf, type ScoringMethod } from '../llm/score-sessions'
import type { StoredAssessment } from '@/features/workspace/repository'
import { ReportDocument, type ReportLabels } from './report-document'
import { buildReportModel, type Translate } from './report-model'

const METHODOLOGY = {
	ai: 'Report.methodologyBodyAi',
	rules: 'Report.methodologyBody',
	rules_fallback: 'Report.methodologyBodyFallback'
} as const

export function reportLabels(t: Translate, method: ScoringMethod = 'rules'): ReportLabels {
	const section = (key: string) => t(`Report.sections.${key}`)
	return {
		title: t('Report.title'),
		subtitle: t('Report.subtitle'),
		headerTitle: t('Report.headerTitle'),
		preparedFor: t('Report.preparedFor'),
		assessedOn: t('Report.assessedOn'),
		reference: t('Report.reference'),
		outOf: t('Assessment.overall.outOf'),
		summary: t('Assessment.overall.summary'),
		habits: t('Assessment.overall.summary'),
		sections: {
			overview: section('overview'),
			skills: section('skills'),
			evidence: section('evidence'),
			profile: section('profile'),
			recommendations: section('recommendations'),
			metrics: section('metrics'),
			about: section('about')
		},
		lookFor: t('Assessment.breakdown.lookFor'),
		seen: t('Assessment.breakdown.seen'),
		missing: t('Assessment.breakdown.missed'),
		yourPrompt: t('Report.yourPrompt'),
		dojoReads: t('Report.dojoReads'),
		shows: t('Assessment.evidence.shows'),
		why: t('Assessment.evidence.why'),
		better: t('Assessment.evidence.better'),
		suggestion: t('Report.suggestion'),
		suggestionNote: t('Assessment.evidence.suggestionNote'),
		noEvidence: t('Assessment.breakdown.noEvidence'),
		strengths: t('Assessment.profile.strengths'),
		risks: t('Assessment.profile.risks'),
		none: t('Assessment.profile.none'),
		noRecommendations: t('Assessment.recommendations.none'),
		problem: t('Assessment.recommendations.problem'),
		matters: t('Assessment.recommendations.matters'),
		practice: t('Assessment.recommendations.practice'),
		fromSession: t('Assessment.recommendations.evidence'),
		metricsNote: t('Report.metrics.note'),
		noMetrics: t('Report.metrics.none'),
		rubricVersion: t('Report.rubricVersion'),
		methodology: t('Report.methodology'),
		methodologyBody: t(METHODOLOGY[method]),
		disclaimer: t('Report.disclaimer'),
		footer: t('Report.footer'),
		page: (page, total) => t('Report.page', { page, total })
	}
}

/**
 * The PDF of one saved assessment, in memory: no temporary file is written.
 * The caller has already checked that the assessment belongs to the user.
 */
export async function renderReportPdf({
	stored,
	preparedFor,
	t
}: {
	stored: StoredAssessment
	preparedFor: string | null
	t: Translate
}): Promise<{ readonly pdf: Buffer; readonly filename: string }> {
	const model = buildReportModel({ stored, preparedFor, t })
	const method = scoringMethodOf(stored.assessment.rubricVersion)
	const pdf = await renderToBuffer(ReportDocument({ model, labels: reportLabels(t, method) }))
	return { pdf, filename: model.filename }
}
