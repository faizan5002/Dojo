import { test, expect } from '@playwright/test'
import { loadSample } from '../src/features/sample/sample-session'
import messages from '../messages/en.json'
import {
	canUseAuth,
	createTestUser,
	deleteTestUser,
	logFile,
	signIn,
	type TestUser
} from './workspace-helpers'

// The BoardUI components Dojo adopted, tested in the real product flows: Tabs in the
// evidence explorer and the Modal as the delete-upload confirmation.
const FRONTEND_MODE = process.env.DOJO_DEV_FRONTEND_MODE === 'true'

const skillName = (id: string) =>
	(messages.Assessment.skills as Record<string, { name: string }>)[id]?.name ?? id

test.describe('evidence explorer tabs', () => {
	test('are a labelled tab list with a count each, and arrow keys move between skills', async ({
		page
	}) => {
		const { stored } = await loadSample()
		await page.goto('/sample/assessment')
		const list = page.getByRole('tablist', { name: 'Evidence explorer' })
		await expect(list).toBeVisible()
		const tabs = list.getByRole('tab')
		await expect(tabs).toHaveCount(5)
		for (const skill of stored.assessment.skills) {
			const tab = list.getByRole('tab', { name: new RegExp(`^${skillName(skill.skill)}`) })
			await expect(tab).toContainText(String(skill.evidence.length))
		}
		// Exactly one tab is selected and it owns the one visible panel.
		await expect(list.locator('[role="tab"][aria-selected="true"]')).toHaveCount(1)
		await expect(page.getByRole('tabpanel')).toHaveCount(1)
		const selected = list.locator('[role="tab"][aria-selected="true"]')
		const before = (await selected.textContent()) ?? ''
		// The tabs only respond once the page has hydrated, so retry the key press until it does.
		await expect(async () => {
			await selected.focus()
			await page.keyboard.press('ArrowRight')
			await expect(list.locator('[role="tab"][aria-selected="true"]')).not.toHaveText(before, {
				timeout: 1000
			})
		}).toPass({ timeout: 15_000 })
		// The panel now shows evidence that belongs to the newly selected skill.
		const panel = page.getByRole('tabpanel')
		await expect(panel).toBeVisible()
		await expect(panel.locator('blockquote').first()).toBeVisible()
	})

	test('keep the evidence-to-conversation link working inside a panel', async ({ page }) => {
		await page.goto('/sample/assessment')
		await page.getByRole('tabpanel').getByTestId('open-conversation').first().click()
		await expect(page).toHaveURL(/\/sample\/session\?session=.+&finding=/)
	})
})

test.describe('delete upload dialog', () => {
	test.skip(!canUseAuth || FRONTEND_MODE, 'needs real Supabase and the dev frontend mode off')
	let user: TestUser

	test.beforeAll(async () => {
		user = await createTestUser()
	})
	test.afterAll(async () => {
		await deleteTestUser(user)
	})

	test('asks in an alert dialog, can be cancelled, and only confirming deletes', async ({
		page
	}) => {
		await signIn(page, user)
		await page
			.getByLabel('Choose log files')
			.setInputFiles([
				logFile({ name: 'one.md', sessionId: 'dialog-one', prompts: ['Rename `a` to `b`'] })
			])
		await expect(page).toHaveURL(/\/sessions\?upload=/)
		const uploadUrl = page.url()
		const band = page.locator('section').filter({ has: page.getByLabel('Choose log files') })
		const open = band.getByRole('button', { name: 'Delete', exact: true })

		// Escape closes it, and nothing is deleted.
		await open.click()
		const dialog = page.getByRole('alertdialog')
		await expect(dialog).toBeVisible()
		await expect(dialog).toContainText('Delete this upload?')
		await expect(dialog.getByRole('button', { name: 'Confirm delete' })).toBeVisible()
		await page.keyboard.press('Escape')
		await expect(dialog).toHaveCount(0)
		await expect(page).toHaveURL(uploadUrl)

		// Cancel closes it too, and focus returns to the button that opened it.
		await open.click()
		await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
		await expect(dialog).toHaveCount(0)
		await expect(open).toBeFocused()
		await page.goto(uploadUrl)
		await expect(page.getByText('That upload could not be found')).toHaveCount(0)

		// Focus is held inside the dialog while it is open.
		await open.click()
		await page.keyboard.press('Tab')
		await page.keyboard.press('Tab')
		await page.keyboard.press('Tab')
		await page.keyboard.press('Tab')
		const inside = await page.evaluate(
			() =>
				document.querySelector('[role="alertdialog"]')?.contains(document.activeElement) ?? false
		)
		expect(inside).toBe(true)

		// Confirming deletes it.
		await dialog.getByRole('button', { name: 'Confirm delete' }).click()
		await expect(page).toHaveURL(/\/sessions$/)
		await page.goto(uploadUrl)
		await expect(page.getByText('That upload could not be found in your account.')).toBeVisible()
	})
})
