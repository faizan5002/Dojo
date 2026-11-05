import { assessedPromptText } from '@/features/assessment/interactions'
import type { CriterionId, SkillId } from '@/features/assessment/rubric'
import type { Polarity, SkillAssessment, Suggestion } from '@/features/assessment/types'
import type { ParsedSession } from '@/features/sessions/types'

// The conversation viewer's model: the original session in order, with every
// assessment finding anchored to the exact characters it quotes. Pure; nothing
// here scores anything, it only places what the assessment already found.

export interface Finding {
	/** Unique within one assessment (`iteration-3`). */
	readonly id: string
	readonly skill: SkillId
	readonly criterion: CriterionId
	readonly polarity: Polarity
	readonly promptNumber: number
	readonly start: number
	readonly end: number
	readonly excerpt: string
	readonly suggestion: Suggestion | null
}

export interface ViewTurn {
	/** 1-based among the prompts the assessment read; null for a turn with no readable prompt. */
	readonly promptNumber: number | null
	/** The prompt as the assessment read it (harness blocks removed, secrets redacted). */
	readonly prompt: string | null
	readonly promptTime: string | null
	readonly response: string | null
	readonly responseTime: string | null
}

export interface SessionView {
	readonly sessionId: string
	readonly agent: string
	readonly project: string | null
	readonly turns: readonly ViewTurn[]
	/** In reading order: by prompt, then by position in it. */
	readonly findings: readonly Finding[]
	/** Findings whose quote could not be matched to this text; never shown as highlights. */
	readonly unmatched: number
}

/**
 * Anchors the assessment's evidence for one session. A finding is kept only if
 * its quote is, character for character, the stated slice of that prompt, the
 * same check the assessment applies before it will show a quote at all.
 */
export function buildSessionView(
	session: ParsedSession,
	skills: readonly SkillAssessment[]
): SessionView {
	let promptNumber = 0
	const turns: ViewTurn[] = session.turns.map((turn) => {
		const prompt = turn.prompt == null ? null : assessedPromptText(turn.prompt.text)
		const readable = prompt != null && prompt !== ''
		if (readable) promptNumber++
		return {
			promptNumber: readable ? promptNumber : null,
			prompt: readable ? prompt : null,
			promptTime: turn.prompt?.timestamp || null,
			response: turn.response?.text ?? null,
			responseTime: turn.response?.timestamp || null
		}
	})
	const textOf = new Map(
		turns.flatMap((turn) => (turn.promptNumber == null ? [] : [[turn.promptNumber, turn.prompt]]))
	)
	const candidates = skills.flatMap((skill) =>
		skill.evidence.filter((evidence) => evidence.sessionId === session.sessionId)
	)
	const findings: Finding[] = []
	let unmatched = 0
	for (const evidence of candidates) {
		const text = textOf.get(evidence.promptNumber)
		if (text == null || text.slice(evidence.start, evidence.end) !== evidence.excerpt) {
			unmatched++
			continue
		}
		findings.push({
			id: evidence.id,
			skill: evidence.skill,
			criterion: evidence.criterion,
			polarity: evidence.polarity,
			promptNumber: evidence.promptNumber,
			start: evidence.start,
			end: evidence.end,
			excerpt: evidence.excerpt,
			suggestion: evidence.suggestion
		})
	}
	findings.sort((a, b) => a.promptNumber - b.promptNumber || a.start - b.start || a.end - b.end)
	return {
		sessionId: session.sessionId,
		agent: session.agent,
		project: session.project,
		turns,
		findings,
		unmatched
	}
}

export interface Segment {
	readonly text: string
	/** Every finding whose quote covers this piece. */
	readonly findingIds: readonly string[]
}

/** Splits a prompt at every finding boundary, so overlapping quotes each stay exact. */
export function segmentPrompt(text: string, findings: readonly Finding[]): Segment[] {
	const cuts = new Set<number>([0, text.length])
	for (const finding of findings) {
		cuts.add(Math.max(0, Math.min(text.length, finding.start)))
		cuts.add(Math.max(0, Math.min(text.length, finding.end)))
	}
	const points = [...cuts].sort((a, b) => a - b)
	const segments: Segment[] = []
	for (let index = 0; index < points.length - 1; index++) {
		const from = points[index] ?? 0
		const to = points[index + 1] ?? 0
		if (to <= from) continue
		segments.push({
			text: text.slice(from, to),
			findingIds: findings
				.filter((finding) => finding.start <= from && finding.end >= to)
				.map((finding) => finding.id)
		})
	}
	return segments
}

/** The session an assessment's finding lives in, or the first with any findings. */
export function pickSession(
	sessions: readonly ParsedSession[],
	skills: readonly SkillAssessment[],
	requested: { sessionId?: string; findingId?: string }
): ParsedSession | null {
	if (requested.sessionId != null) {
		return sessions.find((session) => session.sessionId === requested.sessionId) ?? null
	}
	if (requested.findingId != null) {
		const evidence = skills
			.flatMap((skill) => skill.evidence)
			.find((item) => item.id === requested.findingId)
		const owner = sessions.find((session) => session.sessionId === evidence?.sessionId)
		if (owner != null) return owner
	}
	const withFindings = sessions.find((session) =>
		skills.some((skill) => skill.evidence.some((item) => item.sessionId === session.sessionId))
	)
	return withFindings ?? sessions[0] ?? null
}
