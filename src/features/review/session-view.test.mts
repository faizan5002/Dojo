import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { prepareSessions } from '@/features/assessment/interactions'
import { loadSample } from '@/features/sample/sample-session'
import { buildSessionView, pickSession, segmentPrompt } from './session-view'

describe('the conversation view of a session', () => {
	it('reads each prompt exactly as the assessment did', async () => {
		const { sessions } = await loadSample()
		const session = sessions[0]
		assert.ok(session)
		const view = buildSessionView(session, [])
		const read = prepareSessions([session]).sessions[0] ?? []
		const shown = view.turns.flatMap((turn) =>
			turn.promptNumber == null ? [] : [{ number: turn.promptNumber, text: turn.prompt }]
		)
		assert.deepEqual(
			shown,
			read.map((interaction) => ({ number: interaction.promptNumber, text: interaction.text }))
		)
	})

	it('keeps the conversation in order, with each reply beside its prompt', async () => {
		const { sessions } = await loadSample()
		const session = sessions[0]
		assert.ok(session)
		const view = buildSessionView(session, [])
		assert.equal(view.turns.length, session.turns.length)
		assert.ok(view.turns.every((turn) => turn.response != null))
		assert.deepEqual(
			view.turns.map((turn) => turn.promptNumber),
			view.turns.map((_, index) => index + 1)
		)
	})

	it('anchors every finding to the exact characters it quotes, and loses none', async () => {
		const { sessions, stored } = await loadSample()
		const session = sessions[0]
		assert.ok(session)
		const view = buildSessionView(session, stored.assessment.skills)
		const expected = stored.assessment.skills.flatMap((skill) => skill.evidence).length
		assert.equal(view.unmatched, 0)
		assert.equal(view.findings.length, expected)
		for (const finding of view.findings) {
			const turn = view.turns.find((item) => item.promptNumber === finding.promptNumber)
			assert.equal(turn?.prompt?.slice(finding.start, finding.end), finding.excerpt)
		}
	})

	it('orders findings as they are read, and ids are unique', async () => {
		const { sessions, stored } = await loadSample()
		const session = sessions[0]
		assert.ok(session)
		const { findings } = buildSessionView(session, stored.assessment.skills)
		for (let index = 1; index < findings.length; index++) {
			const previous = findings[index - 1]
			const current = findings[index]
			assert.ok(previous && current)
			assert.ok(
				previous.promptNumber < current.promptNumber ||
					(previous.promptNumber === current.promptNumber && previous.start <= current.start)
			)
		}
		assert.equal(new Set(findings.map((finding) => finding.id)).size, findings.length)
	})

	it('drops a quote that is not in the text instead of highlighting something else', async () => {
		const { sessions, stored } = await loadSample()
		const session = sessions[0]
		assert.ok(session)
		const tampered = stored.assessment.skills.map((skill) => ({
			...skill,
			evidence: skill.evidence.map((evidence) => ({ ...evidence, excerpt: `${evidence.excerpt}!` }))
		}))
		const view = buildSessionView(session, tampered)
		assert.equal(view.findings.length, 0)
		assert.ok(view.unmatched > 0)
	})

	it('ignores evidence that belongs to another session', async () => {
		const { sessions, stored } = await loadSample()
		const session = sessions[0]
		assert.ok(session)
		const other = { ...session, sessionId: 'someone-elses-session' }
		assert.equal(buildSessionView(other, stored.assessment.skills).findings.length, 0)
	})
})

describe('segmenting a prompt around findings', () => {
	const finding = (id: string, start: number, end: number) => ({
		id,
		skill: 'planning' as const,
		criterion: 'straightToBuild' as const,
		polarity: 'opportunity' as const,
		promptNumber: 1,
		start,
		end,
		excerpt: '',
		suggestion: null
	})

	it('joins back to the original text', () => {
		const text = 'Add a filter by category and a chart.'
		const segments = segmentPrompt(text, [finding('a', 4, 12), finding('b', 8, 20)])
		assert.equal(segments.map((segment) => segment.text).join(''), text)
	})

	it('marks overlapping quotes on the shared piece', () => {
		const segments = segmentPrompt('0123456789', [finding('a', 2, 6), finding('b', 4, 8)])
		const byText = Object.fromEntries(segments.map((segment) => [segment.text, segment.findingIds]))
		assert.deepEqual(byText['23'], ['a'])
		assert.deepEqual(byText['45'], ['a', 'b'])
		assert.deepEqual(byText['67'], ['b'])
		assert.deepEqual(byText['01'], [])
	})

	it('returns the whole text when there are no findings', () => {
		assert.deepEqual(segmentPrompt('hello', []), [{ text: 'hello', findingIds: [] }])
	})
})

describe('choosing the session to show', () => {
	it('opens the session that owns the requested finding', async () => {
		const { sessions, stored } = await loadSample()
		const evidence = stored.assessment.skills.flatMap((skill) => skill.evidence)[0]
		assert.ok(evidence)
		const picked = pickSession(sessions, stored.assessment.skills, { findingId: evidence.id })
		assert.equal(picked?.sessionId, evidence.sessionId)
	})

	it('returns nothing for a session that is not in the assessment', async () => {
		const { sessions, stored } = await loadSample()
		assert.equal(
			pickSession(sessions, stored.assessment.skills, { sessionId: 'not-a-session' }),
			null
		)
	})
})
