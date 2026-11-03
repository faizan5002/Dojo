import type { Criterion, Pitfall } from '@/features/practice/types'

// Criteria and pitfalls several challenges share. Each challenge passes its own
// scenario anchors (`near`), so "add tests" only fully counts when the sentence
// is about that challenge's task.

type Anchors = readonly RegExp[] | undefined

export const objective = (weight: number, near: Anchors): Criterion => ({
	id: 'objective',
	label: 'States the objective',
	weight,
	anyOf: [
		/\b(?:implement|build|create|add|fix|write|make|update|change|refactor|design|optimi[sz]e|reduce|improve|speed up)\b/i
	],
	near,
	hint: 'Open with the one thing the agent should achieve, naming the feature.',
	template: 'Goal: [the one outcome this change must achieve].'
})

export const technicalContext = (weight: number, extra: readonly RegExp[] = []): Criterion => ({
	id: 'context',
	label: 'Gives technical context',
	weight,
	anyOf: [
		/`[^`\n]+`/,
		/\b[\w-]+\.(?:tsx?|jsx?|py|go|rb|java|sql|prisma|json|ya?ml)\b/,
		/(?:^|\s)(?:\.?\/)?(?:[\w.-]+\/)+[\w.-]+/,
		/\b(?:node(?:\.js)?|express|nest(?:js)?|next(?:\.js)?|react|postgres(?:ql)?|prisma|typescript|jwt|redis|graphql|rest|endpoint|route|middleware|service|controller|component|table|schema|module)\b/i,
		...extra
	],
	hint: 'Name the stack, files or components involved so the agent does not guess.',
	template: 'Context: [the framework, files and components involved].'
})

export const expectedBehaviour = (weight: number, near: Anchors): Criterion => ({
	id: 'behaviour',
	label: 'Describes the expected behaviour',
	weight,
	anyOf: [
		/\b(?:should|must|returns?|responds?|expected?|when .{3,60} then|status (?:code )?\d{3}|\b[245]\d\d\b)\b/i
	],
	near,
	hint: 'Say what should happen, including the response or result for success and failure.',
	template: 'Behaviour: [what happens on success, and on each failure].'
})

export const constraints = (weight: number): Criterion => ({
	id: 'constraints',
	label: 'States constraints',
	weight,
	anyOf: [
		/\b(?:don'?t|do not|must not|never|without|only|avoid|keep|no (?:new|breaking)|limit(?:ed)? to|backward[- ]compatible)\b/i
	],
	hint: 'Add what must stay the same or what the agent must not do.',
	template: 'Constraints: [what must not change, and any limits].'
})

export const acceptanceCriteria = (weight: number, near: Anchors): Criterion => ({
	id: 'acceptance',
	label: 'Defines acceptance criteria',
	weight,
	anyOf: [
		/\b(?:acceptance criteria|done when|definition of done|it'?s done|success (?:means|looks like)|verify that|make sure (?:that )?\w+|ensure (?:that )?\w+)\b/i,
		/\btests? (?:that |which )?(?:pass|cover|prove|check)/i
	],
	near,
	hint: 'Say how you will know it is finished: a check someone can run.',
	template: 'Done when: [the checks that prove it works].'
})

export const edgeCases = (weight: number, near: Anchors): Criterion => ({
	id: 'edgeCases',
	label: 'Covers edge cases',
	weight,
	anyOf: [
		/\b(?:edge cases?|corner cases?|what if|invalid|empty|missing|null|expired?|duplicate|concurren\w*|race|timeouts?|rate limit\w*|locked|wrong password|too (?:long|many))\b/i
	],
	near,
	hint: 'Name the failure cases that matter for this task.',
	template: 'Edge cases: [the inputs and states that must be handled].'
})

export const asksForTests = (weight: number, near: Anchors): Criterion => ({
	id: 'tests',
	label: 'Asks for tests',
	weight,
	anyOf: [/\b(?:unit|integration|e2e|end-to-end|regression)? ?tests?\b/i, /\bspecs?\b/i],
	near,
	hint: 'Ask for tests that cover the behaviour, and for them to be run.',
	template: 'Tests: [the cases to cover, and run them].'
})

export const asksForEvidence = (weight: number): Criterion => ({
	id: 'evidence',
	label: 'Asks for evidence it works',
	weight,
	anyOf: [
		/\b(?:show me|paste|share|include) (?:the )?(?:test )?(?:output|results?|logs?|diff|evidence)\b/i,
		/\b(?:run|re-?run) (?:the |all |your )?(?:tests?|suite|checks?|linter|build)\b.{0,80}\b(?:show|report|confirm|output|pass)/i,
		/\bhow (?:did|do) you (?:know|verify|check|test)\b/i,
		/\bdid you (?:run|test|check|verify)\b/i,
		/\b(?:report|show me|tell me) (?:how many|that|the (?:counts?|numbers?|results?))\b/i
	],
	hint: 'Ask the agent to run the checks and show the output, not just say it works.',
	template: 'Evidence: run [the tests or checks] and paste the output.'
})

export const vaguePitfall: Pitfall = {
	id: 'vague',
	label: 'Vague filler instead of a request',
	pattern:
		/\b(?:make it (?:better|good|nice|work)|do your best|you know what i mean|just fix it|etc\.?\s*$)/i,
	penalty: 10
}

export const sweepingPitfall: Pitfall = {
	id: 'sweeping',
	label: 'Invites sweeping, unrelated change',
	pattern:
		/\b(?:while you(?:'re| are) at it|refactor (?:everything|the whole|all)|clean up (?:everything|the whole codebase)|rewrite (?:everything|it all|the whole)|improve anything else|fix (?:anything|whatever) else)\b/i,
	penalty: 15
}

export const blindTrustPitfall: Pitfall = {
	id: 'blindTrust',
	label: 'Accepts the claim without checking',
	pattern: /\b(?:looks good|lgtm|ship it|great,? (?:thanks|done)|perfect,? (?:thanks|move on))\b/i,
	penalty: 15
}
