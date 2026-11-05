import type { Prisma, PrismaClient } from '@prisma/client'
import { SKILL_IDS, type SkillId } from '@/features/assessment/rubric'
import { decodeCriteria, decodePitfalls } from './challenge-codec'
import {
	DIFFICULTIES,
	EXERCISE_TYPES,
	type CatalogEntry,
	type Challenge,
	type Difficulty,
	type ExerciseType,
	type PublicChallenge
} from './types'

// Every read of the challenge library. Challenges are shared content, not a
// user's data, so nothing here takes a user id; what a user may see of them
// (never the criteria or the strong answer before an attempt) is decided by
// which function a caller uses. Retired challenges are left out of every
// listing; only `getChallenge` returns them, for the history of past attempts.

type Db = { db: PrismaClient }

const VERSION_FIELDS = {
	id: true,
	version: true,
	title: true,
	description: true,
	difficulty: true,
	scenario: true,
	instructions: true,
	givenLabel: true,
	givenText: true,
	estimatedMinutes: true,
	tags: true
} satisfies Prisma.PracticeChallengeVersionSelect

const FULL_VERSION_FIELDS = {
	...VERSION_FIELDS,
	criteria: true,
	pitfalls: true,
	exemplar: true,
	explanation: true
} satisfies Prisma.PracticeChallengeVersionSelect

const IDENTITY_FIELDS = {
	id: true,
	slug: true,
	skill: true,
	exerciseType: true,
	isActive: true
} satisfies Prisma.PracticeChallengeSelect

type IdentityRow = Prisma.PracticeChallengeGetPayload<{ select: typeof IDENTITY_FIELDS }>
type VersionRow = Prisma.PracticeChallengeVersionGetPayload<{ select: typeof VERSION_FIELDS }>
type FullVersionRow = Prisma.PracticeChallengeVersionGetPayload<{
	select: typeof FULL_VERSION_FIELDS
}>

export interface ChallengeFilters {
	readonly skill?: SkillId
	readonly difficulty?: Difficulty
	readonly type?: ExerciseType
	/** Matched, case-insensitively, against the title, description and tags. */
	readonly search?: string
}

export interface ChallengePage {
	readonly items: readonly PublicChallenge[]
	readonly total: number
	readonly page: number
	readonly pageSize: number
}

// The enums in the database and the unions in code are the same strings;
// these narrow a row's value without a cast, and fail loudly if they drift.
function skillOf(value: string): SkillId {
	const skill = SKILL_IDS.find((each) => each === value)
	if (skill == null) throw new Error(`Challenge skill "${value}" is not a rubric skill`)
	return skill
}

function difficultyOf(value: string): Difficulty {
	const difficulty = DIFFICULTIES.find((each) => each === value)
	if (difficulty == null) throw new Error(`Challenge difficulty "${value}" is not known`)
	return difficulty
}

function typeOf(value: string): ExerciseType {
	const type = EXERCISE_TYPES.find((each) => each === value)
	if (type == null) throw new Error(`Exercise type "${value}" is not known`)
	return type
}

function toPublic(identity: IdentityRow, version: VersionRow): PublicChallenge {
	return {
		id: identity.id,
		slug: identity.slug,
		version: version.version,
		title: version.title,
		description: version.description,
		skill: skillOf(identity.skill),
		type: typeOf(identity.exerciseType),
		difficulty: difficultyOf(version.difficulty),
		scenario: version.scenario,
		instructions: version.instructions,
		given:
			version.givenLabel == null || version.givenText == null
				? null
				: { label: version.givenLabel, text: version.givenText },
		minutes: version.estimatedMinutes,
		tags: version.tags,
		isActive: identity.isActive
	}
}

function toChallenge(identity: IdentityRow, version: FullVersionRow): Challenge {
	return {
		...toPublic(identity, version),
		versionId: version.id,
		criteria: decodeCriteria(version.criteria),
		pitfalls: decodePitfalls(version.pitfalls),
		exemplar: version.exemplar,
		explanation: version.explanation
	}
}

function whereFor(filters: ChallengeFilters): Prisma.PracticeChallengeWhereInput {
	const search = filters.search?.trim()
	return {
		isActive: true,
		...(filters.skill == null ? {} : { skill: filters.skill }),
		...(filters.type == null ? {} : { exerciseType: filters.type }),
		currentVersion: {
			...(filters.difficulty == null ? {} : { difficulty: filters.difficulty }),
			...(search == null || search === ''
				? {}
				: {
						OR: [
							{ title: { contains: search, mode: 'insensitive' } },
							{ description: { contains: search, mode: 'insensitive' } },
							{ tags: { has: search.toLowerCase() } }
						]
					})
		}
	}
}

/** A page of the active library, without criteria or answers, in rubric order. */
export async function listChallenges({
	db,
	filters = {},
	page = 1,
	pageSize = 12
}: Db & { filters?: ChallengeFilters; page?: number; pageSize?: number }): Promise<ChallengePage> {
	const where = whereFor(filters)
	const [rows, total] = await Promise.all([
		db.practiceChallenge.findMany({
			where,
			select: { ...IDENTITY_FIELDS, currentVersion: { select: VERSION_FIELDS } },
			orderBy: [{ skill: 'asc' }, { currentVersion: { difficulty: 'asc' } }, { slug: 'asc' }],
			skip: (page - 1) * pageSize,
			take: pageSize
		}),
		db.practiceChallenge.count({ where })
	])
	const items = rows.flatMap((row) =>
		row.currentVersion == null ? [] : [toPublic(row, row.currentVersion)]
	)
	return { items, total, page, pageSize }
}

/** The planner's view of every active challenge: what it needs to choose, no content. */
export async function listCatalog({ db }: Db): Promise<CatalogEntry[]> {
	const rows = await db.practiceChallenge.findMany({
		where: { isActive: true, currentVersionId: { not: null } },
		select: {
			slug: true,
			skill: true,
			exerciseType: true,
			currentVersion: {
				select: {
					version: true,
					title: true,
					description: true,
					difficulty: true,
					estimatedMinutes: true,
					tags: true
				}
			}
		},
		orderBy: { slug: 'asc' }
	})
	return rows.flatMap((row) =>
		row.currentVersion == null
			? []
			: [
					{
						slug: row.slug,
						version: row.currentVersion.version,
						title: row.currentVersion.title,
						description: row.currentVersion.description,
						skill: skillOf(row.skill),
						type: typeOf(row.exerciseType),
						difficulty: difficultyOf(row.currentVersion.difficulty),
						minutes: row.currentVersion.estimatedMinutes,
						tags: row.currentVersion.tags
					}
				]
	)
}

/**
 * A challenge's current version, rubric included, active or retired; null if
 * the slug is unknown. Callers decide what of it a user may see.
 */
export async function getChallenge({ db, slug }: Db & { slug: string }): Promise<Challenge | null> {
	const row = await db.practiceChallenge.findUnique({
		where: { slug },
		select: { ...IDENTITY_FIELDS, currentVersion: { select: FULL_VERSION_FIELDS } }
	})
	return row?.currentVersion == null ? null : toChallenge(row, row.currentVersion)
}

/** One exact stored version, as an attempt recorded it; null if it does not exist. */
export async function getChallengeVersion({
	db,
	versionId
}: Db & { versionId: string }): Promise<Challenge | null> {
	const row = await db.practiceChallengeVersion.findUnique({
		where: { id: versionId },
		select: { ...FULL_VERSION_FIELDS, challenge: { select: IDENTITY_FIELDS } }
	})
	return row == null ? null : toChallenge(row.challenge, row)
}
