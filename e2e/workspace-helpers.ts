import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { PrismaClient } from '@prisma/client'
import { expect, type Page } from '@playwright/test'
import { buildLog, prompt, response } from '../src/features/sessions/log-fixture'

// Playwright does not load Next's env files; the e2e user helpers need the
// Supabase and database settings the dev server uses.
try {
	process.loadEnvFile('.env.local')
} catch {
	// No .env.local: the suites that need auth skip themselves.
}

const FIRST_COMPILE_MS = 60_000

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const secretKey = process.env.SUPABASE_SECRET_KEY ?? ''

/** Whether auth-backed suites can run: Supabase must be configured for this server. */
export const canUseAuth = supabaseUrl !== '' && secretKey !== ''

export interface TestUser {
	readonly id: string
	readonly email: string
	readonly password: string
}

const admin = () =>
	createClient(supabaseUrl, secretKey, { auth: { autoRefreshToken: false, persistSession: false } })

/** A confirmed account made through the admin API, so tests never wait on email. */
export async function createTestUser(): Promise<TestUser> {
	const email = `e2e-${randomUUID()}@example.com`
	const password = `pw-${randomUUID()}`
	const { data, error } = await admin().auth.admin.createUser({
		email,
		password,
		email_confirm: true
	})
	if (error != null || data.user == null)
		throw new Error(`could not create a test user: ${error?.message}`)
	return { id: data.user.id, email, password }
}

/** Removes the account and everything it stored, whatever the test got to. */
export async function deleteTestUser(user: TestUser): Promise<void> {
	const db = new PrismaClient()
	try {
		await db.user.deleteMany({ where: { id: user.id } })
	} finally {
		await db.$disconnect()
	}
	await admin().auth.admin.deleteUser(user.id)
}

export async function signIn(page: Page, user: TestUser): Promise<void> {
	await page.goto('/sign-in')
	await page.getByLabel('Email').fill(user.email)
	await page.getByLabel('Password').fill(user.password)
	await page.getByRole('button', { name: 'Sign in' }).click()
	// The first visit compiles /sessions on a cold dev server.
	await expect(page).toHaveURL(/\/sessions/, { timeout: FIRST_COMPILE_MS })
}

/** The form's own message; Next's route announcer is also role="alert". */
export const formAlert = (page: Page) => page.locator('form').getByRole('alert')

/** A log file as a person would choose it from .claude-logs. */
export function logFile({
	name,
	sessionId,
	prompts
}: {
	name: string
	sessionId: string
	prompts: readonly string[]
}) {
	const at = (minute: number) => new Date(Date.UTC(2026, 10, 1, 10, minute)).toISOString()
	const text = buildLog({
		sessionId,
		entries: prompts.flatMap((text, index) => [
			prompt(at(index * 2), text),
			response(at(index * 2 + 1), 'Done.')
		])
	})
	return { name, mimeType: 'text/markdown', buffer: Buffer.from(text) }
}
