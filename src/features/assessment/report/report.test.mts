import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join, sep } from 'node:path'
import { createTranslator } from 'next-intl'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { assessSessions } from '../assess'
import { RUBRIC_VERSION } from '../rubric'
import { STRONG_SESSION, WEAK_SESSION, sessionOf } from '../session-fixtures'
import { metricsOverview } from '@/features/sessions/metrics'
import type { ParsedSession } from '@/features/sessions/types'
import type { StoredAssessment } from '@/features/workspace/repository'
import { buildReportModel, reportFilename, type Translate } from './report-model'
import { renderReportPdf } from './render-report'

const messages = JSON.parse(readFileSync('messages/en.json', 'utf8'))
const translator = createTranslator({ locale: 'en', messages })
const t: Translate = (key, values) => translator(key, values)
const A4_WIDTH = 595.28
const EDGE_TOLERANCE = 1
// pdf.js reads the PDF standard fonts (Helvetica) from here when extracting text.
const STANDARD_FONTS = `${join(process.cwd(), 'node_modules', 'pdfjs-dist', 'standard_fonts').replaceAll(sep, '/')}/`
const TOKEN = `ghp_${'a1B2c3D4e5'.repeat(4)}`

/** What the repository hands back for a saved assessment of these sessions. */
function stored(
	sessions: readonly ParsedSession[],
	createdAt = new Date('2026-11-02T14:41:00Z')
): StoredAssessment {
	const assessment = assessSessions(sessions)
	return {
		id: randomUUID(),
		uploadId: randomUUID(),
		createdAt,
		overallScore: assessment.overall.score,
		rubricVersion: assessment.rubricVersion,
		overview: metricsOverview(sessions),
		assessment
	}
}

async function pdfText(pdf: Buffer): Promise<{ pages: number; text: string; overflow: string[] }> {
	const document = await getDocument({
		data: new Uint8Array(pdf),
		standardFontDataUrl: STANDARD_FONTS
	}).promise
	const parts: string[] = []
	const overflow: string[] = []
	for (let number = 1; number <= document.numPages; number++) {
		const page = await document.getPage(number)
		for (const item of (await page.getTextContent()).items) {
			if (!('str' in item)) continue
			parts.push(item.str)
			const x = item.transform[4] ?? 0
			if (item.str.trim() !== '' && x + item.width > A4_WIDTH + EDGE_TOLERANCE)
				overflow.push(item.str)
		}
	}
	return { pages: document.numPages, text: parts.join(' ').replace(/\s+/g, ' '), overflow }
}

test('the report model carries the saved scores, skills and rubric version unchanged', () => {
	const saved = stored([STRONG_SESSION, WEAK_SESSION])
	const model = buildReportModel({ stored: saved, preparedFor: 'Ada', t })
	assert.equal(model.overview.score, saved.assessment.overall.score)
	assert.deepEqual(
		model.skills.map((skill) => skill.score),
		saved.assessment.skills.map((skill) => skill.score)
	)
	assert.deepEqual(
		model.skills.map((skill) => skill.name),
		[
			'Prompt clarity',
			'Planning before coding',
			'Verifying AI output',
			'Iteration quality',
			'Scope control'
		]
	)
	assert.equal(model.about.rubricVersion, RUBRIC_VERSION)
	assert.equal(model.recommendations.length, saved.assessment.recommendations.length)
})

test('every quote is the stored excerpt, character for character', () => {
	const saved = stored([STRONG_SESSION, WEAK_SESSION])
	const model = buildReportModel({ stored: saved, preparedFor: null, t })
	assert.deepEqual(
		model.skills.flatMap((skill) => skill.evidence.map((item) => item.quote.text)),
		saved.assessment.skills.flatMap((skill) => skill.evidence.map((item) => item.excerpt))
	)
})

test('a skill without enough evidence says so instead of showing a score', () => {
	const model = buildReportModel({ stored: stored([WEAK_SESSION]), preparedFor: null, t })
	const planning = model.skills.find((skill) => skill.name === 'Planning before coding')
	assert.equal(planning?.score, null)
	assert.equal(planning?.confidenceLabel, 'Insufficient evidence')
	assert.equal(
		planning?.confidenceDetail,
		'Not enough evidence in this upload to assess this skill confidently.'
	)
})

test('the metrics are those of the assessed upload, labelled as context', () => {
	const saved = stored([STRONG_SESSION])
	const model = buildReportModel({ stored: saved, preparedFor: null, t })
	const prompts = model.metrics?.find((fact) => fact.label === 'Prompts')
	assert.equal(prompts?.value, String(saved.overview?.promptCount))
	const without = buildReportModel({ stored: { ...saved, overview: null }, preparedFor: null, t })
	assert.equal(without.metrics, null)
})

test('an older assessment reports its own data, whatever came after it', () => {
	const older = stored([WEAK_SESSION], new Date('2026-10-01T09:00:00Z'))
	const newer = stored([STRONG_SESSION, WEAK_SESSION], new Date('2026-11-02T09:00:00Z'))
	const olderModel = buildReportModel({ stored: older, preparedFor: null, t })
	assert.equal(olderModel.overview.score, older.assessment.overall.score)
	assert.notEqual(olderModel.overview.score, newer.assessment.overall.score)
	assert.equal(olderModel.assessedOn, '1 October 2026 at 09:00')
	assert.match(olderModel.filename, /^dojo-assessment-2026-10-01-[0-9a-f]{8}\.pdf$/)
})

test('same-day reports get different filenames', () => {
	const createdAt = new Date('2026-11-02T10:00:00Z')
	assert.notEqual(
		reportFilename({ id: randomUUID(), createdAt }),
		reportFilename({ id: randomUUID(), createdAt })
	)
})

test('the PDF is a multi-page, numbered report with every section and the exact score', async () => {
	const saved = stored([STRONG_SESSION, WEAK_SESSION])
	const { pdf, filename } = await renderReportPdf({ stored: saved, preparedFor: 'Ada', t })
	assert.equal(pdf.subarray(0, 5).toString(), '%PDF-')
	assert.match(filename, /^dojo-assessment-2026-11-02-/)
	const { pages, text } = await pdfText(pdf)
	assert.ok(pages > 1, `expected several pages, got ${pages}`)
	assert.ok(text.includes(`Page 1 of ${pages}`) && text.includes(`Page ${pages} of ${pages}`))
	assert.ok(text.includes(String(saved.assessment.overall.score)))
	for (const heading of [
		'Assessment overview',
		'Five-skill breakdown',
		'Evidence and evaluation',
		'Workflow profile',
		'Improvement recommendations',
		'Free metrics context',
		'Assessment information',
		'Prompt clarity',
		'Scope control',
		RUBRIC_VERSION,
		'Ada'
	]) {
		assert.ok(text.toLowerCase().includes(heading.toLowerCase()), `missing: ${heading}`)
	}
	assert.ok(text.includes('fix it'), 'a short stored excerpt appears in the PDF')
})

test('the PDF never contains a redacted secret, only its marker', async () => {
	const saved = stored([
		sessionOf({
			sessionId: 'secret',
			prompts: [
				`Fix the deploy in scripts/deploy.sh, it uses ${TOKEN}.`,
				`Fix the deploy in scripts/deploy.sh, it uses ${TOKEN}.`,
				`Fix the deploy in scripts/deploy.sh, it uses ${TOKEN}.`
			]
		})
	])
	const { text } = await pdfText(
		(await renderReportPdf({ stored: saved, preparedFor: null, t })).pdf
	)
	assert.ok(!text.includes(TOKEN))
	assert.ok(text.includes('[REDACTED:github-token]'))
})

test('long excerpts wrap inside the page instead of running off it', async () => {
	const longPath = `src/${'deeply-nested-folder/'.repeat(8)}component-with-a-long-name.tsx`
	const long = `Refactor ${longPath} so the loader in ${longPath} handles empty states, retries and timeouts without changing the public API that other modules depend on.`
	const saved = stored([
		sessionOf({ sessionId: 'long', prompts: [long, long, long, 'fix it', 'still broken'] })
	])
	const { overflow, pages } = await pdfText(
		(await renderReportPdf({ stored: saved, preparedFor: null, t })).pdf
	)
	assert.ok(pages >= 1)
	assert.deepEqual(overflow, [], 'text ran past the right edge')
})
