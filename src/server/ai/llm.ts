import 'server-only'
import type { z } from 'zod'
import { env } from '@/lib/env'
import {
	AiError,
	generateStructured,
	type LlmProvider,
	type LlmRequest,
	type StructuredResult
} from './llm-core'
import { openRouterProvider } from './openrouter'
import { xaiProvider } from './xai'

// The one entry point feature code uses for AI generation. It picks the
// provider AI_PROVIDER names (OpenRouter by default; xAI as an alternative)
// and returns validated structured output, or throws AiError. Nothing here
// falls back to another provider or model when one fails: a failure is
// reported, and Dojo's deterministic features carry on. Adding a provider
// means another LlmProvider and an entry below; no feature changes. See
// docs/rules/ai-usage.md.

export { AiError, type AiFailure } from './llm-core'

const PROVIDERS: Record<typeof env.AI_PROVIDER, () => LlmProvider | null> = {
	openrouter: openRouterProvider,
	xai: xaiProvider
}

/** The provider that would answer now, or null when AI is off or not configured. */
function activeProvider(): LlmProvider | null {
	if (env.AI_ENABLED !== 'true') return null
	return PROVIDERS[env.AI_PROVIDER]()
}

/** Whether AI is switched on and its provider is configured. */
export function isAiConfigured(): boolean {
	return activeProvider() != null
}

/**
 * Whether assessments and Prompting Guru answers are scored by the LLM (with
 * the rules as fallback). Off with AI_SCORING=off, or when AI is not configured.
 */
export function isAiScoringOn(): boolean {
	return env.AI_SCORING !== 'off' && isAiConfigured()
}

/** The model that would answer now, for the metadata stored with a result. */
export function configuredModel(): string | null {
	return activeProvider()?.model ?? null
}

export async function generate<T>(
	request: Omit<LlmRequest, 'jsonSchema'> & { schema: z.ZodType<T> }
): Promise<StructuredResult<T>> {
	const provider = activeProvider()
	if (provider == null) throw new AiError('disabled')
	return generateStructured({ ...request, provider })
}
