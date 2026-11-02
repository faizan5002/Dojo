import { randomUUID } from 'node:crypto'
import { test, expect } from '@playwright/test'
import {
	canUseAuth,
	createTestUser,
	deleteTestUser,
	formAlert,
	signIn,
	type TestUser
} from './workspace-helpers'

test('the workspace pages send a signed-out visitor to sign in', async ({ page }) => {
	for (const path of ['/sessions', '/assessment', '/account']) {
		await page.goto(path)
		await expect(page).toHaveURL(/\/sign-in$/)
	}
})

test.describe('accounts', () => {
	test.skip(!canUseAuth, 'Supabase is not configured for this server')
	let user: TestUser

	test.beforeAll(async () => {
		user = await createTestUser()
	})
	test.afterAll(async () => {
		await deleteTestUser(user)
	})

	test('a wrong password is refused without saying which part was wrong', async ({ page }) => {
		await page.goto('/sign-in')
		await page.getByLabel('Email').fill(user.email)
		await page.getByLabel('Password').fill('not-the-password')
		await page.getByRole('button', { name: 'Sign in' }).click()
		await expect(formAlert(page)).toHaveText('Email or password is incorrect.')
		await expect(page).toHaveURL(/\/sign-in$/)
	})

	test('an email that already has an account cannot sign up again', async ({ page }) => {
		await page.goto('/sign-up')
		await page.getByLabel('Email').fill(user.email)
		await page.getByLabel('Password').fill(`pw-${randomUUID()}`)
		await page.getByRole('button', { name: 'Create account' }).click()
		await expect(formAlert(page)).toHaveText(/already exists/)
	})

	test('a short password is refused at sign-up', async ({ page }) => {
		await page.goto('/sign-up')
		await page.getByLabel('Email').fill(`e2e-${randomUUID()}@example.com`)
		await page.getByLabel('Password').fill('short')
		await page.getByRole('button', { name: 'Create account' }).click()
		await expect(formAlert(page)).toHaveText(/at least 10 characters/)
	})

	test('signing in opens the workspace, and signing out closes it', async ({ page }) => {
		await signIn(page, user)
		await expect(page.getByRole('heading', { level: 1, name: 'Your sessions' })).toBeVisible()
		await page.getByRole('button', { name: 'Sign out' }).click()
		await expect(page).toHaveURL(/\/$/)
		await page.goto('/sessions')
		await expect(page).toHaveURL(/\/sign-in$/)
	})
})

test.describe('account deletion', () => {
	test.skip(!canUseAuth, 'Supabase is not configured for this server')

	test('deleting the account removes the sign-in as well as the data', async ({ page }) => {
		const user = await createTestUser()
		try {
			await signIn(page, user)
			await page.goto('/account')
			await page.getByLabel('Confirm with your email').fill('someone-else@example.com')
			await page.getByRole('button', { name: 'Delete my account and data' }).click()
			await expect(formAlert(page)).toHaveText(/doesn't match/)
			await page.getByLabel('Confirm with your email').fill(user.email)
			await page.getByRole('button', { name: 'Delete my account and data' }).click()
			await expect(page).toHaveURL(/\/$/)
			await page.goto('/sign-in')
			await page.getByLabel('Email').fill(user.email)
			await page.getByLabel('Password').fill(user.password)
			await page.getByRole('button', { name: 'Sign in' }).click()
			await expect(formAlert(page)).toHaveText('Email or password is incorrect.')
		} finally {
			await deleteTestUser(user).catch(() => undefined)
		}
	})
})
