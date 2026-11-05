import { test, expect, type Page } from '@playwright/test'
import messages from '../messages/en.json'
import { STRONG_PROMPTS, WEAK_PROMPTS } from '../src/features/assessment/session-fixtures'
import { buildDashboard } from '../src/features/dashboard/dashboard-model'
import {
	DEV_ASSESSMENTS,
	DEV_UPLOADS,
	devAssessment,
	devUploadView
} from '../src/features/dev-frontend/fixtures'
import {
	canUseAuth,
	createTestUser,
	deleteTestUser,
	logFile,
	signIn,
	visit,
	type TestUser
} from './workspace-helpers'

// The fixture-backed specs run only against a dev server started with
// DOJO_DEV_FRONTEND_MODE=true. The real-account ones run either way.
const FRONTEND_MODE = process.env.DOJO_DEV_FRONTEND_MODE === 'true'

const skillName = (id: string) =>
	(messages.Assessment.skills as Record<string, { name: string }>)[id]?.name ?? id
const levelName = (id: string) =>
	(messages.Assessment.proficiency as Record<string, string>)[id] ?? id

const views = DEV_UPLOADS.flatMap((upload) => {
	const view = devUploadView(upload.id)
	return view == null ? [] : [view]
})
const valid = devAssessment(DEV_ASSESSMENTS[0]?.id)
const expected = buildDashboard({
	uploads: DEV_UPLOADS,
	assessments: DEV_ASSESSMENTS,
	newest: valid,
	valid,
	previous: devAssessment(DEV_ASSESSMENTS[1]?.id),
	validUploadView: devUploadView(valid?.uploadId ?? ''),
	recentUploadViews: views
})
const focus = expected.focus?.kind === 'ready' ? expected.focus : null

const region = (page: Page, name: string) => page.getByRole('region', { name })

test.describe('dashboard with fixture data', () => {
	test.skip(!FRONTEND_MODE, 'set DOJO_DEV_FRONTEND_MODE=true for the dev server to run these')

	test('leads with the coaching: skill, score, evidence level, quote, recommendation, one action', async ({
		page
	}) => {
		expect(focus).not.toBeNull()
		await page.goto('/dashboard')
		const block = region(page, 'Focus next')
		await expect(block.getByRole('heading', { level: 3 })).toHaveText(
			new RegExp(skillName(focus?.skill ?? ''), 'i')
		)
		await expect(block.getByTestId('focus-score')).toHaveText(String(focus?.score))
		await expect(block).toContainText(/Limited evidence|Strong evidence/)
		await expect(block.locator('blockquote')).toContainText(focus?.quote.excerpt ?? '')
		await expect(block).toContainText(focus?.quote.sessionId ?? '')
		await expect(block).toContainText('Practise this')
		// One primary action (the evidence), then the quote in its conversation, targeted
		// practice and the rewrite drill on the same habit.
		await expect(block.getByRole('link')).toHaveCount(5)
		await expect(block.getByRole('link', { name: 'See evidence' })).toBeVisible()
		await expect(block.getByRole('link', { name: 'Try a rewrite drill' })).toBeVisible()
		await expect(block.getByRole('link', { name: 'Open in the conversation' })).toBeVisible()
		await expect(block.getByRole('link', { name: 'Start targeted practice' })).toBeVisible()
	})

	test('the coaching block is in the first screen at desktop and phone widths', async ({
		page
	}) => {
		for (const [width, height] of [
			[1440, 900],
			[390, 844]
		] as const) {
			await page.setViewportSize({ width, height })
			await page.goto('/dashboard')
			// Coaching leads: Focus next sits right under the hero, above the demo bands, so its
			// heading is in the first screen (a quarter-screen of slack on a phone, where the hero
			// stacks tall).
			const heading = region(page, 'Focus next').getByRole('heading', { name: 'Focus next' })
			const box = await heading.boundingBox()
			expect(box, `Focus next heading at ${width}px`).not.toBeNull()
			expect((box?.y ?? 9999) + (box?.height ?? 0)).toBeLessThan(height * (width < 768 ? 1.25 : 1))
			const band = await region(page, 'Training status').boundingBox()
			expect(band?.y ?? 0).toBeGreaterThan(box?.y ?? 0)
		}
	})

	test('the order is performance, coaching, skills, then progress and sessions', async ({
		page
	}) => {
		for (const width of [390, 1440]) {
			await page.setViewportSize({ width, height: 900 })
			await page.goto('/dashboard')
			const tops: number[] = []
			for (const name of [
				'Your performance',
				'Focus next',
				'Skills',
				'Your progress',
				'Recent sessions'
			]) {
				const box = await region(page, name).boundingBox()
				tops.push(box?.y ?? Number.NaN)
			}
			// Performance first, the coaching right under it, the five skills, then the history.
			expect(tops[0]).toBeLessThan(tops[1] ?? 0)
			expect(tops[1]).toBeLessThan(tops[2] ?? 0)
			expect(tops[2]).toBeLessThan(tops[3] ?? 0)
			if (width === 390) expect(tops[3]).toBeLessThan(tops[4] ?? 0)
			// On a wide screen progress and recent sessions sit side by side.
			else expect(Math.abs((tops[3] ?? 0) - (tops[4] ?? 0))).toBeLessThan(24)
		}
	})

	test('shows the score with its basis, and the five skills with the fixture values', async ({
		page
	}) => {
		await page.goto('/dashboard')
		await expect(page.getByTestId('dashboard-score')).toHaveText(String(expected.valid?.score))
		const performance = region(page, 'Your performance')
		await expect(performance).toContainText(
			`Based on ${expected.valid?.sessions} sessions and ${expected.valid?.prompts} prompts.`
		)
		const skills = region(page, 'Skills')
		await expect(skills.getByRole('link')).toHaveCount(5)
		for (const row of expected.skills) {
			const name = `${skillName(row.skill)}, ${row.score}, ${levelName(row.proficiency ?? '')}. See evidence`
			await expect(skills.getByRole('link', { name })).toBeVisible()
		}
		await expect(skills.getByText('Focus', { exact: true })).toHaveCount(1)
	})

	test('does not repeat itself: one link to the latest assessment, one upload action', async ({
		page
	}) => {
		await page.goto('/dashboard')
		await expect(page.locator(`main a[href="/assessment?id=${expected.valid?.id}"]`)).toHaveCount(1)
		await expect(page.getByRole('link', { name: 'Upload sessions', exact: true })).toHaveCount(1)
		for (const gone of [
			'Strongest skill',
			'Biggest opportunity',
			'Skills by level',
			'Assessments run'
		]) {
			await expect(page.getByText(gone, { exact: true })).toHaveCount(0)
		}
	})

	test('uncertain changes are muted and explained, never alarming, and never "First assessment"', async ({
		page
	}) => {
		await page.goto('/dashboard')
		expect(expected.valid?.comparison.status).toBe('provisional')
		await expect(page.getByTestId('comparison-text')).toContainText('Provisional')
		await expect(page.locator('main .text-danger')).toHaveCount(0)
		await expect(page.getByText('First assessment')).toHaveCount(0)
	})

	test('the top navigation navigates and marks the current page', async ({ page }) => {
		await page.goto('/dashboard')
		const nav = page.getByRole('navigation', { name: 'Workspace' })
		await expect(nav.getByRole('link', { name: /Dashboard/ })).toHaveAttribute(
			'aria-current',
			'page'
		)
		for (const [name, path] of [
			['Sessions', /\/sessions$/],
			['Assessment', /\/assessment$/],
			['Account', /\/account$/],
			['Dashboard', /\/dashboard$/]
		] as const) {
			await nav.getByRole('link', { name }).click()
			await expect(page).toHaveURL(path)
			await expect(nav.getByRole('link', { name })).toHaveAttribute('aria-current', 'page')
		}
	})

	test('See evidence opens the skill evidence in the assessment the quote came from', async ({
		page
	}) => {
		await visit(page, '/dashboard')
		await expect(page.getByTestId('heatmap')).toBeVisible()
		await region(page, 'Focus next').getByRole('link', { name: 'See evidence' }).click()
		await expect(page).toHaveURL(
			new RegExp(`/assessment\\?id=${expected.valid?.id}#skill-${focus?.skill}$`)
		)
		const skill = page.locator(`#skill-${focus?.skill}`)
		await expect(skill).toBeVisible()
		await skill.getByText(/^Evidence \(\d+\)$/).click()
		await expect(
			skill.locator('blockquote').filter({ hasText: focus?.quote.excerpt ?? '' })
		).toHaveCount(1)
	})

	test('a skill row opens that skill’s evidence', async ({ page }) => {
		await visit(page, '/dashboard')
		await expect(page.getByTestId('heatmap')).toBeVisible()
		const row = expected.skills[1]
		await region(page, 'Skills')
			.getByRole('link', { name: new RegExp(`^${skillName(row?.skill ?? '')},`) })
			.click()
		await expect(page).toHaveURL(new RegExp(`#skill-${row?.skill}$`))
		await expect(page.locator(`#skill-${row?.skill}`)).toBeVisible()
	})

	test('earlier assessments open the right assessment', async ({ page }) => {
		for (const [index, summary] of expected.earlier.entries()) {
			await visit(page, '/dashboard')
			await expect(page.getByTestId('heatmap')).toBeVisible()
			await region(page, 'Your progress').getByRole('listitem').nth(index).getByRole('link').click()
			await expect(page).toHaveURL(new RegExp(`/assessment\\?id=${summary.id}$`))
			await expect(page.getByTestId('overall-score')).toHaveText(String(summary.score))
		}
	})

	test('upload and session links go to the existing flows', async ({ page }) => {
		await visit(page, '/dashboard')
		await expect(page.getByTestId('heatmap')).toBeVisible()
		await page.getByRole('link', { name: 'Upload sessions', exact: true }).click()
		await expect(page).toHaveURL(/\/sessions$/)

		await visit(page, '/dashboard')
		await expect(page.getByTestId('heatmap')).toBeVisible()
		const row = expected.recentSessions[0]
		await region(page, 'Recent sessions')
			.getByRole('link')
			.filter({ hasText: row?.sessionId ?? '' })
			.click()
		await expect(page).toHaveURL(new RegExp(`/sessions\\?upload=${row?.uploadId}$`))
	})

	test('landmarks are named', async ({ page }) => {
		await page.goto('/dashboard')
		await expect(page.getByRole('banner', { name: 'Page header' })).toBeVisible()
		await expect(page.getByRole('navigation', { name: 'Workspace' })).toBeVisible()
	})

	test('keyboard: the skip link works and every focus stop has the same visible ring', async ({
		page
	}) => {
		await visit(page, '/dashboard')
		await expect(page.getByTestId('heatmap')).toBeVisible()
		await page.keyboard.press('Tab')
		await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused()
		await page.keyboard.press('Enter')
		await expect(page).toHaveURL(/#workspace-content$/)

		await page.goto('/dashboard')
		const rings = new Set<string>()
		const stops = new Set<string>()
		for (let press = 0; press < 40; press++) {
			await page.keyboard.press('Tab')
			const info = await page.evaluate(() => {
				const el = document.activeElement
				if (el == null || el.closest('[data-surface="app"]') == null) return null
				const style = getComputedStyle(el)
				return {
					key: `${el.tagName}:${el.getAttribute('href') ?? el.textContent?.slice(0, 20)}`,
					ring: `${style.outlineWidth} ${style.outlineStyle} ${style.outlineColor}`
				}
			})
			if (info != null) {
				stops.add(info.key)
				rings.add(info.ring)
			}
		}
		expect(stops.size).toBeGreaterThan(15)
		expect([...rings]).toEqual(['2px solid rgb(192, 48, 28)'])
	})

	test('the vermilion numerals pass AA contrast', async ({ page }) => {
		await page.goto('/sessions')
		const ratio = await page.evaluate(() => {
			const channel = (v: number) => {
				const c = v / 255
				return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
			}
			const luminance = ([r = 0, g = 0, b = 0]: number[]) =>
				0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
			const rgb = (value: string) => (value.match(/\d+(\.\d+)?/g) ?? []).map(Number)
			const numeral = document.querySelector('.app-eyebrow b')
			const surface = document.querySelector('[data-surface="app"]')
			if (numeral == null || surface == null) return 0
			const [light = 0, dark = 0] = [
				luminance(rgb(getComputedStyle(numeral).color)),
				luminance(rgb(getComputedStyle(surface).backgroundColor))
			].sort((a, b) => b - a)
			return (light + 0.05) / (dark + 0.05)
		})
		expect(ratio).toBeGreaterThanOrEqual(4.5)
	})

	for (const [name, width, height] of [
		['phone', 390, 844],
		['tablet', 768, 1024],
		['laptop', 1024, 768],
		['desktop', 1440, 900]
	] as const) {
		test(`fits a ${name} screen, keeps every nav action reachable and tappable`, async ({
			page
		}) => {
			await page.setViewportSize({ width, height })
			await page.goto('/dashboard')
			await expect(page.getByTestId('dashboard-score')).toBeVisible()
			const overflow = await page.evaluate(
				() => document.documentElement.scrollWidth - document.documentElement.clientWidth
			)
			expect(overflow, `overflow at ${width}px`).toBeLessThanOrEqual(0)
			const nav = page.getByRole('navigation', { name: 'Workspace' })
			if (width < 768) {
				// A phone gets the app frame: four tabs along the bottom edge. Sessions and
				// upload sit in the header, account and sign out on the profile screen.
				for (const label of ['Dojo', 'Train', 'Progress', 'Profile']) {
					const tab = nav.getByRole('link', { name: label })
					await expect(tab).toBeVisible()
					const box = await tab.boundingBox()
					expect(box?.height ?? 0).toBeGreaterThanOrEqual(43.5)
				}
				for (const target of [
					page.getByRole('link', { name: 'Upload sessions', exact: true }),
					...(await region(page, 'Your performance').getByRole('link').all())
				]) {
					const box = await target.boundingBox()
					expect(box?.height ?? 0).toBeGreaterThanOrEqual(43.5)
				}
				return
			}
			for (const label of ['Dashboard', 'Sessions', 'Assessment', 'Account']) {
				await expect(nav.getByRole('link', { name: label })).toBeVisible()
			}
			await expect(nav.getByRole('button', { name: 'Sign out' })).toBeVisible()
		})
	}
})

test.describe('dashboard for real accounts', () => {
	test.skip(!canUseAuth, 'Supabase is not configured for this server')
	test.describe.configure({ mode: 'serial' })
	let user: TestUser
	let other: TestUser

	test.beforeAll(async () => {
		user = await createTestUser()
		other = await createTestUser()
	})
	test.afterAll(async () => {
		await deleteTestUser(user)
		await deleteTestUser(other)
	})

	const upload = async (page: Page, files: ReturnType<typeof logFile>[]) => {
		await page.goto('/sessions')
		await page.getByLabel('Choose log files').setInputFiles(files)
		await expect(page).toHaveURL(/\/sessions\?upload=/)
	}
	const score = async (page: Page) => {
		await page.goto('/sessions')
		await page.getByRole('link', { name: 'Score my workflow' }).click()
		await page.getByRole('button', { name: 'Analyze my workflow' }).click()
		await expect(page).toHaveURL(/\/assessment\?id=/)
	}
	const tiny = () => logFile({ name: 'tiny.md', sessionId: 'tiny', prompts: ['Fix the bug.'] })
	const strongWeak = () => [
		logFile({ name: 'strong.md', sessionId: 'strong-session', prompts: STRONG_PROMPTS }),
		logFile({ name: 'weak.md', sessionId: 'weak-session', prompts: WEAK_PROMPTS })
	]

	test('empty account: what Dojo does, what uploading gives, one obvious action', async ({
		page
	}) => {
		await signIn(page, user)
		await page.goto('/dashboard')
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Welcome to Dojo')
		await expect(
			page.getByRole('heading', { name: 'Practise from your own sessions' })
		).toBeVisible()
		// The demo progression band has its own lists; count only the empty-state steps.
		await expect(page.locator('main > :not([aria-label="Training status"]) li')).toHaveCount(3)
		await expect(region(page, 'Focus next')).toHaveCount(0)
		await expect(region(page, 'Your performance')).toHaveCount(0)
		const action = page.getByRole('link', { name: 'Upload sessions', exact: true })
		await expect(action).toHaveCount(1)
		await action.click()
		await expect(page).toHaveURL(/\/sessions$/)
	})

	test('uploaded but unscored: scoring is primary, uploading is secondary, no metrics', async ({
		page
	}) => {
		await signIn(page, user)
		await upload(page, strongWeak())
		await page.goto('/dashboard')
		await expect(page.getByRole('heading', { name: 'Score your latest upload' })).toBeVisible()
		const primary = page.getByRole('link', { name: 'Score latest upload' })
		await expect(primary).toHaveClass(/app-pill/)
		const secondary = page.getByRole('link', { name: 'Upload more sessions' })
		await expect(secondary).toHaveClass(/app-nav-link/)
		await expect(region(page, 'Your performance')).toHaveCount(0)
		await expect(region(page, 'Skills')).toHaveCount(0)
		await primary.click()
		await expect(page).toHaveURL(/\/assessment\?upload=/)
	})

	test('first scored assessment: score and basis, and no pretence of an earlier one', async ({
		page
	}) => {
		await signIn(page, user)
		await score(page)
		await page.goto('/dashboard')
		await expect(region(page, 'Focus next')).toBeVisible()
		await expect(region(page, 'Focus next').locator('blockquote')).toBeVisible()
		await expect(region(page, 'Your performance')).toContainText(
			'Based on 2 sessions and 15 prompts.'
		)
		await expect(page.getByTestId('comparison-text')).toHaveText(
			'No earlier scored assessment to compare with yet.'
		)
		await expect(page.getByText('First assessment')).toHaveCount(0)
		await expect(page.locator('main .text-danger, main .text-success')).toHaveCount(0)
		await expect(region(page, 'Your progress')).toContainText('Score again after your next session')
	})

	test('a newer upload that cannot be scored does not replace the last scored coaching', async ({
		page
	}) => {
		await signIn(page, user)
		await upload(page, [tiny()])
		await score(page)
		await page.goto('/dashboard')
		await expect(region(page, 'Focus next').locator('blockquote')).toBeVisible()
		await expect(page.getByText(/had too little evidence to score/)).toBeVisible()
		await expect(page.getByRole('link', { name: 'See why' })).toBeVisible()
		await expect(page.getByTestId('comparison-text')).toContainText('No earlier scored assessment')
	})

	test('insufficient evidence: one explanation with the real thresholds, not five repeats', async ({
		page
	}) => {
		await signIn(page, other)
		await upload(page, [tiny()])
		await score(page)
		await page.goto('/dashboard')
		await expect(
			page.getByRole('heading', { name: 'Not enough evidence to score yet' })
		).toBeVisible()
		await expect(page.getByText(/not enough evidence/i)).toHaveCount(1)
		await expect(page.getByText(/at least 3 of the five skills/)).toBeVisible()
		const needs = page.getByRole('heading', { name: 'What each skill needs' }).locator('xpath=..')
		await expect(needs.getByRole('listitem')).toHaveCount(5)
		await expect(needs).toContainText('of 3 requests')
		await expect(needs).toContainText('of 2 larger builds')
		await expect(page.getByRole('link', { name: 'Upload sessions', exact: true })).toHaveClass(
			/app-pill/
		)
		await expect(region(page, 'Focus next')).toHaveCount(0)
	})
})
