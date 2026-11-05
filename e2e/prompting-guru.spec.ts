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

const PHONE = { width: 390, height: 844 }
// Verification is the weakest; promptClarity is in the same band only if
// the tie-break were wrong, so it is kept well above.
const SCORES = {
	promptClarity: 70,
	planning: 65,
	verification: 22,
	iteration: 68,
	scopeControl: 85
}
const WEAK_ANSWER = 'Looks good, ship it.'
// A cold dev server compiles each route, and each endpoint, on first use.
const FIRST_COMPILE_MS = 60_000
const API = '/api/prompting-guru'

const definitionOf = (slug: string) => CHALLENGE_DEFINITIONS.find((each) => each.slug === slug)

async function uploadAndScore(page: Page, sessionId: string): Promise<string> {
	await page.goto('/sessions')
	await page
		.getByLabel('Choose log files')
		.setInputFiles([logFile({ name: `${sessionId}.md`, sessionId, prompts: STRONG_PROMPTS })])
	await expect(page).toHaveURL(/\/sessions\?upload=/)
	await page.getByRole('link', { name: 'Score my workflow' }).click()
	await page.getByRole('button', { name: 'Analyze my workflow' }).click()
	await expect(page).toHaveURL(/\/assessment\?id=/)
	return new URL(page.url()).searchParams.get('id') ?? ''
}

/** Pins the stored skill scores, so the recommendation under test is known. */
async function setSkillScores(assessmentId: string, scores: Record<string, number | null>) {
	const db = new PrismaClient()
	try {
		for (const [skill, score] of Object.entries(scores)) {
			await db.skillAssessment.updateMany({ where: { assessmentId, skill }, data: { score } })
		}
	} finally {
		await db.$disconnect()
	}
}

async function submit(page: Page, answer: string): Promise<number> {
	await page.getByLabel('Your prompt').fill(answer)
	await page.getByRole('button', { name: 'Submit for scoring' }).click()
	await expect(page).toHaveURL(/\?attempt=/, { timeout: FIRST_COMPILE_MS })
	return Number(await page.getByTestId('guru-score').textContent())
}

async function expectNoOverflow(page: Page) {
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - window.innerWidth
	)
	expect(overflow).toBe(0)
}

const cards = (page: Page) => page.getByTestId('guru-challenge-card')

test('a signed-out visit is sent to sign in, and the API answers 401', async ({
	page,
	request
}) => {
	await page.goto('/prompting-guru')
	await expect(page).toHaveURL(/\/sign-in/)
	expect((await request.get(`${API}/challenges`)).status()).toBe(401)
	expect((await request.get(`${API}/challenges/clarity-login-api`)).status()).toBe(401)
	expect(
		(
			await request.post(`${API}/challenges/clarity-login-api/submit`, {
				data: { answer: 'An answer.' }
			})
		).status()
	).toBe(401)
})

test.describe('Prompting Guru', () => {
	test.skip(!canUseAuth, 'Supabase is not configured for this server')
	test.describe.configure({ mode: 'serial' })
	let owner: TestUser
	let newcomer: TestUser
	let stranger: TestUser
	let attemptUrl = ''

	test.beforeAll(async () => {
		// The library is read from the database; make sure it is there.
		const db = new PrismaClient()
		try {
			await seedChallenges({ db, definitions: CHALLENGE_DEFINITIONS })
		} finally {
			await db.$disconnect()
		}
		;[owner, newcomer, stranger] = await Promise.all([
			createTestUser(),
			createTestUser(),
			createTestUser()
		])
	})
	test.afterAll(async () => {
		await Promise.all([deleteTestUser(owner), deleteTestUser(newcomer), deleteTestUser(stranger)])
	})

	test('without an assessment, it onboards and offers a labelled general exercise', async ({
		page
	}) => {
		await signIn(page, newcomer)
		await page.getByRole('link', { name: 'Prompting Guru' }).click()
		await expect(page).toHaveURL(/\/prompting-guru$/, { timeout: FIRST_COMPILE_MS })
		const onboarding = page.getByTestId('guru-onboarding')
		await expect(onboarding).toBeVisible()
		await expect(onboarding.getByRole('link', { name: 'Upload session logs' })).toBeVisible()
		await expect(onboarding.getByRole('link', { name: 'Go to assessment' })).toBeVisible()
		await expect(page.getByTestId('guru-next')).toContainText('It is not personalized')
		await expect(page.getByText('No attempts yet.')).toBeVisible()
		for (const skill of Object.keys(SCORES)) {
			await expect(page.getByTestId(`guru-skill-${skill}`)).toContainText('Not scored')
		}
	})

	test('with fewer than three scored skills, it says it cannot rank reliably', async ({ page }) => {
		await signIn(page, newcomer)
		const assessmentId = await uploadAndScore(page, 'guru-limited')
		await setSkillScores(assessmentId, {
			promptClarity: 30,
			planning: null,
			verification: null,
			iteration: 75,
			scopeControl: null
		})
		await page.goto('/prompting-guru')
		await expect(page.getByTestId('guru-limited')).toBeVisible()
		await expect(page.getByTestId('guru-onboarding')).toHaveCount(0)
		// An unscored skill is shown as such, never as a zero.
		await expect(page.getByTestId('guru-skill-verification')).toContainText('Not scored')
		await expect(page.getByTestId('guru-next')).toContainText('Prompt clarity')
	})

	test('the weakest skill is recommended, scored, retried, and both attempts kept', async ({
		page
	}) => {
		await signIn(page, owner)
		await setSkillScores(await uploadAndScore(page, 'guru-owner'), SCORES)

		await page.goto('/prompting-guru')
		await expect(page.getByTestId('guru-onboarding')).toHaveCount(0)
		await expect(page.getByTestId('guru-limited')).toHaveCount(0)
		const next = page.getByTestId('guru-next')
		await expect(next).toContainText('Verifying AI output')
		await expect(next).toContainText('one of the skills your assessment scored lowest')
		await expect(page.getByTestId('guru-skill-verification')).toContainText('Focus')
		await next.getByRole('link', { name: 'Start this challenge' }).click()
		await expect(page).toHaveURL(/\/prompting-guru\/challenges\/verification-/, {
			timeout: FIRST_COMPILE_MS
		})
		await expect(page.getByText('Version 1')).toBeVisible()

		const challenge = definitionOf(new URL(page.url()).pathname.split('/').pop() ?? '')
		expect(challenge?.skill).toBe('verification')
		// The answer key is not in the page before an attempt.
		expect(await page.content()).not.toContain(challenge?.exemplar.slice(0, 60))
		await expect(page.getByTestId('guru-exemplar')).toHaveCount(0)

		const first = await submit(page, WEAK_ANSWER)
		const result = page.getByTestId('guru-result')
		await expect(result).toContainText('not your workflow assessment')
		await expect(result).toContainText('How it was scored')
		await expect(result).toContainText('Missing')
		await expect(page.getByTestId('guru-suggestion')).toContainText(WEAK_ANSWER)
		await expect(page.getByTestId('guru-exemplar')).toContainText(
			challenge?.exemplar.slice(0, 60) ?? '\u0000'
		)
		expect(first).toBeLessThan(40)

		await page.getByRole('link', { name: 'Try again' }).click()
		await expect(page.getByTestId('guru-exemplar')).toHaveCount(0)
		const second = await submit(page, challenge?.exemplar ?? '')
		expect(second).toBeGreaterThan(first)
		attemptUrl = page.url()

		const history = page.getByTestId('guru-history').getByRole('listitem')
		await expect(history).toHaveCount(2)
		await expect(history.first()).toContainText(`Attempt 2 · ${second}`)
		await expect(history.first()).toContainText('Latest')
		await expect(history.nth(1)).toContainText(`Attempt 1 · ${first}`)
		await history.nth(1).getByRole('link', { name: 'Open' }).click()
		await expect(page.getByTestId('guru-score')).toHaveText(String(first))
	})

	test('the overview shows the new progress, apart from the assessment score', async ({ page }) => {
		await signIn(page, owner)
		await page.goto('/prompting-guru')
		const summary = page.getByRole('region', { name: 'Your practice' })
		await expect(summary).toContainText('Attempts2')
		await expect(summary).toContainText('Challenges tried1')
		const verification = page.getByTestId('guru-skill-verification')
		await expect(verification.getByTestId('assessment')).toContainText('22')
		await expect(verification.getByTestId('practice')).toContainText('2 attempts')
		await expect(
			page.getByRole('region', { name: 'Recent attempts' }).getByRole('listitem')
		).toHaveCount(2)
		// The challenge just done is not offered again straight away.
		const done = new URL(attemptUrl).pathname.split('/').pop() ?? ''
		await expect(
			page.getByTestId('guru-next').getByRole('link', { name: 'Start this challenge' })
		).not.toHaveAttribute('href', new RegExp(`${done}$`))
	})

	test('the library loads from the API, and filters, searches and pages', async ({ page }) => {
		await signIn(page, owner)
		await page.goto('/prompting-guru/challenges')
		await expect(page.getByText('40 challenges')).toBeVisible({ timeout: FIRST_COMPILE_MS })
		await expect(cards(page)).toHaveCount(12)
		await expect(page.getByText('Page 1 of 4')).toBeVisible()

		await page.getByRole('button', { name: 'Next', exact: true }).click()
		await expect(page).toHaveURL(/page=2/)
		await expect(page.getByText('Page 2 of 4')).toBeVisible()

		await page.getByLabel('Skill').selectOption({ label: 'Planning before coding' })
		await page.getByRole('button', { name: 'Apply' }).click()
		await expect(page).toHaveURL(/skill=planning/)
		await expect(page).not.toHaveURL(/page=2/)
		await expect(cards(page)).toHaveCount(8)
		for (const text of await cards(page).allTextContents()) {
			expect(text).toContain('Planning before coding')
		}

		await page.getByLabel('Difficulty').selectOption({ label: 'Advanced' })
		await page.getByRole('button', { name: 'Apply' }).click()
		await expect(cards(page)).toHaveCount(2)

		await page.getByRole('link', { name: 'Clear filters' }).click()
		await page.getByLabel('Search').fill('webhook')
		await page.getByRole('button', { name: 'Apply' }).click()
		await expect(page).toHaveURL(/search=webhook/)
		await expect(
			cards(page).filter({ hasText: 'Plan a payment flow across services' })
		).toHaveCount(1)

		await page.getByLabel('Search').fill('nothing matches this')
		await page.getByRole('button', { name: 'Apply' }).click()
		await expect(page.getByTestId('guru-library-empty')).toHaveText(
			'No challenges match these filters.'
		)

		// The weakest skill's recommended challenge is marked in the library.
		await page.goto('/prompting-guru/challenges?skill=verification')
		await expect(cards(page)).toHaveCount(8)
		await expect(page.getByText('Recommended next')).toHaveCount(1)

		await page.goto('/prompting-guru/challenges?type=controlScope')
		await expect(cards(page)).toHaveCount(8)
		await cards(page).first().getByRole('link', { name: 'Start this challenge' }).click()
		await expect(page).toHaveURL(/\/prompting-guru\/challenges\/scope-/, {
			timeout: FIRST_COMPILE_MS
		})
		await expect(page.getByLabel('Your prompt')).toBeVisible()
	})

	test('the library shows its loading and error states, and recovers', async ({ page }) => {
		await signIn(page, owner)
		let failNext = true
		await page.route(`**${API}/challenges?*`, async (route) => {
			if (failNext) {
				failNext = false
				await new Promise((resolve) => setTimeout(resolve, 800))
				await route.fulfill({ status: 500, json: { error: 'Something went wrong.' } })
				return
			}
			await route.continue()
		})
		await page.goto('/prompting-guru/challenges')
		await expect(page.getByText('Loading challenges…')).toBeVisible()
		const error = page.getByTestId('guru-library-error')
		await expect(error).toContainText("The challenges couldn't be loaded.")
		await error.getByRole('button', { name: 'Try again' }).click()
		await expect(cards(page)).toHaveCount(12)

		await page.goto('/prompting-guru/challenges?difficulty=impossible')
		await expect(page.getByTestId('guru-library-error')).toContainText(
			'Those filters are not valid.'
		)
	})

	test('a submission that fails keeps the answer, and an expired session says so', async ({
		page
	}) => {
		await signIn(page, owner)
		await page.goto('/prompting-guru/challenges/scope-remember-me')
		const answer = 'Add only a remember me checkbox, and change nothing else in the form.'
		await page.route(`**${API}/challenges/*/submit`, (route) =>
			route.fulfill({ status: 401, json: { error: 'Your session has expired.' } })
		)
		await page.getByLabel('Your prompt').fill(answer)
		await page.getByRole('button', { name: 'Submit for scoring' }).click()
		await expect(page.getByText('Your session has expired.')).toBeVisible()
		await expect(page.getByRole('link', { name: 'Sign in again' })).toBeVisible()
		await expect(page.getByLabel('Your prompt')).toHaveValue(answer)

		await page.unroute(`**${API}/challenges/*/submit`)
		await page.route(`**${API}/challenges/*/submit`, (route) =>
			route.fulfill({ status: 500, json: { error: 'Something went wrong.' } })
		)
		await page.getByRole('button', { name: 'Submit for scoring' }).click()
		await expect(page.getByText("Your answer couldn't be scored.")).toBeVisible()
		await expect(page.getByLabel('Your prompt')).toHaveValue(answer)
	})

	test('the API: details without answers, scored submissions, and private history', async ({
		page
	}) => {
		await signIn(page, owner)
		const api = page.request

		const planning = await (await api.get(`${API}/challenges?skill=planning&pageSize=50`)).json()
		expect(planning.total).toBe(8)
		expect(planning.items.every((each: { skill: string }) => each.skill === 'planning')).toBe(true)
		expect((await api.get(`${API}/challenges?skill=cooking`)).status()).toBe(400)
		expect((await api.get(`${API}/challenges?pageSize=500`)).status()).toBe(400)

		const login = definitionOf('clarity-login-api')
		const detailResponse = await api.get(`${API}/challenges/clarity-login-api`)
		expect(detailResponse.status()).toBe(200)
		const detail = await detailResponse.json()
		expect(detail).toMatchObject({ slug: 'clarity-login-api', version: 1, skill: 'promptClarity' })
		const raw = JSON.stringify(detail)
		expect(raw).not.toContain(login?.exemplar.slice(0, 40))
		expect(raw).not.toContain('criteria')
		expect((await api.get(`${API}/challenges/no-such-challenge`)).status()).toBe(404)

		const submitted = await api.post(`${API}/challenges/clarity-login-api/submit`, {
			data: { answer: login?.exemplar }
		})
		expect(submitted.status()).toBe(201)
		const attempt = await submitted.json()
		expect(attempt.score).toBe(100)
		expect(attempt.challengeVersion).toBe(1)
		expect(attempt.example.answer).toBe(login?.exemplar)
		expect(
			(
				await api.post(`${API}/challenges/clarity-login-api/submit`, { data: { answer: '' } })
			).status()
		).toBe(400)
		expect(
			(
				await api.post(`${API}/challenges/no-such-challenge/submit`, {
					data: { answer: 'An answer.' }
				})
			).status()
		).toBe(404)

		const mine = await (await api.get(`${API}/challenges/clarity-login-api/attempts`)).json()
		expect(mine.items.map((each: { id: string }) => each.id)).toContain(attempt.id)
		const one = await api.get(`${API}/attempts/${attempt.id}`)
		expect(one.status()).toBe(200)
		const overview = await (await api.get(`${API}/overview`)).json()
		expect(overview.summary.attemptCount).toBe(3)

		await page.context().clearCookies()
		await signIn(page, stranger)
		expect((await page.request.get(`${API}/attempts/${attempt.id}`)).status()).toBe(404)
		const theirs = await (
			await page.request.get(`${API}/challenges/clarity-login-api/attempts`)
		).json()
		expect(theirs.items).toEqual([])
	})

	test('every challenge in the library opens, takes an answer, and shows its result', async ({
		page
	}) => {
		test.setTimeout(240_000)
		await signIn(page, newcomer)
		for (const challenge of CHALLENGE_DEFINITIONS) {
			const exercise = await page.goto(`/prompting-guru/challenges/${challenge.slug}`)
			expect(exercise?.status(), challenge.slug).toBe(200)
			await expect(page.getByRole('heading', { level: 1 })).toContainText(challenge.title)
			await expect(page.getByLabel('Your prompt')).toBeVisible()

			const submitted = await page.request.post(`${API}/challenges/${challenge.slug}/submit`, {
				data: { answer: challenge.exemplar }
			})
			expect(submitted.status(), challenge.slug).toBe(201)
			const attempt = await submitted.json()
			expect(attempt.score, `${challenge.slug} scored its own strong answer`).toBe(100)

			const result = await page.goto(
				`/prompting-guru/challenges/${challenge.slug}?attempt=${attempt.id}`
			)
			expect(result?.status(), challenge.slug).toBe(200)
			await expect(page.getByTestId('guru-score')).toHaveText('100')
			await expect(page.getByTestId('guru-exemplar')).toBeVisible()
		}
	})

	test("another account's attempt is not found", async ({ page }) => {
		await signIn(page, stranger)
		const response = await page.goto(attemptUrl)
		expect(response?.status()).toBe(404)
		await page.goto('/prompting-guru')
		await expect(page.getByText('No attempts yet.')).toBeVisible()
	})

	test('an unknown challenge or a malformed attempt id is not found', async ({ page }) => {
		await signIn(page, owner)
		expect((await page.goto('/prompting-guru/challenges/no-such-challenge'))?.status()).toBe(404)
		const malformed = `${new URL(attemptUrl).pathname}?attempt=not-a-uuid`
		expect((await page.goto(malformed))?.status()).toBe(404)
	})

	test('the overview, the library and a result fit a phone screen', async ({ page }) => {
		await signIn(page, owner)
		await page.setViewportSize(PHONE)
		await page.goto('/prompting-guru')
		await expect(page.getByTestId('guru-next')).toBeVisible()
		await expectNoOverflow(page)
		await page.goto('/prompting-guru/challenges')
		await expect(cards(page).first()).toBeVisible()
		await expectNoOverflow(page)
		await page.goto(attemptUrl)
		await expect(page.getByTestId('guru-score')).toBeVisible()
		await expectNoOverflow(page)
	})
})
