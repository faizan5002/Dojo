import type { PrismaClient } from '@prisma/client'
import { contentHashOf, encodeCriteria, encodePitfalls } from './challenge-codec'
import type { ChallengeDefinition } from './types'

// Writes challenge definitions into the library, safely to run any number of
// times. A challenge whose content is unchanged is left alone. Changed content
// under a higher version number becomes a new version, made current; the old
// version stays, and so do the attempts scored against it. Changed content
// under the same version number is refused: that would silently re-define
// what past attempts were scored against. Nothing is ever deleted.

export interface SeedReport {
	readonly created: readonly string[]
	readonly versioned: readonly string[]
	readonly unchanged: readonly string[]
	/** Attempts saved before the library was in the database, now linked to their version. */
	readonly linkedAttempts: number
}

export class SeedConflictError extends Error {}

function versionData(definition: ChallengeDefinition) {
	return {
		version: definition.version,
		title: definition.title,
		description: definition.description,
		difficulty: definition.difficulty,
		scenario: definition.scenario,
		instructions: definition.instructions,
		givenLabel: definition.given?.label ?? null,
		givenText: definition.given?.text ?? null,
		criteria: encodeCriteria(definition.criteria),
		pitfalls: encodePitfalls(definition.pitfalls),
		exemplar: definition.exemplar,
		explanation: definition.explanation,
		estimatedMinutes: definition.minutes,
		tags: [...definition.tags],
		contentHash: contentHashOf(definition)
	}
}

function assertUniqueSlugs(definitions: readonly ChallengeDefinition[]) {
	const seen = new Set<string>()
	for (const { slug } of definitions) {
		if (!/^[a-z0-9-]{1,80}$/.test(slug)) throw new SeedConflictError(`Invalid slug "${slug}"`)
		if (seen.has(slug)) throw new SeedConflictError(`Duplicate slug "${slug}"`)
		seen.add(slug)
	}
}

type Outcome = 'created' | 'versioned' | 'unchanged'

async function seedOne(db: PrismaClient, definition: ChallengeDefinition): Promise<Outcome> {
	const data = versionData(definition)
	return db.$transaction(async (tx) => {
		const existing = await tx.practiceChallenge.findUnique({
			where: { slug: definition.slug },
			include: { currentVersion: { select: { version: true, contentHash: true } } }
		})

		if (existing == null) {
			const challenge = await tx.practiceChallenge.create({
				data: {
					slug: definition.slug,
					skill: definition.skill,
					exerciseType: definition.type,
					isActive: definition.isActive
				}
			})
			const version = await tx.practiceChallengeVersion.create({
				data: { ...data, challengeId: challenge.id }
			})
			await tx.practiceChallenge.update({
				where: { id: challenge.id },
				data: { currentVersionId: version.id }
			})
			return 'created'
		}

		if (existing.skill !== definition.skill || existing.exerciseType !== definition.type) {
			throw new SeedConflictError(
				`"${definition.slug}" cannot change skill or exercise type; give it a new slug instead`
			)
		}
		const current = existing.currentVersion
		const isSameContent = current != null && current.contentHash === data.contentHash
		if (isSameContent && current.version === definition.version) {
			if (existing.isActive !== definition.isActive) {
				await tx.practiceChallenge.update({
					where: { id: existing.id },
					data: { isActive: definition.isActive }
				})
			}
			return 'unchanged'
		}
		if (current != null && definition.version <= current.version) {
			throw new SeedConflictError(
				`"${definition.slug}" changed without a version bump (stored v${current.version}, seed v${definition.version})`
			)
		}
		const version = await tx.practiceChallengeVersion.create({
			data: { ...data, challengeId: existing.id }
		})
		await tx.practiceChallenge.update({
			where: { id: existing.id },
			data: { currentVersionId: version.id, isActive: definition.isActive }
		})
		return 'versioned'
	})
}

/** Prisma's unique-constraint error, recognised by its documented code. */
const isUniqueViolation = (error: unknown) =>
	typeof error === 'object' && error != null && 'code' in error && error.code === 'P2002'

/** Two seeds racing on a fresh database: the loser re-reads and finds the winner's row. */
async function seedOneRetryingRace(
	db: PrismaClient,
	definition: ChallengeDefinition
): Promise<Outcome> {
	try {
		return await seedOne(db, definition)
	} catch (error) {
		if (!isUniqueViolation(error)) throw error
		return seedOne(db, definition)
	}
}

/** Links attempts saved with only a slug and version number to that stored version. */
async function linkLegacyAttempts(db: PrismaClient): Promise<number> {
	const unlinked = await db.practiceAttempt.findMany({
		where: { challengeVersionId: null },
		distinct: ['challengeSlug', 'challengeVersion'],
		select: { challengeSlug: true, challengeVersion: true }
	})
	let linked = 0
	for (const { challengeSlug, challengeVersion } of unlinked) {
		const version = await db.practiceChallengeVersion.findFirst({
			where: { version: challengeVersion, challenge: { slug: challengeSlug } },
			select: { id: true }
		})
		if (version == null) continue
		const { count } = await db.practiceAttempt.updateMany({
			where: { challengeVersionId: null, challengeSlug, challengeVersion },
			data: { challengeVersionId: version.id }
		})
		linked += count
	}
	return linked
}

export async function seedChallenges({
	db,
	definitions
}: {
	db: PrismaClient
	definitions: readonly ChallengeDefinition[]
}): Promise<SeedReport> {
	assertUniqueSlugs(definitions)
	const outcomes: Record<Outcome, string[]> = { created: [], versioned: [], unchanged: [] }
	// One challenge per transaction, in order: a conflict stops the run with
	// everything before it committed and everything after it untouched.
	for (const definition of definitions) {
		outcomes[await seedOneRetryingRace(db, definition)].push(definition.slug)
	}
	return { ...outcomes, linkedAttempts: await linkLegacyAttempts(db) }
}
