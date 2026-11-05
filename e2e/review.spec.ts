import { test, expect, type Page } from '@playwright/test'
import messages from '../messages/en.json'
import {
	buildPlan,
	chooseScenario,
	adjustDifficulty
} from '../src/features/practice/scenarios/plan'
import { SCENARIOS } from '../src/features/practice/scenarios/catalog'
import { buildSessionView } from '../src/features/review/session-view'
import { loadSample } from '../src/features/sample/sample-session'
import {
	canUseAuth,
	createTestUser,
	visit,
	deleteTestUser,
	logFile,
	signIn,
	type TestUser
} from './workspace-helpers'
import { STRONG_PROMPTS, WEAK_PROMPTS } from '../src/features/assessment/session-fixtures'

// The conversation viewer, the review marks, the notes and the scenario practice, on the
// public sample (no account, no database) and, where available, on a real account.
const FRONTEND_MODE = process.env.DOJO_DEV_FRONTEND_MODE === 'true'

const skillName = (id: string) =>
	(messages.Assessment.skills as Record<string, { name: string }>)[id]?.name ?? id

async function sampleView() {
	const { stored, sessions } = await loadSample()
	const session = sessions[0]
	if (session == null) throw new Error('the sample has no session')
	return { stored, view: buildSessionView(session, stored.assessment.skills) }
}

const marker = (page: Page, id: string) =>
	page.locator(`[data-testid="annotation"][data-finding="${id}"]`)
const railMarker = (page: Page, id: string) =>
	page.locator(`[data-testid="rail-marker"][data-finding="${id}"]`)
const card = (page: Page, id: string) =>
	page.locator(`[data-testid="finding-card"][data-finding="${id}"]`)
const toolbar = (page: Page) => page.getByRole('toolbar', { name: 'Conversation tools' })

test.describe('evidence to the original conversation (sample)', () => {
	test('"Open in the conversation" lands on the exact source of that evidence', async ({
		page
	}) => {
		const { stored } = await sampleView()
		const evidence = stored.assessment.skills
			.find((skill) => skill.skill === 'iteration')
			?.evidence.find((item) => item.polarity === 'opportunity')
		expect(evidence).toBeTruthy()
		await page.goto('/sample/assessment')
		const row = page.locator('#skill-iteration')
		await row.locator('summary').click()
		const link = row.getByTestId('open-conversation').first()
		await link.click()
		await expect(page).toHaveURL(/\/sample\/session\?session=.+&finding=/)
		const id = new URL(page.url()).searchParams.get('finding') ?? ''
		await expect(card(page, id)).toBeVisible()
		await expect(page.locator(`#src-${id}`)).toBeVisible()
		const text = (await page.locator(`#src-${id}`).textContent()) ?? ''
		const found = stored.assessment.skills
			.flatMap((skill) => skill.evidence)
			.find((item) => item.id === id)
		expect(found).toBeTruthy()
		// The highlighted words are the evidence's own quote.
		expect(found?.excerpt).toContain(text.trim())
		await expect(railMarker(page, id)).toHaveAttribute('aria-current', 'true')
	})

	test('Focus next opens its quote in the same conversation', async ({ page }) => {
		await page.goto('/sample/assessment')
		await page.getByTestId('focus-conversation').click()
		await expect(page).toHaveURL(/\/sample\/session\?session=.+&finding=/)
		const id = new URL(page.url()).searchParams.get('finding') ?? ''
		await expect(card(page, id)).toBeVisible()
		const { stored } = await sampleView()
		expect(stored.assessment.recommendations[0]?.evidenceId).toBe(id)
	})
})

test.describe('annotations and the findings rail (sample)', () => {
	test('shows the whole conversation in order, with every finding marked', async ({ page }) => {
		const { view } = await sampleView()
		await page.goto('/sample/session')
		await expect(page.getByTestId('conversation').locator('> li')).toHaveCount(view.turns.length)
		await expect(page.getByTestId('annotation')).toHaveCount(view.findings.length)
		await expect(page.getByTestId('rail-marker')).toHaveCount(view.findings.length)
		// Icon, not colour alone: every marker carries a severity icon and a text label.
		const first = page.getByTestId('annotation').first()
		await expect(first.locator('svg').first()).toBeVisible()
		await expect(first).toHaveAttribute('aria-label', /Opportunity|Strength/)
	})

	test('hovering a marker previews it, and selecting opens the four-part explanation', async ({
		page
	}) => {
		const { view } = await sampleView()
		const target = view.findings.find((finding) => finding.polarity === 'opportunity')
		expect(target).toBeTruthy()
		const id = target?.id ?? ''
		await page.goto('/sample/session')
		await marker(page, id).hover()
		await expect(page.getByTestId('annotation-preview')).toBeVisible()
		await marker(page, id).click()
		const open = card(page, id)
		await expect(open).toBeVisible()
		for (const heading of [
			'Evidence from the conversation',
			'What the assessment identified',
			'Why it matters',
			'What to do differently'
		]) {
			await expect(open.getByRole('heading', { name: heading })).toBeVisible()
		}
		await expect(open.locator('blockquote').first()).toHaveText(target?.excerpt ?? '')
		await expect(page.getByTestId('annotation-preview')).toHaveCount(0)
	})

	test('several explanations can stay open at once, and only the active connector shows', async ({
		page
	}) => {
		const { view } = await sampleView()
		const [a, b] = view.findings
		expect(a && b).toBeTruthy()
		await page.goto('/sample/session')
		await marker(page, a?.id ?? '').click()
		await marker(page, b?.id ?? '').click()
		await expect(card(page, a?.id ?? '')).toBeVisible()
		await expect(card(page, b?.id ?? '')).toBeVisible()
		await expect(page.getByTestId('finding-card')).toHaveCount(2)
		await expect(railMarker(page, b?.id ?? '')).toHaveAttribute('aria-current', 'true')
		await expect(railMarker(page, a?.id ?? '')).not.toHaveAttribute('aria-current', 'true')
		await expect(page.getByTestId('connector')).toHaveCount(1)
		await card(page, a?.id ?? '')
			.getByRole('button', { name: 'Collapse' })
			.click()
		await expect(page.getByTestId('finding-card')).toHaveCount(1)
	})

	test('previous and next move through the findings, scrolling to and highlighting each source', async ({
		page
	}) => {
		const { view } = await sampleView()
		await page.goto('/sample/session')
		await toolbar(page).getByRole('button', { name: 'Next finding' }).click()
		await expect(railMarker(page, view.findings[0]?.id ?? '')).toHaveAttribute(
			'aria-current',
			'true'
		)
		await toolbar(page).getByRole('button', { name: 'Next finding' }).click()
		await expect(railMarker(page, view.findings[1]?.id ?? '')).toHaveAttribute(
			'aria-current',
			'true'
		)
		await toolbar(page).getByRole('button', { name: 'Previous finding' }).click()
		await expect(railMarker(page, view.findings[0]?.id ?? '')).toHaveAttribute(
			'aria-current',
			'true'
		)
		// Selecting from the rail scrolls the source into view and opens its card.
		const last = view.findings[view.findings.length - 1]
		await railMarker(page, last?.id ?? '').click()
		await expect(card(page, last?.id ?? '')).toBeVisible()
		await expect(page.locator(`#src-${last?.id}`)).toBeInViewport()
	})

	test('hides the rail completely, and the toolbar reopens it at the selected finding', async ({
		page
	}) => {
		const { view } = await sampleView()
		const target = view.findings[3]
		await visit(page, '/sample/session')
		await railMarker(page, target?.id ?? '').click()
		await toolbar(page).getByRole('button', { name: 'Hide findings' }).click()
		await expect(page.getByTestId('rail')).toHaveCount(0)
		await expect(page.getByTestId('connector')).toHaveCount(0)
		await page.getByTestId('show-rail').click()
		await expect(page.getByTestId('rail')).toBeVisible()
		await expect(railMarker(page, target?.id ?? '')).toHaveAttribute('aria-current', 'true')
		// The choice is remembered in this browser.
		await toolbar(page).getByRole('button', { name: 'Hide findings' }).click()
		await page.reload()
		await expect(page.getByTestId('rail')).toHaveCount(0)
	})
})

test.describe('review tracking (sample)', () => {
	test('opening a finding does not mark it reviewed; only the button does, and it stays', async ({
		page
	}) => {
		const { view } = await sampleView()
		const id = view.findings[0]?.id ?? ''
		await page.goto('/sample/session')
		const progress = page.getByTestId('review-progress')
		await expect(progress).toHaveText(`0 of ${view.findings.length} reviewed`)
		await marker(page, id).click()
		await expect(card(page, id)).toBeVisible()
		await expect(progress).toHaveText(`0 of ${view.findings.length} reviewed`)
		await card(page, id).getByRole('button', { name: 'Mark as reviewed' }).click()
		await expect(progress).toHaveText(`1 of ${view.findings.length} reviewed`)
		await expect(card(page, id).getByRole('status')).toContainText('Reviewed')
		// Collapse and reopen: still reviewed. Reload: still reviewed.
		await card(page, id).getByRole('button', { name: 'Collapse' }).click()
		await marker(page, id).click()
		await expect(card(page, id).getByRole('status')).toContainText('Reviewed')
		await page.reload()
		await expect(progress).toHaveText(`1 of ${view.findings.length} reviewed`)
	})

	test('when every finding is reviewed, it says so and offers practice without leaving', async ({
		page
	}) => {
		const { view } = await sampleView()
		await page.goto('/sample/session')
		const startUrl = page.url()
		for (let index = 0; index < view.findings.length; index++) {
			await toolbar(page).getByRole('button', { name: 'Next finding' }).click()
			const id = view.findings[index]?.id ?? ''
			await card(page, id).getByRole('button', { name: 'Mark as reviewed' }).click()
		}
		const done = page.getByTestId('review-complete')
		await expect(done).toBeVisible()
		await expect(done).toContainText(`All ${view.findings.length} findings reviewed`)
		await expect(done.getByRole('link', { name: 'Start targeted practice' })).toHaveAttribute(
			'href',
			/\/sample\/practice\/session$/
		)
		expect(page.url()).toBe(startUrl.includes('?') ? page.url() : startUrl)
		await expect(page).toHaveURL(/\/sample\/session/)
	})
})

test.describe('personal notes (sample)', () => {
	test('can be written, counted, timestamped and kept in this browser only', async ({ page }) => {
		await page.goto('/sample/session')
		const button = page.getByTestId('notes-button')
		await expect(button).toContainText('Notes (0)')
		await button.click()
		const drawer = page.getByTestId('notes-drawer')
		await expect(drawer).toContainText('never saved to an account')
		await drawer
			.getByRole('textbox', { name: 'New note' })
			.fill('Ask for the expected result next time.')
		await drawer.getByRole('button', { name: 'Add note' }).click()
		await expect(button).toContainText('Notes (1)')
		await expect(drawer.getByTestId('notes-list').locator('li')).toHaveCount(1)
		await expect(drawer.locator('time')).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}T/)
		await expect(drawer).toContainText('Ask for the expected result next time.')
		await page.reload()
		await expect(page.getByTestId('notes-button')).toContainText('Notes (1)')
		await page.keyboard.press('Escape')
	})

	test('sample notes never write to the server', async ({ page }) => {
		const writes: string[] = []
		page.on('request', (request) => {
			if (request.method() !== 'GET' && request.method() !== 'HEAD') writes.push(request.url())
		})
		await page.goto('/sample/session')
		await page.getByTestId('notes-button').click()
		await page.getByRole('textbox', { name: 'New note' }).fill('only in this tab')
		await page.getByRole('button', { name: 'Add note' }).click()
		const first = page.getByTestId('annotation').first()
		await first.click()
		await page.getByRole('button', { name: 'Mark as reviewed' }).first().click()
		expect(writes).toEqual([])
	})
})

test.describe('on a phone (sample)', () => {
	test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

	test('puts the explanation under its source, with a sticky bar for progress and navigation', async ({
		page
	}) => {
		const { view } = await sampleView()
		await page.goto('/sample/session')
		await expect(page.getByTestId('rail')).toBeHidden()
		const bar = page.getByTestId('mobile-bar')
		await expect(bar).toBeVisible()
		await expect(page.getByTestId('mobile-current')).toHaveText('No finding selected')
		await bar.getByRole('button', { name: 'Next finding' }).click()
		await expect(page.getByTestId('mobile-current')).toHaveText(
			`Finding 1 of ${view.findings.length}`
		)
		await expect(bar).toContainText(`0 of ${view.findings.length} reviewed`)
		const first = view.findings[0]
		// The explanation sits inside the same turn as its source, directly below it.
		const turn = page.locator(`[data-prompt="${first?.promptNumber}"]`)
		await expect(
			turn.locator(`[data-testid="finding-card"][data-finding="${first?.id}"]`)
		).toBeVisible()
		// Tapping an annotation opens it (no hover on touch).
		const second = view.findings[1]
		await marker(page, second?.id ?? '').tap()
		await expect(card(page, second?.id ?? '')).toBeVisible()
		await card(page, second?.id ?? '')
			.getByRole('button', { name: 'Mark as reviewed' })
			.tap()
		await expect(bar).toContainText(`1 of ${view.findings.length} reviewed`)
		// The bar stays in view while scrolling, and the page does not overflow sideways.
		await page.evaluate(() => window.scrollBy(0, 600))
		await expect(bar).toBeInViewport()
		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth - window.innerWidth
		)
		expect(overflow).toBeLessThanOrEqual(0)
		// Notes still work: the button clears the bar and the drawer fills the width.
		await page.getByTestId('notes-button').tap()
		await expect(page.getByTestId('notes-drawer')).toBeVisible()
		await page.getByRole('textbox', { name: 'New note' }).fill('on my phone')
		await page.getByRole('button', { name: 'Add note' }).tap()
		await expect(page.getByTestId('notes-list').locator('li')).toHaveCount(1)
	})
})

test.describe('scenario practice (sample)', () => {
	test('is built from the assessment weaknesses and starts at once', async ({ page }) => {
		const { stored } = await sampleView()
		const plan = buildPlan(stored.assessment)
		expect(plan).not.toBeNull()
		await page.goto('/sample/practice/session')
		await expect(page.getByTestId('scenario-session')).toBeVisible()
		await expect(page.getByTestId('scenario-count')).toContainText('Scenario 1 of 5')
		const weakest = plan?.skills[0]?.skill ?? ''
		await expect(page.getByTestId('scenario-count')).toContainText(skillName(weakest))
		await expect(page.getByText('Authored scenarios, not AI.', { exact: false })).toBeVisible()
		await expect(page.getByTestId('answer-card')).toHaveCount(3)
	})

	test('asks for confirmation before showing any evaluation, with no live score or timer', async ({
		page
	}) => {
		await page.goto('/sample/practice/session')
		await expect(page.getByTestId('coaching')).toHaveCount(0)
		await expect(page.getByTestId('confirm-step')).toHaveCount(0)
		await page.getByTestId('answer-card').first().click()
		await expect(page.getByTestId('confirm-step')).toBeVisible()
		await expect(page.getByTestId('coaching')).toHaveCount(0)
		const body = (await page.locator('main').innerText()).toLowerCase()
		expect(body).not.toMatch(/\d+\s?%|timer|seconds left|score:/)
		await page.getByRole('textbox', { name: /why/i }).fill('It seemed the clearest')
		await page.getByRole('button', { name: 'Confirm answer' }).click()
		const coaching = page.getByTestId('coaching')
		await expect(coaching).toBeVisible()
		for (const heading of [
			'What you chose',
			'Why it matters',
			'A better approach',
			'Practical takeaway'
		]) {
			await expect(coaching.getByText(heading, { exact: true })).toBeVisible()
		}
		await expect(coaching).toContainText('It seemed the clearest')
		await expect(coaching.getByText(/effective|did not work|Partly/).first()).toBeVisible()
	})

	test('adapts: an effective answer raises the next scenario for that skill, and completes with a summary', async ({
		page
	}) => {
		const { stored } = await sampleView()
		const plan = buildPlan(stored.assessment)
		expect(plan).not.toBeNull()
		if (plan == null) return
		await page.goto('/sample/practice/session')

		// Replay the choices on the data layer to know which scenario to expect each time.
		const levels: Record<string, 1 | 2 | 3> = Object.fromEntries(
			plan.skills.map((each) => [each.skill, each.start])
		)
		const used: string[] = []
		const expectedTitles: string[] = []
		for (let slot = 0; slot < plan.slots.length; slot++) {
			const skill = plan.slots[slot]
			if (skill == null) return
			const entry = plan.skills.find((each) => each.skill === skill)
			const scenario = chooseScenario({
				skill,
				difficulty: levels[skill] as 1 | 2 | 3,
				preferred: entry?.preferred ?? null,
				used
			})
			expect(scenario).not.toBeNull()
			if (scenario == null) return
			used.push(scenario.id)
			expectedTitles.push(scenario.title)
			await expect(page.getByRole('heading', { level: 2 }).first()).toHaveText(scenario.title)
			// Always choose the effective answer.
			const effective = scenario.options.find((option) => option.quality === 'effective')
			await page
				.getByTestId('answer-card')
				.filter({ hasText: effective?.label ?? '' })
				.click()
			await page.getByRole('button', { name: 'Confirm answer' }).click()
			await expect(page.getByTestId('coaching')).toHaveAttribute('data-quality', 'effective')
			levels[skill] = adjustDifficulty(levels[skill] as 1 | 2 | 3, 'effective')
			await page.getByTestId('continue').click()
		}
		const summary = page.getByTestId('practice-summary')
		await expect(summary).toBeVisible()
		await expect(summary.getByTestId('summary-row')).toHaveCount(plan.slots.length)
		await expect(summary).toContainText('does not show lasting improvement')
		await expect(summary).toContainText('not a new score')
		for (const title of expectedTitles) await expect(summary).toContainText(title)
		await expect(summary.getByRole('link', { name: 'Back to the assessment' })).toHaveAttribute(
			'href',
			'/sample/assessment'
		)
		expect(new Set(expectedTitles).size).toBe(plan.slots.length)
		expect(SCENARIOS.length).toBeGreaterThanOrEqual(plan.slots.length)
	})

	test('keeps the rewrite drill and its entry points', async ({ page }) => {
		await page.goto('/sample/assessment')
		await expect(page.getByTestId('focus-scenarios')).toHaveAttribute(
			'href',
			/\/sample\/practice\/session$/
		)
		await page.getByRole('link', { name: 'Try a rewrite drill' }).click()
		await expect(page).toHaveURL(/\/sample\/practice$/)
		await expect(page.getByTestId('to-scenarios')).toHaveAttribute(
			'href',
			/\/sample\/practice\/session$/
		)
		await page.getByRole('textbox', { name: 'Your rewrite' }).fill('ok')
		await page.getByRole('button', { name: 'Check my rewrite' }).click()
		await expect(page.getByTestId('drill-result')).toHaveAttribute('data-verdict', 'notEvaluable')
	})
})

test.describe('protected pages stay protected', () => {
	test('the conversation and practice session need an account', async ({ page }) => {
		test.skip(FRONTEND_MODE, 'frontend dev mode is on')
		for (const path of [
			'/assessment/session?id=00000000-0000-4000-8000-000000000001',
			'/practice/session'
		]) {
			await page.goto(path)
			await expect(page).toHaveURL(/\/sign-in$/)
		}
	})
})

test.describe('with the dev sample account', () => {
	test.skip(!FRONTEND_MODE, 'set DOJO_DEV_FRONTEND_MODE=true for the dev server to run these')

	test('Focus next, the assessment and the conversation connect for a signed-in view', async ({
		page
	}) => {
		await visit(page, '/dashboard')
		await expect(page.getByTestId('heatmap')).toBeVisible()
		await page.getByTestId('focus-conversation').click()
		await expect(page).toHaveURL(/\/assessment\/session\?id=.+&session=.+&finding=/)
		const id = new URL(page.url()).searchParams.get('finding') ?? ''
		await expect(card(page, id)).toBeVisible()
		await expect(page.getByTestId('annotation').first()).toBeVisible()
		await page.goto('/practice/session')
		await expect(page.getByTestId('scenario-session')).toBeVisible()
	})

	test('notes made in the sample do not appear in the signed-in conversation, or the reverse', async ({
		page
	}) => {
		await page.goto('/sample/session')
		await page.getByTestId('notes-button').click()
		await page.getByRole('textbox', { name: 'New note' }).fill('sample-only note')
		await page.getByRole('button', { name: 'Add note' }).click()
		await expect(page.getByTestId('notes-button')).toContainText('Notes (1)')
		await page.goto('/dashboard')
		await page.getByTestId('focus-conversation').click()
		await expect(page.getByTestId('notes-button')).toContainText('Notes (0)')
		await page.getByTestId('notes-button').click()
		await page.getByRole('textbox', { name: 'New note' }).fill('account-view note')
		await page.getByRole('button', { name: 'Add note' }).click()
		await page.goto('/sample/session')
		await expect(page.getByTestId('notes-button')).toContainText('Notes (1)')
		await page.getByTestId('notes-button').click()
		await expect(page.getByTestId('notes-list')).not.toContainText('account-view note')
	})
})

test.describe('with real accounts', () => {
	test.skip(!canUseAuth || FRONTEND_MODE, 'needs real Supabase and the dev frontend mode off')
	// Each of these signs in, uploads and scores more than once, so they need more than the default.
	test.describe.configure({ timeout: 240_000 })
	let alice: TestUser
	let bob: TestUser

	test.beforeAll(async () => {
		alice = await createTestUser()
		bob = await createTestUser()
	})
	test.afterAll(async () => {
		await deleteTestUser(alice)
		await deleteTestUser(bob)
	})

	async function upload(page: Page) {
		await visit(page, '/sessions')
		await page
			.getByLabel('Choose log files')
			.setInputFiles([
				logFile({ name: 'strong.md', sessionId: 'strong-session', prompts: STRONG_PROMPTS }),
				logFile({ name: 'weak.md', sessionId: 'weak-session', prompts: WEAK_PROMPTS })
			])
		await expect(page).toHaveURL(/\/sessions\?upload=/)
		await visit(page, '/sessions')
		await page.getByRole('link', { name: 'Score my workflow' }).click()
		await page.getByRole('button', { name: 'Analyze my workflow' }).click()
		await expect(page).toHaveURL(/\/assessment\?id=/)
		return new URL(page.url()).searchParams.get('id') ?? ''
	}

	test('notes and review marks do not leak between users, and another account cannot open the conversation', async ({
		page
	}) => {
		await signIn(page, alice)
		const aliceAssessment = await upload(page)
		await visit(page, `/assessment/session?id=${aliceAssessment}`)
		await expect(page.getByTestId('annotation').first()).toBeVisible()
		await page.getByTestId('notes-button').click()
		await page.getByRole('textbox', { name: 'New note' }).fill('alice private note')
		await page.getByRole('button', { name: 'Add note' }).click()
		await page.getByTestId('annotation').first().click()
		await page.getByRole('button', { name: 'Mark as reviewed' }).first().click()
		await expect(page.getByTestId('notes-button')).toContainText('Notes (1)')
		await expect(page.getByTestId('review-progress')).toContainText(/^1 of /)

		await page.context().clearCookies()
		await signIn(page, bob)
		// Same browser, different user: bob sees none of it, even at alice's address.
		const response = await visit(page, `/assessment/session?id=${aliceAssessment}`)
		expect(response?.status()).toBe(404)
		const bobAssessment = await upload(page)
		await visit(page, `/assessment/session?id=${bobAssessment}`)
		await expect(page.getByTestId('notes-button')).toContainText('Notes (0)')
		await expect(page.getByTestId('review-progress')).toContainText(/^0 of /)
	})

	test('two real accounts in one browser keep their notes and review marks apart, through real sign-out and sign-in', async ({
		page,
		browser
	}) => {
		const progress = (n: number | RegExp) =>
			page
				.getByTestId('review-progress')
				.filter({ hasText: typeof n === 'number' ? new RegExp(`^${n} of `) : n })
		const addNote = async (text: string) => {
			await page.getByTestId('notes-button').click()
			await page.getByRole('textbox', { name: 'New note' }).fill(text)
			await page.getByRole('button', { name: 'Add note' }).click()
			await page.keyboard.press('Escape')
		}
		const noteTexts = async () => {
			await page.getByTestId('notes-button').click()
			const text = await page.getByTestId('notes-list').innerText()
			await page.keyboard.press('Escape')
			return text
		}
		const signOutThroughTheApp = async () => {
			await visit(page, '/sessions')
			await page.getByRole('button', { name: 'Sign out' }).click()
			await expect(page).not.toHaveURL(/\/sessions/)
			// The session is really gone: a protected page now asks for sign-in.
			await visit(page, '/dashboard')
			await expect(page).toHaveURL(/\/sign-in$/)
		}
		const signInThroughTheForm = async (user: TestUser) => {
			await visit(page, '/sign-in')
			await page.getByLabel('Email').fill(user.email)
			await page.getByLabel('Password').fill(user.password)
			await page.getByRole('button', { name: 'Sign in' }).click()
			await expect(page).toHaveURL(/\/sessions/, { timeout: 60_000 })
		}

		// Bob's assessment is prepared in a separate browser context; this browser only ever
		// holds what Alice and Bob do in it.
		const prep = await browser.newContext()
		const prepPage = await prep.newPage()
		await signIn(prepPage, bob)
		const bobAssessment = await upload(prepPage)
		await prep.close()

		// --- Alice reviews and takes notes ---
		await signIn(page, alice)
		const aliceAssessment = await upload(page)
		await visit(page, `/assessment/session?id=${aliceAssessment}`)
		const first = page.getByTestId('annotation').first()
		const aliceFinding = (await first.getAttribute('data-finding')) ?? ''
		await first.click()
		await card(page, aliceFinding).getByRole('button', { name: 'Mark as reviewed' }).click()
		await addNote('alice private note')
		await expect(page.getByTestId('notes-button')).toContainText('Notes (1)')
		await expect(progress(1)).toBeVisible()

		// A sample note and mark made while signed in belong to the sample, not to Alice's account.
		await visit(page, '/sample/session')
		await page.getByTestId('annotation').first().click()
		await page.getByRole('button', { name: 'Mark as reviewed' }).first().click()
		await addNote('sample note')
		await expect(progress(1)).toBeVisible()

		// --- Alice signs out; nothing is exposed, even on refresh ---
		await signOutThroughTheApp()
		for (const path of [`/assessment/session?id=${aliceAssessment}`, '/practice/session']) {
			await visit(page, path)
			await expect(page).toHaveURL(/\/sign-in$/)
			await page.reload()
			await expect(page).toHaveURL(/\/sign-in$/)
			await expect(page.locator('body')).not.toContainText('alice private note')
		}

		// --- Bob signs in: none of Alice's data, then his own ---
		await signInThroughTheForm(bob)
		const denied = await page.goto(`/assessment/session?id=${aliceAssessment}`)
		expect(denied?.status()).toBe(404)
		await visit(page, `/assessment/session?id=${bobAssessment}`)
		await expect(page.getByTestId('annotation').first()).toBeVisible()
		await expect(page.getByTestId('notes-button')).toContainText('Notes (0)')
		await expect(progress(0)).toBeVisible()
		await page.reload()
		await expect(page.getByTestId('notes-button')).toContainText('Notes (0)')
		expect(await noteTexts()).not.toMatch(/alice|sample note/)
		await expect(page.getByTestId('notes-drawer')).toHaveCount(0)

		const bobFirst = page.getByTestId('annotation').first()
		const bobFinding = (await bobFirst.getAttribute('data-finding')) ?? ''
		await bobFirst.click()
		await card(page, bobFinding).getByRole('button', { name: 'Mark as reviewed' }).click()
		await page.getByTestId('annotation').nth(1).click()
		await page.getByRole('button', { name: 'Mark as reviewed' }).first().click()
		await addNote('bob first note')
		await addNote('bob second note')
		await expect(page.getByTestId('notes-button')).toContainText('Notes (2)')
		await expect(progress(2)).toBeVisible()
		await page.reload()
		await expect(page.getByTestId('notes-button')).toContainText('Notes (2)')
		const bobNotes = await noteTexts()
		expect(bobNotes).toContain('bob first note')
		expect(bobNotes).not.toMatch(/alice|sample note/)

		// --- The sample is the same for everyone, and holds neither account's notes ---
		await visit(page, '/sample/session')
		await expect(page.getByTestId('notes-button')).toContainText('Notes (1)')
		const sampleNotes = await noteTexts()
		expect(sampleNotes).toContain('sample note')
		expect(sampleNotes).not.toMatch(/alice|bob/)
		await expect(progress(1)).toBeVisible()

		// --- Bob signs out; Alice signs back in and finds exactly her own data ---
		await signOutThroughTheApp()
		await signInThroughTheForm(alice)
		await visit(page, `/assessment/session?id=${aliceAssessment}`)
		await expect(page.getByTestId('notes-button')).toContainText('Notes (1)')
		await expect(progress(1)).toBeVisible()
		const aliceNotes = await noteTexts()
		expect(aliceNotes).toContain('alice private note')
		expect(aliceNotes).not.toMatch(/bob|sample note/)
		await page.getByTestId(`annotation`).first().click()
		await expect(
			card(page, aliceFinding).getByRole('status').filter({ hasText: 'Reviewed' })
		).toBeVisible()
		await page.reload()
		await expect(page.getByTestId('notes-button')).toContainText('Notes (1)')
		await expect(progress(1)).toBeVisible()
		expect(await noteTexts()).not.toMatch(/bob/)

		// Bob's conversation is not Alice's to open, and she did not change Bob's data.
		const deniedToAlice = await page.goto(`/assessment/session?id=${bobAssessment}`)
		expect(deniedToAlice?.status()).toBe(404)
	})

	test('the signed-in conversation, review, notes and practice session work end to end', async ({
		page
	}) => {
		await signIn(page, alice)
		const id = await upload(page)
		await visit(page, `/assessment?id=${id}`)
		const evidenceLink = page.getByTestId('open-conversation').first()
		await evidenceLink.scrollIntoViewIfNeeded().catch(() => undefined)
		await visit(page, `/dashboard`)
		await page.getByTestId('focus-conversation').click()
		await expect(page).toHaveURL(/\/assessment\/session\?id=.+&session=.+&finding=/)
		const findingId = new URL(page.url()).searchParams.get('finding') ?? ''
		await expect(card(page, findingId)).toBeVisible()
		await card(page, findingId).getByRole('button', { name: 'Mark as reviewed' }).click()
		await expect(card(page, findingId).getByRole('status')).toContainText('Reviewed')
		await visit(page, `/practice/session?assessment=${id}`)
		await expect(page.getByTestId('scenario-session')).toBeVisible()
		await page.getByTestId('answer-card').first().click()
		await page.getByRole('button', { name: 'Confirm answer' }).click()
		await expect(page.getByTestId('coaching')).toBeVisible()
	})
})
