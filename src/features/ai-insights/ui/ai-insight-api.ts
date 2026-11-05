import { z } from 'zod'

// The browser's side of the AI insight endpoints. Each call resolves to a
// plain outcome rather than throwing, so components can switch on it without
// try/catch (which the React Compiler cannot optimise around). The server's
// error message is already written for people; it is shown as it is.

const insightSchema = z.object({
	id: z.string(),
	feature: z.string(),
	label: z.string(),
	notice: z.string(),
	model: z.string(),
	createdAt: z.string(),
	cached: z.boolean(),
	content: z.unknown()
})

export type Insight = z.infer<typeof insightSchema>

const bodySchema = z.object({ insight: insightSchema.nullable() })
const errorSchema = z.object({ error: z.string() })

export type InsightOutcome =
	{ ok: true; insight: Insight | null } | { ok: false; status: number; message: string | null }

async function call(path: string, method: 'GET' | 'POST'): Promise<InsightOutcome> {
	try {
		const response = await fetch(path, { method, cache: 'no-store' })
		const body: unknown = await response.json().catch(() => null)
		if (!response.ok) {
			const error = errorSchema.safeParse(body)
			return {
				ok: false,
				status: response.status,
				message: error.success ? error.data.error : null
			}
		}
		const parsed = bodySchema.safeParse(body)
		return parsed.success
			? { ok: true, insight: parsed.data.insight }
			: { ok: false, status: response.status, message: null }
	} catch {
		return { ok: false, status: 0, message: null }
	}
}

/** The stored insight, if any. Never generates. */
export const readInsight = (path: string) => call(path, 'GET')

/** Generates the insight, or returns the stored one for unchanged data. */
export const generateInsight = (path: string) => call(path, 'POST')
