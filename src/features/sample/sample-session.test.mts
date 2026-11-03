import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { aggregate, assessSessions } from '@/features/assessment/assess'
import { RUBRIC_VERSION, SKILL_IDS } from '@/features/assessment/rubric'
import { focusOf } from '@/features/dashboard/dashboard-model'
import { scoreRewrite } from '@/features/practice/score-rewrite'
import { parseSessionLog } from '@/features/sessions/parse-log'
import { loadSample, sampleDigest, SAMPLE_ASSESSMENT_ID, SAMPLE_FILE_NAME } from './sample-session'

const promptsOf = (sessions: Awaited<ReturnType<typeof loadSample>>['sessions']) =>
	sessions.flatMap((session) =>
		session.turns.flatMap((turn) => (turn.prompt == null ? [] : [turn.prompt.text]))
	)

describe('the sample session goes through the real pipeline', () => {
	it('is a log file that the upload parser accepts as it is', () => {
		const parsed = parseSessionLog(sampleDigest())
		assert.equal(parsed.ok, true)
		assert.ok(SAMPLE_FILE_NAME.endsWith('.md'))
	})

	it('is the same on every call', async () => {
		assert.equal(sampleDigest(), sampleDigest())
		const first = await loadSample()
		const second = await loadSample()
		assert.deepEqual(first.stored.assessment, second.stored.assessment)
		const parsed = parseSessionLog(sampleDigest())
		assert.ok(parsed.ok)
		assert.deepEqual(assessSessions([parsed.session]), first.stored.assessment)
	})

	it('is scored by rules-1.0 on exactly the five assessed skills', async () => {
		const { stored } = await loadSample()
		assert.equal(stored.assessment.rubricVersion, RUBRIC_VERSION)
		assert.deepEqual(
			stored.assessment.skills.map((skill) => skill.skill),
			[...SKILL_IDS]
		)
		assert.equal(stored.assessment.skills.length, 5)
	})

	it('has enough evidence to score every skill, without being tuned to a result', async () => {
		const { stored } = await loadSample()
		for (const skill of stored.assessment.skills) {
			assert.notEqual(skill.score, null, `${skill.skill} was not scored`)
			assert.notEqual(skill.confidence, 'insufficient')
		}
		assert.equal(stored.assessment.overall.skillsAssessed, 5)
	})

	it('derives the overall result and the weakest skill from the skill scores', async () => {
		const { stored } = await loadSample()
		const { skills, overall } = stored.assessment
		assert.deepEqual(aggregate(skills), overall)
		const lowest = Math.min(...skills.map((skill) => skill.score ?? Infinity))
		const weakest = skills.find((skill) => skill.skill === overall.weakest)
		assert.equal(weakest?.score, lowest)
	})

	it('quotes only text that is in the sample, and links each recommendation to its evidence', async () => {
		const { stored, sessions } = await loadSample()
		const prompts = promptsOf(sessions)
		for (const skill of stored.assessment.skills) {
			for (const evidence of skill.evidence) {
				assert.ok(
					prompts.some((text) => text.includes(evidence.excerpt)),
					`${evidence.id} is not a quote of the sample`
				)
			}
		}
		assert.ok(stored.assessment.recommendations.length > 0)
		for (const recommendation of stored.assessment.recommendations) {
			const skill = stored.assessment.skills.find((item) => item.skill === recommendation.skill)
			const evidence = skill?.evidence.find((item) => item.id === recommendation.evidenceId)
			assert.ok(evidence, 'a recommendation points at evidence that is not there')
			assert.equal(evidence.criterion, recommendation.criterion)
		}
	})

	it('gives Focus next a weakest skill with its own quote', async () => {
		const { stored, sessions } = await loadSample()
		const focus = focusOf(stored, null)
		assert.equal(focus.kind, 'ready')
		if (focus.kind !== 'ready') return
		assert.equal(focus.skill, stored.assessment.recommendations[0]?.skill)
		assert.ok(promptsOf(sessions).some((text) => text.includes(focus.quote.excerpt)))
	})

	it('feeds the existing drill: the same rules score a rewrite of the focus', async () => {
		const { stored } = await loadSample()
		const focus = focusOf(stored, null)
		assert.equal(focus.kind, 'ready')
		if (focus.kind !== 'ready') return
		const input = { skill: focus.skill, criterion: focus.criterion } as const
		assert.equal(scoreRewrite({ ...input, text: '   ' }).verdict, 'notEvaluable')
		const result = scoreRewrite({
			...input,
			text: 'Still failing: expected the total to be 12 but got 10, in src/cart.ts.'
		})
		assert.equal(result.verdict, 'improved')
		assert.deepEqual(
			result,
			scoreRewrite({
				...input,
				text: 'Still failing: expected the total to be 12 but got 10, in src/cart.ts.'
			})
		)
	})

	it('does not look like a real assessment: its id can never be a database id', () => {
		assert.equal(SAMPLE_ASSESSMENT_ID, 'sample')
		assert.doesNotMatch(
			SAMPLE_ASSESSMENT_ID,
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
		)
	})
})

// The sample must stay read-only and separate from accounts: no module that is part
// of it may import the database, the server actions or the workspace repository (a
// type-only import is erased and writes nothing).
describe('the sample cannot reach persistence', () => {
	const FORBIDDEN =
		/^(?:@\/server\/|@\/lib\/db|@prisma\/|@\/features\/workspace\/(?:repository|workspace-data)|@\/features\/sessions\/(?:session-intake|upload-list))/

	/** Modules a file imports at runtime: type-only imports are erased and write nothing. */
	const runtimeImports = (source: string) =>
		[...source.matchAll(/^import\s+(type\s+)?([\s\S]*?)\s+from\s+'([^']+)'/gm)]
			.filter((match) => match[1] == null)
			.map((match) => match[3] ?? '')

	const files = (dir: string): string[] =>
		readdirSync(dir).flatMap((name) => {
			const path = join(dir, name)
			return statSync(path).isDirectory() ? files(path) : /\.(ts|tsx)$/.test(name) ? [path] : []
		})

	it('imports none of them in the sample feature or its pages', () => {
		const roots = [
			join('src', 'features', 'sample'),
			join('src', 'app', '[locale]', '(app)', 'sample')
		]
		const sources = roots.flatMap(files).filter((path) => !path.endsWith('.test.mts'))
		assert.ok(sources.length >= 6)
		for (const path of sources) {
			for (const specifier of runtimeImports(readFileSync(path, 'utf8'))) {
				assert.doesNotMatch(specifier, FORBIDDEN, `${path} imports ${specifier}`)
			}
		}
	})
})
