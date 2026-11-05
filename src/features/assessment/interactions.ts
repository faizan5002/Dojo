import type { ParsedSession } from '@/features/sessions/types'
import { redactSecrets } from './redact'
import { FEEDBACK, REFINEMENT, TASK_REQUEST, isApproval, isQuestion } from './signals'

export type PromptKind = 'task' | 'question' | 'feedback' | 'approval' | 'other'

/**
 * One user prompt in its session, ready to score: injected harness context
 * removed and credentials redacted. Evidence quotes this `text`, never the raw
 * file.
 */
export interface Interaction {
	readonly sessionId: string
	/** 1-based position among the session's prompts. */
	readonly promptNumber: number
	readonly text: string
	readonly kind: PromptKind
	readonly followsResponse: boolean
	readonly answered: boolean
}

export interface PreparedSessions {
	readonly sessions: readonly (readonly Interaction[])[]
	readonly redactions: number
}

// What the agent harness wraps around a typed prompt; older log writers keep it.
const INJECTED_BLOCKS = [
	/<system-reminder>[\s\S]*?<\/system-reminder>/g,
	/<ide_[a-z_]+>[\s\S]*?<\/ide_[a-z_]+>/g,
	/<environment_context>[\s\S]*?<\/environment_context>/g
]

function clean(text: string): string {
	return INJECTED_BLOCKS.reduce((out, block) => out.replace(block, ''), text).trim()
}

/**
 * The text the assessment actually reads for a prompt: harness blocks removed and
 * credentials redacted. Evidence offsets point into this text, so the conversation
 * viewer shows it, and a test holds it equal to what `prepareSessions` produced.
 */
export function assessedPromptText(text: string): string {
	return redactSecrets(clean(text)).text
}

export function classifyPrompt({
	text,
	followsResponse
}: {
	text: string
	followsResponse: boolean
}): PromptKind {
	if (isApproval(text)) return 'approval'
	if (followsResponse && (FEEDBACK.test(text) || REFINEMENT.test(text))) return 'feedback'
	if (isQuestion(text) && !TASK_REQUEST.test(text.split(/[.!?\n]/)[0] ?? '')) return 'question'
	if (TASK_REQUEST.test(text)) return 'task'
	return 'other'
}

export function prepareSessions(sessions: readonly ParsedSession[]): PreparedSessions {
	let redactions = 0
	const prepared = sessions.map((session) => {
		let promptNumber = 0
		let previousAnswered = false
		const interactions: Interaction[] = []
		for (const turn of session.turns) {
			if (turn.prompt == null) {
				previousAnswered = turn.response != null
				continue
			}
			const redacted = redactSecrets(clean(turn.prompt.text))
			redactions += redacted.count
			const followsResponse = previousAnswered
			previousAnswered = turn.response != null
			if (redacted.text === '') continue
			promptNumber++
			interactions.push({
				sessionId: session.sessionId,
				promptNumber,
				text: redacted.text,
				kind: classifyPrompt({ text: redacted.text, followsResponse }),
				followsResponse,
				answered: turn.response != null
			})
		}
		return interactions
	})
	return { sessions: prepared, redactions }
}
