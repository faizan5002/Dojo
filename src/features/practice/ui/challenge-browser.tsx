'use client'

import { useId } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { SKILL_IDS } from '@/features/assessment/rubric'
import { Link, usePathname, useRouter } from '@/i18n/routing'
import { DIFFICULTIES, EXERCISE_TYPES } from '../types'
import { fetchChallenges } from './practice-api'

const FILTER_KEYS = ['skill', 'difficulty', 'type', 'search'] as const

/**
 * The challenge library, loaded from the API with the filters held in the URL,
 * so a filtered view can be shared and survives a reload. The form also works
 * as a plain GET form before this script has loaded.
 */
export function ChallengeBrowser({ recommendedSlug }: { recommendedSlug: string | null }) {
	const t = useTranslations('Guru')
	const tSkills = useTranslations('Assessment.skills')
	const router = useRouter()
	const pathname = usePathname()
	const params = useSearchParams()
	const searchId = useId()
	const queryString = params.toString()
	const hasFilters = FILTER_KEYS.some((key) => (params.get(key) ?? '') !== '')
	const page = Number(params.get('page') ?? '1')

	const {
		data: result,
		isPending,
		refetch
	} = useQuery({
		queryKey: ['practice-challenges', queryString],
		queryFn: () => fetchChallenges(new URLSearchParams(queryString))
	})

	function navigate(next: URLSearchParams) {
		const query = next.toString()
		router.replace(query === '' ? pathname : `${pathname}?${query}`, { scroll: false })
	}

	function applyFilters(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault()
		const next = new URLSearchParams()
		for (const [key, value] of new FormData(event.currentTarget)) {
			if (typeof value === 'string' && value.trim() !== '') next.set(key, value.trim())
		}
		navigate(next)
	}

	function goToPage(target: number) {
		const next = new URLSearchParams(queryString)
		next.set('page', String(target))
		navigate(next)
	}

	return (
		<div className="flex flex-col gap-8">
			<form
				key={queryString}
				onSubmit={applyFilters}
				className="border-border grid gap-4 border-y py-6 sm:grid-cols-2 lg:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,1.5fr)_auto]"
				role="search"
				aria-label={t('library.filters.label')}
			>
				<FilterSelect
					name="skill"
					label={t('library.filters.skill')}
					any={t('library.filters.any')}
					value={params.get('skill') ?? ''}
					options={SKILL_IDS.map((skill) => ({ value: skill, label: tSkills(`${skill}.name`) }))}
				/>
				<FilterSelect
					name="difficulty"
					label={t('library.filters.difficulty')}
					any={t('library.filters.any')}
					value={params.get('difficulty') ?? ''}
					options={DIFFICULTIES.map((value) => ({ value, label: t(`difficulty.${value}`) }))}
				/>
				<FilterSelect
					name="type"
					label={t('library.filters.type')}
					any={t('library.filters.any')}
					value={params.get('type') ?? ''}
					options={EXERCISE_TYPES.map((value) => ({ value, label: t(`types.${value}`) }))}
				/>
				<div className="flex flex-col gap-2">
					<label htmlFor={searchId} className="app-eyebrow">
						{t('library.filters.search')}
					</label>
					<input
						id={searchId}
						name="search"
						type="search"
						maxLength={100}
						defaultValue={params.get('search') ?? ''}
						placeholder={t('library.filters.searchPlaceholder')}
						className="app-input"
					/>
				</div>
				<div className="flex items-end gap-3">
					<button type="submit" className="app-pill">
						{t('library.filters.apply')}
					</button>
					{hasFilters ? (
						<Link href="/prompting-guru/challenges" className="app-nav-link">
							{t('library.filters.clear')}
						</Link>
					) : null}
				</div>
			</form>

			<div aria-live="polite" aria-busy={isPending} data-testid="guru-library">
				{isPending ? (
					<p className="text-text-muted">{t('library.loading')}</p>
				) : !result?.ok ? (
					<div className="flex flex-col items-start gap-3" data-testid="guru-library-error">
						<p>
							{result?.reason === 'signedOut'
								? t('library.sessionExpired')
								: result?.reason === 'invalid'
									? t('library.invalid')
									: t('library.error')}
						</p>
						{result?.reason === 'signedOut' ? (
							<Link href="/sign-in" className="app-pill">
								{t('exercise.signIn')}
							</Link>
						) : result?.reason === 'invalid' ? (
							<Link href="/prompting-guru/challenges" className="app-pill">
								{t('library.filters.clear')}
							</Link>
						) : (
							<button type="button" className="app-pill" onClick={() => refetch()}>
								{t('library.retry')}
							</button>
						)}
					</div>
				) : result.data.total === 0 ? (
					<p className="text-text-muted" data-testid="guru-library-empty">
						{hasFilters ? t('library.noMatch') : t('library.empty')}
					</p>
				) : (
					<div className="flex flex-col gap-6">
						<p className="text-text-muted text-sm">
							{t('library.count', { total: result.data.total })}
						</p>
						<ul className="border-border flex flex-col border-t">
							{result.data.items.map((challenge) => (
								<li
									key={challenge.id}
									data-testid="guru-challenge-card"
									className="border-border flex flex-wrap items-center justify-between gap-4 border-b py-5"
								>
									<div className="flex max-w-2xl flex-col gap-1">
										<p className="app-eyebrow">
											{tSkills(`${challenge.skill}.name`)} ·{' '}
											{t(`difficulty.${challenge.difficulty}`)} ·{' '}
											{t(`types.${challenge.exerciseType}`)} ·{' '}
											{t('library.minutes', { minutes: challenge.estimatedMinutes })}
											{challenge.slug === recommendedSlug ? (
												<span className="text-text ml-3">{t('library.recommended')}</span>
											) : null}
										</p>
										<p className="text-lg">{challenge.title}</p>
										<p className="text-text-muted text-sm">{challenge.description}</p>
									</div>
									<div className="flex items-center gap-5">
										<span className="text-text-muted text-sm tabular-nums">
											{challenge.bestScore == null
												? t('library.untried')
												: t('library.best', { score: challenge.bestScore })}
										</span>
										<Link
											href={`/prompting-guru/challenges/${challenge.slug}`}
											className="app-pill"
										>
											{t('next.start')}
										</Link>
									</div>
								</li>
							))}
						</ul>
						{result.data.pageCount <= 1 ? null : (
							<nav aria-label={t('library.pagination')} className="flex items-center gap-4">
								<button
									type="button"
									className="app-pill disabled:opacity-50"
									disabled={page <= 1}
									onClick={() => goToPage(page - 1)}
								>
									{t('library.previous')}
								</button>
								<span className="text-text-muted text-sm tabular-nums">
									{t('library.pageOf', { page: result.data.page, pages: result.data.pageCount })}
								</span>
								<button
									type="button"
									className="app-pill disabled:opacity-50"
									disabled={page >= result.data.pageCount}
									onClick={() => goToPage(page + 1)}
								>
									{t('library.next')}
								</button>
							</nav>
						)}
					</div>
				)}
			</div>
		</div>
	)
}

function FilterSelect({
	name,
	label,
	any,
	value,
	options
}: {
	name: string
	label: string
	any: string
	value: string
	options: readonly { value: string; label: string }[]
}) {
	const id = useId()
	return (
		<div className="flex flex-col gap-2">
			<label htmlFor={id} className="app-eyebrow">
				{label}
			</label>
			<select id={id} name={name} defaultValue={value} className="app-input app-select">
				<option value="">{any}</option>
				{options.map((option) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</select>
		</div>
	)
}
