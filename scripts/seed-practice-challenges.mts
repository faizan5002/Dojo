// Seeds the Prompting Guru challenge library. Safe to re-run: unchanged
// challenges are left alone, edited ones become new versions, and nothing is
// deleted. Run it after `prisma migrate deploy`, in every environment:
//
//   pnpm db:seed:practice                  DIRECT_URL, else DATABASE_URL
//   pnpm db:seed:practice --db-url <url>
//
// Locally it also reads .env.local. Like run-once-sql.mjs it prefers the
// direct URL, since each challenge is written in a transaction. Prints counts
// only, never the connection string.

import { PrismaClient } from '@prisma/client'
import { CHALLENGE_DEFINITIONS } from '../prisma/seed/practice-challenges/index.ts'
import { seedChallenges } from '../src/features/practice/seed-challenges.ts'

try {
	process.loadEnvFile('.env.local')
} catch {
	// No .env.local (CI): the environment already holds the URL.
}

const flag = process.argv.indexOf('--db-url')
const url = [
	flag === -1 ? undefined : process.argv[flag + 1],
	process.env.DIRECT_URL,
	process.env.DATABASE_URL
].find((value) => value != null && value !== '')
if (url == null) {
	console.error('Missing database URL: pass --db-url <url> or set DIRECT_URL / DATABASE_URL.')
	process.exit(1)
}

const db = new PrismaClient({ datasources: { db: { url } } })
try {
	const report = await seedChallenges({ db, definitions: CHALLENGE_DEFINITIONS })
	console.log(
		`Practice challenges: ${report.created.length} created, ${report.versioned.length} new versions, ${report.unchanged.length} unchanged; ${report.linkedAttempts} earlier attempts linked.`
	)
} catch (error) {
	console.error(error instanceof Error ? error.message : 'Seeding failed.')
	process.exitCode = 1
} finally {
	await db.$disconnect()
}
