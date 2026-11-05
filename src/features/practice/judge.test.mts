import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CHALLENGE_DEFINITIONS } from '../../../prisma/seed/practice-challenges/index'
import { evaluateWithRules } from './evaluate'
import { FALLBACK_EVALUATOR_ID, judgedBy, llmEvaluator } from './judge'
import {
	LLM_EVALUATOR_VERSION,
	evaluationFromLlm,
	practiceJudgingInput,
	type LlmJudgement
} from './llm-evaluate'
import type { ChallengeDefinition } from './types'

// The Prompting Guru LLM judge with fake model answers: what is sent, how a
// judgement is scored with the rules' own arithmetic, and the fallback.

const login = (() => {
	const found = CHALLENGE_DEFINITIONS.find((each) => each.slug === 'clarity-login-api')
	assert.ok(found)
	return found
})()

const ANSWER =
	'Add a POST /api/auth/login endpoint to our Express API. Return 200 with a JWT on success and 401 for a wrong password. Do not change the users schema.'

const judgement = (overrides: Partial<Record<string, LlmJudgement['criteria'][number]>> = {}) => ({
	criteria: login.criteria.map(
		(criterion) =>
			overrides[criterion.id] ?? {
				id: criterion.id,
				status: 'missing' as const,
				quote: null
			}
	),
	pitfalls: []
})

const score = (challenge: ChallengeDefinition, prompt: string, judged: LlmJudgement) =>
	evaluationFromLlm({ challenge, prompt, judgement: judged, evaluator: 'test' })

test('the judge is sent the brief, the criteria as described, and the answer; nothing else', () => {
	const input = practiceJudgingInput({ challenge: login, answer: ANSWER })
	assert.equal(input.answer, ANSWER)
	assert.deepEqual(
		input.criteria.map((criterion) => criterion.id),
		login.criteria.map((criterion) => criterion.id)
	)
	const sent = JSON.stringify(input)
	assert.ok(!sent.includes('anyOf'), 'no rule patterns')
	assert.ok(!sent.includes(login.exemplar.slice(-60)), 'no strong answer')
	assert.ok(!sent.includes(login.explanation.slice(0, 40)), 'no explanation of it')
})

test('met criteria with real quotes earn their weight, with the rules arithmetic', () => {
	const result = score(
		login,
		ANSWER,
		judgement({
			objective: { id: 'objective', status: 'met', quote: 'Add a POST /api/auth/login endpoint' },
			context: { id: 'context', status: 'met', quote: 'our Express API' },
			constraints: { id: 'constraints', status: 'met', quote: 'Do not change the users schema' }
		})
	)
	const met = result.criteria.filter((criterion) => criterion.status === 'met')
	assert.equal(met.length, 3)
	const total = login.criteria.reduce((sum, criterion) => sum + criterion.weight, 0)
	const earned = met.reduce((sum, criterion) => sum + criterion.weight, 0)
	assert.equal(result.score, Math.round((earned / total) * 100))
	assert.ok(
		met.every((criterion) => criterion.evidence != null && ANSWER.includes(criterion.evidence))
	)
})

test('a claimed criterion without a matching quote is downgraded, and shows no evidence', () => {
	const result = score(
		login,
		ANSWER,
		judgement({
			objective: { id: 'objective', status: 'met', quote: 'Build an amazing login flow' },
			context: { id: 'context', status: 'partial', quote: 'words not in the answer' }
		})
	)
	const objective = result.criteria.find((criterion) => criterion.id === 'objective')
	assert.equal(objective?.status, 'partial')
	assert.equal(objective?.evidence, null)
	assert.equal(result.criteria.find((criterion) => criterion.id === 'context')?.status, 'missing')
})

test('pitfalls count only with a real quote; the unchanged and too-short caps still apply', () => {
	const vague = login.pitfalls[0]
	assert.ok(vague)
	const withPitfall = evaluationFromLlm({
		challenge: login,
		prompt: `${ANSWER} Just fix it.`,
		judgement: {
			...judgement(),
			pitfalls: [
				{ id: vague.id, quote: 'Just fix it.' },
				{ id: vague.id, quote: 'not in the answer at all' },
				{ id: 'unknown', quote: 'Just fix it.' }
			]
		},
		evaluator: 'test'
	})
	assert.equal(withPitfall.pitfalls.length, 1)
	const allMet = judgement(
		Object.fromEntries(
			login.criteria.map((criterion) => [
				criterion.id,
				{ id: criterion.id, status: 'met' as const, quote: 'Build a login API.' }
			])
		)
	)
	const unchanged = score(login, 'Build a login API.', allMet)
	assert.ok(
		unchanged.score <= 25,
		'an unchanged or too-short answer is capped whatever the model said'
	)
	assert.ok(unchanged.caps.length >= 1)
})

test('the evaluator uses the model, labels the result, and falls back to the rules on failure', async () => {
	const ok = llmEvaluator({
		generate: async () => ({
			data: judgement({ objective: { id: 'objective', status: 'met', quote: 'Add a POST' } }),
			model: 'nvidia/nemotron'
		})
	})
	const judged = await ok.evaluate({ challenge: login, prompt: ANSWER })
	assert.equal(judged.evaluator, `${LLM_EVALUATOR_VERSION} · nvidia/nemotron`)
	assert.equal(judgedBy(judged.evaluator), 'ai')

	const seen: unknown[] = []
	const broken = llmEvaluator({
		generate: async () => {
			throw new Error('unavailable')
		},
		onFallback: (failure) => seen.push(failure)
	})
	const fallback = await broken.evaluate({ challenge: login, prompt: ANSWER })
	assert.equal(fallback.evaluator, FALLBACK_EVALUATOR_ID)
	assert.equal(judgedBy(fallback.evaluator), 'rules_fallback')
	assert.equal(fallback.score, evaluateWithRules({ challenge: login, prompt: ANSWER }).score)
	assert.equal(seen.length, 1)
	assert.equal(judgedBy('rules-1.0'), 'rules')
})
