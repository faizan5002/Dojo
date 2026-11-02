'use client'

import { createContext, use, useState } from 'react'
import { assessSessions } from '@/features/assessment/assess'
import type { Assessment } from '@/features/assessment/types'
import { captureClientError } from '@/lib/observability/capture-client-error'
import type { IntakeResult } from './intake'

export type AssessmentState =
	| { readonly status: 'idle' }
	| { readonly status: 'running' }
	| { readonly status: 'done'; readonly result: Assessment }
	| { readonly status: 'failed' }

interface SessionStore {
	readonly intake: IntakeResult | null
	readonly assessment: AssessmentState
	readonly setIntake: (result: IntakeResult | null) => void
	readonly analyze: () => void
}

const SessionStoreContext = createContext<SessionStore | null>(null)

// The uploaded sessions and their assessment, shared by the pages of the app
// layout so they survive moving between Sessions and Assessment. It is memory
// only: nothing is written to storage or sent anywhere, and a reload clears it.
export function SessionStoreProvider({ children }: { children: React.ReactNode }) {
	const [intake, setIntakeState] = useState<IntakeResult | null>(null)
	const [assessment, setAssessment] = useState<AssessmentState>({ status: 'idle' })

	function setIntake(result: IntakeResult | null) {
		setIntakeState(result)
		setAssessment({ status: 'idle' })
	}

	function analyze() {
		if (intake == null || assessment.status === 'running') return
		const sessions = intake.sessions
		setAssessment({ status: 'running' })
		// Scoring is synchronous; yielding first lets the running state paint.
		window.setTimeout(() => {
			try {
				const result = assessSessions(sessions)
				// New logs or a Clear while scoring reset the state; keep that reset.
				setAssessment((current) =>
					current.status === 'running' ? { status: 'done', result } : current
				)
			} catch (error) {
				captureClientError(error)
				setAssessment((current) => (current.status === 'running' ? { status: 'failed' } : current))
			}
		}, 0)
	}

	return (
		<SessionStoreContext value={{ intake, assessment, setIntake, analyze }}>
			{children}
		</SessionStoreContext>
	)
}

export function useSessionStore(): SessionStore {
	const store = use(SessionStoreContext)
	if (store == null) throw new Error('useSessionStore needs a SessionStoreProvider above it')
	return store
}
