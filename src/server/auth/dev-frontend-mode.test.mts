import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { DEV_MOCK_USER, isDevFrontendMode, isDevMockUser } from './dev-frontend-mode'

describe('development frontend mode guard', () => {
	test('is on only with the explicit flag outside production', () => {
		assert.equal(
			isDevFrontendMode({ NODE_ENV: 'development', DOJO_DEV_FRONTEND_MODE: 'true' }),
			true
		)
		assert.equal(isDevFrontendMode({ NODE_ENV: 'test', DOJO_DEV_FRONTEND_MODE: 'true' }), true)
	})

	test('is never on implicitly', () => {
		for (const flag of [undefined, '', 'false', '0', '1', 'TRUE', 'yes', ' true']) {
			assert.equal(
				isDevFrontendMode({ NODE_ENV: 'development', DOJO_DEV_FRONTEND_MODE: flag }),
				false,
				`flag ${JSON.stringify(flag)}`
			)
		}
		assert.equal(isDevFrontendMode({ NODE_ENV: 'development' }), false)
	})

	test('is rejected in production even with the flag set', () => {
		assert.equal(
			isDevFrontendMode({ NODE_ENV: 'production', DOJO_DEV_FRONTEND_MODE: 'true' }),
			false
		)
	})

	test('reads the process environment by default, so a production process rejects it', () => {
		const before = { node: process.env.NODE_ENV, flag: process.env.DOJO_DEV_FRONTEND_MODE }
		try {
			Object.assign(process.env, { NODE_ENV: 'production', DOJO_DEV_FRONTEND_MODE: 'true' })
			assert.equal(isDevFrontendMode(), false)
			Object.assign(process.env, { NODE_ENV: 'development' })
			assert.equal(isDevFrontendMode(), true)
		} finally {
			for (const [key, value] of [
				['NODE_ENV', before.node],
				['DOJO_DEV_FRONTEND_MODE', before.flag]
			] as const) {
				if (value == null) delete process.env[key]
				else process.env[key] = value
			}
		}
	})
})

describe('the mock user', () => {
	const on = { NODE_ENV: 'development', DOJO_DEV_FRONTEND_MODE: 'true' }

	test('is obviously fake', () => {
		assert.match(DEV_MOCK_USER.email, /\.invalid$/)
		assert.match(DEV_MOCK_USER.name, /^Frontend dev/)
		assert.match(DEV_MOCK_USER.id, /^00000000-0000-4000-8000-/)
	})

	test('is recognised only in frontend mode', () => {
		assert.equal(isDevMockUser({ id: DEV_MOCK_USER.id }, on), true)
		assert.equal(isDevMockUser({ id: DEV_MOCK_USER.id }, { NODE_ENV: 'development' }), false)
		assert.equal(isDevMockUser({ id: DEV_MOCK_USER.id }, { ...on, NODE_ENV: 'production' }), false)
	})

	test('never matches a real user or no user', () => {
		assert.equal(isDevMockUser({ id: '11111111-1111-4111-8111-111111111111' }, on), false)
		assert.equal(isDevMockUser(null, on), false)
	})
})
