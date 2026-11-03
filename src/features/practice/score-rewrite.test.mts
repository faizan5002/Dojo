import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { scoreRewrite } from './score-rewrite'

describe('scoring a rewrite with the assessment rules', () => {
	it('is not evaluable when there is no text', () => {
		const result = scoreRewrite({ text: '   ', skill: 'scopeControl', criterion: 'broadRequest' })
		assert.equal(result.verdict, 'notEvaluable')
		assert.equal(result.value, null)
	})

	it('still flags a broad request, with the matched words quoted', () => {
		const text = 'Build the whole app with everything from scratch.'
		const result = scoreRewrite({ text, skill: 'scopeControl', criterion: 'broadRequest' })
		assert.equal(result.verdict, 'weaknessRemains')
		assert.ok(result.weakness != null)
		assert.ok(text.includes(result.weakness.quote))
	})

	it('credits a narrowed request and no longer flags the weakness', () => {
		const text =
			"In src/features/dashboard/ui/focus-next.tsx, add a link under the action. Don't change anything else."
		const result = scoreRewrite({ text, skill: 'scopeControl', criterion: 'broadRequest' })
		assert.equal(result.verdict, 'improved')
		assert.equal(result.weakness, null)
		assert.ok(result.strengths.length > 0)
		assert.ok(result.strengths.every((strength) => text.includes(strength.quote)))
		assert.ok((result.value ?? 0) > 50)
	})

	it('scores a vague prompt below a specific one on the same rules', () => {
		const vague = scoreRewrite({
			text: 'fix it',
			skill: 'promptClarity',
			criterion: 'vagueReference'
		})
		const specific = scoreRewrite({
			text: "Fix the TypeError 'x is undefined' in src/app/page.tsx so the dashboard renders. Done when the page loads without console errors.",
			skill: 'promptClarity',
			criterion: 'vagueReference'
		})
		assert.notEqual(vague.verdict, 'improved')
		assert.equal(specific.verdict, 'improved')
		assert.ok((specific.value ?? 0) > (vague.value ?? 100))
	})

	it('reads a larger build that asks for a plan first, and ignores a small fix', () => {
		const planned = scoreRewrite({
			text: "Build an export for the history page with a button, a CSV download and a confirmation toast. Before writing code, propose a plan with the steps and the files you'll touch.",
			skill: 'planning',
			criterion: 'straightToBuild'
		})
		assert.equal(planned.verdict, 'improved')
		const unplanned = scoreRewrite({
			text: 'Build an export for the history page with a button, a CSV download and a confirmation toast.',
			skill: 'planning',
			criterion: 'straightToBuild'
		})
		assert.equal(unplanned.verdict, 'weaknessRemains')
		// The rubric does not score planning on a small fix, so it says so instead of a result.
		const small = scoreRewrite({
			text: 'Fix the typo in the title.',
			skill: 'planning',
			criterion: 'straightToBuild'
		})
		assert.equal(small.verdict, 'notEvaluable')
	})

	it('flags a change request that does not ask for a check, and credits one that does', () => {
		const unchecked = scoreRewrite({
			text: 'Add the export button to the history page.',
			skill: 'verification',
			criterion: 'acceptedWithoutCheck'
		})
		assert.equal(unchecked.verdict, 'weaknessRemains')
		const checked = scoreRewrite({
			text: 'Add the export button to the history page, then run the tests and show me the output.',
			skill: 'verification',
			criterion: 'acceptedWithoutCheck'
		})
		assert.equal(checked.verdict, 'improved')
	})

	it('reads a follow-up as a reply to the agent, specific beating vague', () => {
		const vague = scoreRewrite({
			text: 'still broken',
			skill: 'iteration',
			criterion: 'vagueFeedback'
		})
		assert.equal(vague.verdict, 'weaknessRemains')
		const specific = scoreRewrite({
			text: 'Still failing: expected the total to be 12 but got 10, in src/cart.ts.',
			skill: 'iteration',
			criterion: 'vagueFeedback'
		})
		assert.equal(specific.verdict, 'improved')
	})

	it('is deterministic', () => {
		const input = {
			text: 'Rename the helper in src/lib/format.ts. Only that file.',
			skill: 'scopeControl',
			criterion: 'broadRequest'
		} as const
		assert.deepEqual(scoreRewrite(input), scoreRewrite(input))
	})

	it('never reports a quote that is not in the rewrite', () => {
		const text = 'Add the export button to src/app/history.tsx and nothing else.'
		const result = scoreRewrite({ text, skill: 'scopeControl', criterion: 'broadRequest' })
		for (const finding of [...result.strengths, ...(result.weakness ? [result.weakness] : [])]) {
			assert.ok(text.includes(finding.quote))
		}
	})
})
