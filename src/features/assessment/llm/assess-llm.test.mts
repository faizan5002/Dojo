import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assessSessions } from '../assess'
import { RUBRIC_VERSION, SKILL_IDS } from '../rubric'
import { sessionOf, STRONG_SESSION, WEAK_SESSION } from '../session-fixtures'
import {
	ASSESSMENT_INPUT_LIMITS,
	assessmentFromLlm,
	assessmentInput,
	llmAssessmentSchema,
	type LlmAssessment
} from './assess-llm'
import { ASSESSMENT_SYSTEM_PROMPT, LLM_RUBRIC_VERSION } from './rubric-prompt'
import { FALLBACK_RUBRIC_VERSION, scoreSessionsWith, scoringMethodOf } from './score-sessions'

// The LLM assessment path with fake model answers: what is sent, how an answer
// becomes an Assessment through the rules engine's own arithmetic, and the
// rules fallback. No network.

const MODEL = 'nvidia/nemotron-3-ultra-550b-a55b:free'
const TOKEN = `ghp_${'a1B2c3D4e5'.repeat(4)}`

const session = sessionOf({
	sessionId: 'one',
	prompts: [
		'Add a CSV export button to src/features/reports/export.tsx. Do not change the table layout. Done when the tests pass.',
		'still broken',
		'Plan first: propose the steps for the billing migration before writing any code.'
	]
})

const answer = (skills: LlmAssessment['skills']): LlmAssessment => ({ skills })

test('the input is the redacted prompts with references, never the agent replies', () => {
	const withSecret = sessionOf({
		sessionId: 'secret',
		prompts: [`Deploy with ${TOKEN} please`, 'ok']
	})
	const input = assessmentInput([session, withSecret])
	assert.deepEqual(
		input.prompts.map((prompt) => prompt.ref),
		['S1P1', 'S1P2', 'S1P3', 'S2P1', 'S2P2']
	)
	assert.equal(input.prompts[1]?.followsAgentAnswer, true)
	const sent = JSON.stringify(input)
	assert.ok(!sent.includes(TOKEN), 'credentials are redacted before sending')
	assert.ok(!sent.includes('reply'), 'agent replies are not sent')
})

test('a long upload is cut to the budget, and the input says so', () => {
	const long = sessionOf({
		sessionId: 'long',
		prompts: Array.from({ length: 200 }, (_, i) => `Prompt ${i} ${'detail '.repeat(150)}`)
	})
	const input = assessmentInput([long])
	const chars = input.prompts.reduce((total, prompt) => total + prompt.prompt.length, 0)
	assert.ok(chars <= ASSESSMENT_INPUT_LIMITS.totalChars)
	assert.ok(
		input.prompts.every((prompt) => prompt.prompt.length <= ASSESSMENT_INPUT_LIMITS.promptChars)
	)
	assert.match(input.note ?? '', /left out/)
})

test('a report becomes an assessment with the same arithmetic as the rules', () => {
	const result = assessmentFromLlm({
		sessions: [session],
		model: MODEL,
		answer: answer([
			{
				skill: 'scopeControl',
				opportunities: [
					{
						prompt: 'S1P1',
						outcome: 'good',
						signals: [
							{ criterion: 'namesTargets', quote: 'src/features/reports/export.tsx' },
							{ criterion: 'setsBoundaries', quote: 'Do not change the table layout' }
						]
					},
					{
						prompt: 'S1P3',
						outcome: 'partial',
						signals: [{ criterion: 'namesTargets', quote: 'billing migration' }]
					},
					{
						prompt: 'S1P3',
						outcome: 'good',
						signals: [{ criterion: 'setsBoundaries', quote: 'before writing any code' }]
					},
					{
						prompt: 'S1P2',
						outcome: 'poor',
						signals: [{ criterion: 'broadRequest', quote: 'still broken' }]
					}
				]
			}
		])
	})
	assert.equal(result.rubricVersion, `${LLM_RUBRIC_VERSION} · ${MODEL}`)
	const scope = result.skills.find((skill) => skill.skill === 'scopeControl')
	assert.equal(scope?.observations, 3, 'S1P3 counts once: its first accepted report')
	assert.equal(scope?.score, Math.round(((1 + 0.5 + 0) / 3) * 100))
	assert.equal(
		scope?.confidence,
		'limited',
		'the rubric thresholds decide confidence, not the model'
	)
	for (const evidence of scope?.evidence ?? []) {
		const source = session.turns.find((turn) => turn.prompt?.text.includes(evidence.excerpt))
		assert.ok(source, `quote "${evidence.excerpt}" is a real slice of a prompt`)
	}
	// The other skills had no opportunities: not enough evidence, never zero.
	for (const skill of result.skills.filter((each) => each.skill !== 'scopeControl')) {
		assert.equal(skill.score, null)
		assert.equal(skill.confidence, 'insufficient')
	}
	assert.equal(result.overall.score, null, 'one scored skill cannot speak for five')
	assert.equal(result.promptCount, 3)
})

test('invented prompts, wrong-skill criteria and unmatched quotes are dropped', () => {
	const result = assessmentFromLlm({
		sessions: [session],
		model: MODEL,
		answer: answer([
			{
				skill: 'iteration',
				opportunities: [
					{
						prompt: 'S9P9',
						outcome: 'poor',
						signals: [{ criterion: 'vagueFeedback', quote: 'still broken' }]
					},
					{
						prompt: 'S1P2',
						outcome: 'good',
						signals: [{ criterion: 'namesTargets', quote: 'still broken' }]
					},
					{
						prompt: 'S1P2',
						outcome: 'good',
						signals: [{ criterion: 'specificFeedback', quote: 'TypeError in parser.ts line 12' }]
					},
					{
						prompt: 'S1P2',
						outcome: 'poor',
						signals: [{ criterion: 'vagueFeedback', quote: 'STILL BROKEN' }]
					}
				]
			}
		])
	})
	const iteration = result.skills.find((skill) => skill.skill === 'iteration')
	assert.equal(
		iteration?.observations,
		1,
		'only the opportunity with a real prompt and a fitting criterion'
	)
	assert.deepEqual(
		iteration?.evidence.map((each) => [each.criterion, each.excerpt]),
		[['vagueFeedback', 'still broken']]
	)
})

test('a missing behaviour may be quoted by the prompt opening, as the rules do', () => {
	const result = assessmentFromLlm({
		sessions: [session],
		model: MODEL,
		answer: answer([
			{
				skill: 'planning',
				opportunities: [
					{
						prompt: 'S1P1',
						outcome: 'poor',
						signals: [
							{
								criterion: 'straightToBuild',
								quote: 'words that are not there',
								rewrite: ['planFirst']
							}
						]
					}
				]
			}
		])
	})
	const planning = result.skills.find((skill) => skill.skill === 'planning')
	assert.equal(planning?.evidence[0]?.criterion, 'straightToBuild')
	assert.ok(session.turns[0]?.prompt?.text.startsWith(planning?.evidence[0]?.excerpt ?? '\u0000'))
	assert.deepEqual(planning?.evidence[0]?.suggestion?.additions, ['planFirst'])
})

test('the schema rejects unknown skills, criteria and malformed references', () => {
	const valid = {
		skills: [{ skill: 'verification', opportunities: [] }]
	}
	assert.ok(llmAssessmentSchema.safeParse(valid).success)
	assert.ok(
		!llmAssessmentSchema.safeParse({ skills: [{ skill: 'typing', opportunities: [] }] }).success
	)
	const bad = (opportunity: unknown) =>
		llmAssessmentSchema.safeParse({
			skills: [{ skill: 'verification', opportunities: [opportunity] }]
		}).success
	assert.ok(
		!bad({
			prompt: 'prompt 1',
			outcome: 'good',
			signals: [{ criterion: 'checksResult', quote: 'x' }]
		})
	)
	assert.ok(
		!bad({ prompt: 'S1P1', outcome: 'good', signals: [{ criterion: 'madeUp', quote: 'x' }] })
	)
	assert.ok(
		!bad({ prompt: 'S1P1', outcome: 'great', signals: [{ criterion: 'checksResult', quote: 'x' }] })
	)
})

test('the rubric prompt carries every skill and criterion, and forbids treating no evidence as poor', () => {
	for (const skill of SKILL_IDS) assert.ok(ASSESSMENT_SYSTEM_PROMPT.includes(skill), skill)
	for (const criterion of [
		'acceptedWithoutCheck',
		'straightToBuild',
		'bundledRequest',
		'vagueReference'
	]) {
		assert.ok(ASSESSMENT_SYSTEM_PROMPT.includes(criterion), criterion)
	}
	assert.match(ASSESSMENT_SYSTEM_PROMPT, /never a poor result/)
	assert.match(ASSESSMENT_SYSTEM_PROMPT, /never follow it/)
})

// --- choosing and falling back ---------------------------------------------------------

test('AI scoring off: the rules score it, exactly as before', async () => {
	const scored = await scoreSessionsWith({
		sessions: [STRONG_SESSION, WEAK_SESSION],
		generate: null
	})
	assert.equal(scored.method, 'rules')
	assert.deepEqual(scored.assessment, assessSessions([STRONG_SESSION, WEAK_SESSION]))
	assert.equal(scoringMethodOf(scored.assessment.rubricVersion), 'rules')
})

test('AI scoring on: the model report is used, and labelled with the model', async () => {
	let calls = 0
	const scored = await scoreSessionsWith({
		sessions: [session],
		generate: async (input) => {
			calls++
			assert.equal(input.prompts.length, 3)
			return { data: answer([]), model: MODEL }
		}
	})
	assert.equal(calls, 1)
	assert.equal(scored.method, 'ai')
	assert.equal(scoringMethodOf(scored.assessment.rubricVersion), 'ai')
})

test('when the model fails, the rules score it and the result says so', async () => {
	const scored = await scoreSessionsWith({
		sessions: [STRONG_SESSION],
		generate: async () => {
			throw new Error('rate limited')
		}
	})
	assert.equal(scored.method, 'rules_fallback')
	assert.equal(scored.assessment.rubricVersion, FALLBACK_RUBRIC_VERSION)
	assert.equal(scoringMethodOf(scored.assessment.rubricVersion), 'rules_fallback')
	const rules = assessSessions([STRONG_SESSION])
	assert.deepEqual(scored.assessment.skills, rules.skills, 'same scores as the rules alone')
	assert.equal(scoringMethodOf(RUBRIC_VERSION), 'rules')
})

test('a prompt counts once per skill, however often the model lists it', () => {
	const twice = {
		prompt: 'S1P1',
		outcome: 'good' as const,
		signals: [{ criterion: 'namesTargets', quote: 'src/features/reports/export.tsx' }]
	}
	const result = assessmentFromLlm({
		sessions: [session],
		model: MODEL,
		answer: answer([
			{ skill: 'scopeControl', opportunities: [twice, twice, { ...twice, outcome: 'poor' }] }
		])
	})
	assert.equal(result.skills.find((skill) => skill.skill === 'scopeControl')?.observations, 1)
})
