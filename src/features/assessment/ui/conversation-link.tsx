'use client'

import { createContext, useContext } from 'react'

// Where "Open in the conversation" goes for an assessment's evidence. The page that
// shows an assessment provides the base (the signed-in viewer for a saved assessment,
// the public one for the sample); with none, the evidence shows no such link.
const BaseContext = createContext<string | null>(null)

export function ConversationLinks({
	base,
	children
}: {
	base: string | null
	children: React.ReactNode
}) {
	return <BaseContext.Provider value={base}>{children}</BaseContext.Provider>
}

export function useConversationHref(): (evidence: {
	id: string
	sessionId: string
}) => string | null {
	const base = useContext(BaseContext)
	return (evidence) => {
		if (base == null) return null
		const joiner = base.includes('?') ? '&' : '?'
		return `${base}${joiner}session=${encodeURIComponent(evidence.sessionId)}&finding=${encodeURIComponent(evidence.id)}`
	}
}
