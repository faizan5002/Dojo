import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { SKILL_IDS } from '@/features/assessment/rubric'
import { DEV_ASSESSMENTS, DEV_UPLOADS, devAssessment, devUploadView } from './fixtures'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('frontend development fixtures', () => {
	test('have stable, valid ids and fixed dates', () => {
		assert.deepEqual(
			DEV_UPLOADS.map((upload) => [upload.id, upload.createdAt.toISOString()]),
			[
				['00000000-0000-4000-8000-0000000d0003', '2026-10-29T16:30:00.000Z'],
				['00000000-0000-4000-8000-0000000d0002', '2026-10-20T14:10:00.000Z'],
				['00000000-0000-4000-8000-0000000d0001', '2026-10-12T10:00:00.000Z']
			]
		)
		for (const item of [...DEV_UPLOADS, ...DEV_ASSESSMENTS]) assert.match(item.id, UUID)
	})

	test('produce the same assessments every time', () => {
		const again = DEV_ASSESSMENTS.map((summary) => devAssessment(summary.id))
		assert.deepEqual(
			again.map((stored) => stored?.overallScore),
			DEV_ASSESSMENTS.map((summary) => summary.overallScore)
		)
		assert.deepEqual(
			JSON.stringify(devAssessment(DEV_ASSESSMENTS[0]?.id)),
			JSON.stringify(devAssessment(DEV_ASSESSMENTS[0]?.id))
		)
	})

	test('cover the screens: scored, newest first, with a spread of scores', () => {
		const times = DEV_ASSESSMENTS.map((a) => a.createdAt.getTime())
		assert.deepEqual(
			times,
			[...times].sort((a, b) => b - a)
		)
		const scores = DEV_ASSESSMENTS.map((a) => a.overallScore)
		for (const score of scores) assert.ok(score != null && score >= 0 && score <= 100)
		assert.ok(new Set(scores).size > 1, 'scores should differ so sorting is visible')
	})

	test('every assessment has the five skills with traceable evidence', () => {
		for (const summary of DEV_ASSESSMENTS) {
			const stored = devAssessment(summary.id)
			assert.ok(stored)
			assert.deepEqual(
				stored.assessment.skills.map((skill) => skill.skill),
				[...SKILL_IDS]
			)
			const evidence = stored.assessment.skills.flatMap((skill) => skill.evidence)
			assert.ok(evidence.length > 0)
			for (const item of evidence) {
				assert.ok(item.sessionId.startsWith('dev-'), 'evidence points at a fixture session')
				assert.ok(item.end > item.start)
			}
		}
	})

	test('upload views carry sessions, metrics and rejected files', () => {
		const latest = devUploadView(undefined)
		assert.ok(latest)
		assert.equal(latest.id, DEV_UPLOADS[0]?.id)
		assert.equal(latest.sessions.length, latest.sessionCount)
		assert.deepEqual(
			latest.rejected.map((file) => file.reason),
			['not-markdown', 'empty']
		)
		assert.equal(devUploadView('00000000-0000-4000-8000-000000000000'), null)
		assert.equal(devAssessment('00000000-0000-4000-8000-000000000000'), null)
	})
})
