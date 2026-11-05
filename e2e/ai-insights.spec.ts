import { test, expect, type Page } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { CHALLENGE_DEFINITIONS } from '../prisma/seed/practice-challenges/index'
import { STRONG_PROMPTS } from '../src/features/assessment/session-fixtures'
import { seedChallenges } from '../src/features/practice/seed-challenges'
import {
	canUseAuth,
	createTestUser,
	deleteTestUser,
	logFile,
	signIn,
	type TestUser
} from './workspace-helpers'

// Access rules of the AI insight endpoints. Every request here is refused
// before any generation (signed out, someone else's data, no attempt yet) or
// only reads, so this spec never calls xAI and never spends credits. Real
// generation is covered by unit tests with a fake model.

const FIRST_COMPILE_MS = 60_000

async function uploadAndScore(page: Page): Promise<{ assessmentId: string; uploadId: string }> {
	await page.goto('/sessions')
	await page
		.getByLabel('Choose log files')
		.setInputFiles([
			logFile({ name: 'ai-insights.md', sessionId: 'ai-insights', prompts: STRONG_PROMPTS })
		])
	await expect(page).toHaveURL(/\/sessions\?upload=/, { timeout: FIRST_COMPILE_MS })
	const uploadId = new URL(page.url()).searchParams.get('upload') ?? ''
	await page.getByRole('link', { name: 'Score my workflow' }).click()
	await page.getByRole('button', { name: 'Analyze my workflow' }).click()
	await expect(page).toHaveURL(/\/assessment\?id=/, { timeout: FIRST_COMPILE_MS })
	return { assessmentId: new URL(page.url()).searchParams.get('id') ?? '', uploadId }
}

const ANY_ID = '00000000-0000-4000-8000-000000000000'

test('every AI insight endpoint refuses a signed-out caller', async ({ request }) => {
	for (const path of [
		`/api/assessments/${ANY_ID}/insight`,
		`/api/uploads/${ANY_ID}/insight`,
		`/api/prompting-guru/attempts/${ANY_ID}/ai-feedback`,
		'/api/prompting-guru/challenges/clarity-login-api/ai-example',
		'/api/prompting-guru/recommendation/ai-explanation'
	]) {
		expect((await request.get(path)).status(), `GET ${path}`).toBe(401)
		expect((await request.post(path)).status(), `POST ${path}`).toBe(401)
	}
})

test.describe('AI insight access', () => {
	test.skip(!canUseAuth, 'Supabase is not configured for this server')
	test.describe.configure({ mode: 'serial' })
	let owner: TestUser
	let stranger: TestUser
	let ids = { assessmentId: '', uploadId: '', attemptId: '' }

	test.beforeAll(async () => {
		const db = new PrismaClient()
		try {
			await seedChallenges({ db, definitions: CHALLENGE_DEFINITIONS })
		} finally {
			await db.$disconnect()
		}
		;[owner, stranger] = await Promise.all([createTestUser(), createTestUser()])
	})
	test.afterAll(async () => {
		await Promise.all([deleteTestUser(owner), deleteTestUser(stranger)])
	})

	test('the owner can read before anything is generated; nothing is invented', async ({ page }) => {
		await signIn(page, owner)
		const { assessmentId, uploadId } = await uploadAndScore(page)
		const submitted = await page.request.post(
			'/api/prompting-guru/challenges/clarity-login-api/submit',
			{
				data: { answer: 'Add a login endpoint to our Express API with tests for wrong passwords.' }
			}
		)
		expect(submitted.status()).toBe(201)
		ids = { assessmentId, uploadId, attemptId: (await submitted.json()).id }

		for (const path of [
			`/api/assessments/${assessmentId}/insight`,
			`/api/uploads/${uploadId}/insight`,
			`/api/prompting-guru/attempts/${ids.attemptId}/ai-feedback`,
			'/api/prompting-guru/challenges/clarity-login-api/ai-example'
		]) {
			const response = await page.request.get(path)
			expect(response.status(), path).toBe(200)
			expect(await response.json()).toEqual({ insight: null })
			expect(response.headers()['cache-control']).toContain('no-store')
		}
		const recommendation = await page.request.get(
			'/api/prompting-guru/recommendation/ai-explanation'
		)
		const body = await recommendation.json()
		expect(body.insight).toBeNull()
		expect(typeof body.slug).toBe('string')
	})

	test("another user's assessment, upload and attempt are 404, before any generation", async ({
		page
	}) => {
		await signIn(page, stranger)
		for (const path of [
			`/api/assessments/${ids.assessmentId}/insight`,
			`/api/uploads/${ids.uploadId}/insight`,
			`/api/prompting-guru/attempts/${ids.attemptId}/ai-feedback`
		]) {
			expect((await page.request.get(path)).status(), `GET ${path}`).toBe(404)
			expect((await page.request.post(path)).status(), `POST ${path}`).toBe(404)
		}
		const db = new PrismaClient()
		try {
			expect(await db.aiInsight.count({ where: { userId: stranger.id } })).toBe(0)
			expect(await db.aiInsight.count({ where: { userId: owner.id } })).toBe(0)
		} finally {
			await db.$disconnect()
		}
	})

	test('an example is refused until the user has attempted the challenge', async ({ page }) => {
		await signIn(page, stranger)
		const path = '/api/prompting-guru/challenges/clarity-login-api/ai-example'
		for (const response of [await page.request.get(path), await page.request.post(path)]) {
			expect(response.status()).toBe(403)
			expect((await response.json()).error).toContain('Submit an attempt')
		}
		expect(
			(
				await page.request.post('/api/prompting-guru/challenges/no-such-challenge/ai-example')
			).status()
		).toBe(404)
	})

	test('malformed ids are 404, not errors', async ({ page }) => {
		await signIn(page, owner)
		for (const path of [
			'/api/assessments/not-a-uuid/insight',
			'/api/uploads/not-a-uuid/insight',
			'/api/prompting-guru/attempts/not-a-uuid/ai-feedback',
			'/api/prompting-guru/challenges/NOT%20A%20SLUG/ai-example'
		]) {
			expect((await page.request.post(path)).status(), path).toBe(404)
		}
	})
})

// --- the AI panels in the pages, with the endpoint answers mocked -------------------

const EXPLANATION = {
	summary: 'MOCK-SUMMARY: you plan well and verify less often.',
	strongAreas: [{ skill: 'planning', explanation: 'You ask for a plan before code.' }],
	weakAreas: [
		{
			skill: 'verification',
			explanation: 'You accept results without asking for proof.',
			whyItMatters: 'Unverified output ships bugs.',
			recommendation: 'Ask the agent to run the tests and paste the output.'
		}
	],
	nextSteps: ['Ask for test output in your next session.']
}

const insightBody = (feature: string, content: unknown) => ({
	insight: {
		id: '11111111-1111-4111-8111-111111111111',
		feature,
		label: 'AI-powered insight',
		notice: 'Generated by AI.',
		aiGenerated: true,
		model: 'nvidia/nemotron-3-ultra-550b-a55b:free',
		promptVersion: `${feature}.v1`,
		createdAt: new Date().toISOString(),
		cached: false,
		content
	}
})

test.describe('AI panels in the pages', () => {
	test.skip(!canUseAuth, 'Supabase is not configured for this server')
	test.describe.configure({ mode: 'serial' })
	let user: TestUser
	let assessmentId = ''

	test.beforeAll(async () => {
		user = await createTestUser()
	})
	test.afterAll(async () => {
		await deleteTestUser(user)
	})

	test('the assessment page offers an AI explanation and renders it as text, not JSON', async ({
		page
	}) => {
		await signIn(page, user)
		;({ assessmentId } = await uploadAndScore(page))
		const panel = page.getByTestId('ai-insight-assessment_explanation')
		test.skip((await panel.count()) === 0, 'AI is not configured for this server')
		await expect(page.getByRole('heading', { name: 'AI-powered insight' })).toBeVisible()
		await expect(panel.getByText('Generated by AI from your Dojo data')).toBeVisible()
		// The official score is rendered by the page itself, before and apart from AI.
		await expect(page.getByTestId('overall-score')).toBeVisible()

		await page.route(`**/api/assessments/${assessmentId}/insight`, async (route) => {
			if (route.request().method() !== 'POST') return route.continue()
			await new Promise((resolve) => setTimeout(resolve, 400))
			await route.fulfill({ status: 201, json: insightBody('assessment_explanation', EXPLANATION) })
		})
		await panel.getByRole('button', { name: 'Explain my assessment with AI' }).click()
		await expect(panel.getByRole('button', { name: 'Generating…' })).toBeDisabled()
		await expect(panel.getByText('MOCK-SUMMARY')).toBeVisible()
		await expect(panel.getByText('Strong areas')).toBeVisible()
		await expect(panel.getByText('Planning before coding')).toBeVisible()
		await expect(panel.getByText('Why it matters')).toBeVisible()
		await expect(panel.getByText('Unverified output ships bugs.')).toBeVisible()
		await expect(panel.getByText(/Generated by nvidia\/nemotron/)).toBeVisible()
		expect(await panel.textContent()).not.toContain('"summary"')
	})

	test('a failed generation shows the reason and can be retried; the page stays usable', async ({
		page
	}) => {
		await signIn(page, user)
		await page.goto(`/assessment?id=${assessmentId}`)
		const panel = page.getByTestId('ai-insight-assessment_explanation')
		test.skip((await panel.count()) === 0, 'AI is not configured for this server')
		let calls = 0
		await page.route(`**/api/assessments/${assessmentId}/insight`, async (route) => {
			if (route.request().method() !== 'POST') return route.continue()
			calls++
			if (calls === 1) {
				await route.fulfill({
					status: 503,
					json: { error: 'The free AI model is busy or its usage limit was reached.' }
				})
				return
			}
			await route.fulfill({ status: 201, json: insightBody('assessment_explanation', EXPLANATION) })
		})
		await panel.getByRole('button', { name: 'Explain my assessment with AI' }).click()
		await expect(
			panel.getByText('The free AI model is busy or its usage limit was reached.')
		).toBeVisible()
		await expect(page.getByTestId('overall-score')).toBeVisible()
		await panel.getByRole('button', { name: 'Try again' }).click()
		await expect(panel.getByText('MOCK-SUMMARY')).toBeVisible()
		expect(calls).toBe(2)
	})

	test('Prompting Guru shows AI feedback and an AI example beside the rule-based result', async ({
		page
	}) => {
		await signIn(page, user)
		const submitted = await page.request.post(
			'/api/prompting-guru/challenges/clarity-login-api/submit',
			{
				data: { answer: 'Add a login endpoint to our Express API with tests for wrong passwords.' }
			}
		)
		const attempt = await submitted.json()
		await page.goto(`/prompting-guru/challenges/clarity-login-api?attempt=${attempt.id}`)
		const feedback = page.getByTestId('ai-insight-attempt_feedback')
		test.skip((await feedback.count()) === 0, 'AI is not configured for this server')
		await expect(page.getByTestId('guru-score')).toBeVisible()
		await expect(page.getByTestId('ai-insight-challenge_example')).toBeVisible()
		await page.route(`**/api/prompting-guru/attempts/${attempt.id}/ai-feedback`, (route) =>
			route.request().method() === 'POST'
				? route.fulfill({
						status: 201,
						json: insightBody('attempt_feedback', {
							summary: 'MOCK-FEEDBACK summary.',
							strengths: ['Names the stack.'],
							weaknesses: ['No status codes.'],
							missingRequirements: ['What a wrong password returns.'],
							suggestedImprovements: ['Say what success returns.'],
							improvedExample: ['Add POST /api/auth/login to our Express API.'],
							rewrite: {
								prompt: ['MOCK-REWRITE: Add a login endpoint to our Express API.', 'Return a JWT.'],
								requirements: ['Return a JWT.'],
								constraints: ['Do not change the users table.'],
								expectedOutput: 'A route and its tests.',
								acceptanceCriteria: ['Tests pass.'],
								verification: ['Run the tests and paste the output.']
							}
						})
					})
				: route.continue()
		)
		await feedback.getByRole('button', { name: 'Get AI feedback' }).click()
		await expect(feedback.getByText('MOCK-FEEDBACK summary.')).toBeVisible()
		await expect(feedback.getByText('MOCK-REWRITE')).toBeVisible()
		await expect(feedback.getByRole('button', { name: 'Copy' })).toBeVisible()
		await expect(feedback.getByText('Missing requirements')).toBeVisible()
	})

	test('the overview explains the recommended challenge on request', async ({ page }) => {
		await signIn(page, user)
		await page.goto('/prompting-guru')
		const panel = page.getByTestId('ai-insight-recommendation_explanation')
		test.skip((await panel.count()) === 0, 'AI is not configured for this server')
		await page.route('**/api/prompting-guru/recommendation/ai-explanation', (route) =>
			route.request().method() === 'POST'
				? route.fulfill({
						status: 201,
						json: insightBody('recommendation_explanation', {
							headline: 'MOCK-HEADLINE: practise verification next.',
							reasons: ['It is your lowest-scored skill.'],
							focusTip: 'Ask for proof.'
						})
					})
				: route.continue()
		)
		await panel.getByRole('button', { name: 'Why this challenge?' }).click()
		await expect(panel.getByText('MOCK-HEADLINE')).toBeVisible()
		await expect(panel.getByText('Focus on')).toBeVisible()
	})
})
