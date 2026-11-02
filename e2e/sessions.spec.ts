import { test, expect, type Request } from '@playwright/test'
import {
	canUseAuth,
	createTestUser,
	deleteTestUser,
	logFile,
	signIn,
	type TestUser
} from './workspace-helpers'

const SECRET = `ghp_${'a1B2c3D4e5'.repeat(4)}`
// Present in the raw file's header (buildLog writes it) and nowhere else: if
// it appears in a request, the raw file left the browser.
const RAW_HEADER = 'git_email: fixture@example.com'
const LANDING_NAVIGATION_MS = 120_000

test.describe('sessions', () => {
	test.skip(!canUseAuth, 'Supabase is not configured for this server')
	let user: TestUser

	test.beforeAll(async () => {
		user = await createTestUser()
	})
	test.afterAll(async () => {
		await deleteTestUser(user)
	})

	test('an upload is redacted in the browser, saved, and still there after a reload', async ({
		page
	}) => {
		await signIn(page, user)
		const requests: Request[] = []
		page.on('request', (request) => requests.push(request))

		await page.getByLabel('Choose log files').setInputFiles([
			logFile({
				name: 'one.md',
				sessionId: 'session-one',
				prompts: [`Fix the deploy in scripts/deploy.sh, it uses ${SECRET}.`, 'Now run the suite']
			}),
			logFile({
				name: 'two.md',
				sessionId: 'session-two',
				prompts: ['Add a footer to layout.tsx']
			}),
			{ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not a log') }
		])
		await expect(page).toHaveURL(/\/sessions\?upload=/)
		await expect(page.getByText(/credential was redacted before saving/)).toBeVisible()
		const overview = page.getByRole('region', { name: 'Across your sessions' })
		await expect(overview.locator('dd').first()).toHaveText('2')
		await expect(page.getByText('Not a Markdown (.md) file.')).toBeVisible()

		for (const request of requests) {
			const body = request.postData() ?? ''
			expect(body).not.toContain(SECRET)
			expect(body).not.toContain(RAW_HEADER)
		}

		await page.reload()
		await expect(overview.locator('dd').first()).toHaveText('2')
		await expect(
			page.getByRole('region', { name: 'Your uploads' }).getByRole('listitem')
		).toHaveCount(1)
	})

	test('an upload can be deleted, and deletion takes its metrics with it', async ({ page }) => {
		await signIn(page, user)
		await page
			.getByLabel('Choose log files')
			.setInputFiles([
				logFile({ name: 'three.md', sessionId: 'session-three', prompts: ['Rename `a` to `b`'] })
			])
		await expect(page).toHaveURL(/\/sessions\?upload=/)
		const uploadUrl = page.url()
		const band = page.locator('section').filter({ has: page.getByLabel('Choose log files') })
		await band.getByRole('button', { name: 'Delete' }).click()
		await band.getByRole('button', { name: 'Confirm delete' }).click()
		await expect(page).toHaveURL(/\/sessions$/)
		await page.goto(uploadUrl)
		await expect(page.getByText('That upload could not be found in your account.')).toBeVisible()
	})
})

test('the landing page link leaves its sandboxed frame and opens the workspace', async ({
	page
}) => {
	// The landing scene is heavy, and on a cold dev server so is compiling the route.
	test.setTimeout(LANDING_NAVIGATION_MS)
	await page.goto('/')
	const frame = page.locator('iframe[src="/landing-pages/kage.html"]')
	await expect(frame).toBeVisible()
	// KageLanding's effect sets this title and wires the frame's links.
	await expect(frame).toHaveAttribute('title', 'Dojo: train how you work with AI agents', {
		timeout: LANDING_NAVIGATION_MS
	})
	const link = page
		.frameLocator('iframe[src="/landing-pages/kage.html"]')
		.locator('a.arrowlink', { hasText: 'Why evidence matters' })
	await link.evaluate((element: HTMLElement) => element.click())
	// /sessions, which sends a signed-out visitor on to sign in.
	await page.waitForURL(/\/(sessions|sign-in)$/, { timeout: LANDING_NAVIGATION_MS })
})
