import { test, expect, type Request } from '@playwright/test'
import { buildLog, prompt, response } from '../src/features/sessions/log-fixture'

// A string that appears only inside the uploaded files. If it ever shows up in
// a request or on the page, log content left the browser tab or was rendered.
const CANARY = 'canary-7f3e9b1d-not-for-the-network'
// The root layout loads Vercel Web Analytics on every page. It is the one
// third party allowed here, and the canary checks still apply to it.
const ANALYTICS_SCRIPT_ORIGIN = 'https://va.vercel-scripts.com'

function logFile(name: string, sessionId: string) {
	const text = buildLog({
		sessionId,
		entries: [
			prompt('2026-11-01T10:00:00.000Z', `Fix the flaky test in src/app/page.tsx ${CANARY}`),
			response('2026-11-01T10:02:00.000Z', 'Done: the test now waits for the frame.'),
			prompt('2026-11-01T10:05:00.000Z', 'Now run the suite'),
			response('2026-11-01T10:06:00.000Z', 'All green.')
		]
	})
	return { name, mimeType: 'text/markdown', buffer: Buffer.from(text) }
}

test('reads session logs in the browser and shows free metrics without sending them', async ({
	page,
	baseURL
}) => {
	const requests: Request[] = []
	page.on('request', (request) => requests.push(request))

	await page.goto('/sessions')
	await expect(page.getByRole('heading', { level: 1, name: 'Your sessions' })).toBeVisible()

	await page
		.getByLabel('Choose log files')
		.setInputFiles([
			logFile('one.md', 'session-one'),
			logFile('two.md', 'session-two'),
			logFile('copy-of-two.md', 'session-two'),
			{ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not a log') }
		])

	const overview = page.getByRole('region', { name: 'Across your sessions' })
	await expect(overview.getByText('Sessions', { exact: true })).toBeVisible()
	await expect(overview.locator('dd').first()).toHaveText('2')
	await expect(page.getByRole('table').getByRole('row')).toHaveCount(1 + 2)
	await expect(page.getByText('Not a Markdown (.md) file.')).toBeVisible()
	await expect(page.getByText('Another file holds a newer copy of this session.')).toBeVisible()

	await expect(page.getByText(CANARY)).toHaveCount(0)
	const origin = new URL(baseURL ?? '').origin
	for (const request of requests) {
		const requestOrigin = new URL(request.url()).origin
		expect([origin, ANALYTICS_SCRIPT_ORIGIN], `unexpected request to ${request.url()}`).toContain(
			requestOrigin
		)
		expect(request.postData() ?? '').not.toContain(CANARY)
		expect(request.url()).not.toContain(CANARY)
	}

	await page.getByRole('button', { name: 'Clear' }).click()
	await expect(page.getByRole('table')).toHaveCount(0)
})

test('the landing page still renders its frame', async ({ page }) => {
	await page.goto('/')
	await expect(page.locator('iframe[src="/landing-pages/kage.html"]')).toBeVisible()
})
