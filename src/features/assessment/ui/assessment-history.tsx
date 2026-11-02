'use client'

import { useId, useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import type { AssessmentSummary } from '@/features/workspace/repository'
import { Link } from '@/i18n/routing'
import { SORT_KEYS, visibleHistory, type LevelFilter, type SortKey } from '../history-view'

const LEVELS = [
	'all',
	'strong',
	'proficient',
	'developing',
	'needsImprovement',
	'unscored'
] as const

/**
 * Every saved run. Each keeps the score and rubric it was made with. Search,
 * filter and sort only change what is listed, never what is stored.
 */
export function AssessmentHistory({
	assessments,
	selectedId
}: {
	assessments: readonly AssessmentSummary[]
	selectedId: string | null
}) {
	const t = useTranslations('Assessment.history')
	const format = useFormatter()
	const [query, setQuery] = useState('')
	const [level, setLevel] = useState<LevelFilter>('all')
	const [sort, setSort] = useState<SortKey>('newest')
	const searchId = useId()
	const levelId = useId()
	const sortId = useId()
	const dateText = (item: AssessmentSummary) =>
		format.dateTime(item.createdAt, { dateStyle: 'medium', timeStyle: 'short' })
	const shown = visibleHistory({ items: assessments, query, level, sort, dateText })
	const filtered = query.trim() !== '' || level !== 'all'

	return (
		<div className="flex flex-col gap-6">
			<div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr]">
				<div className="flex flex-col gap-2">
					<label htmlFor={searchId} className="app-eyebrow text-text-faint">
						{t('search.label')}
					</label>
					<input
						id={searchId}
						type="search"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder={t('search.placeholder')}
						className="app-input"
					/>
				</div>
				<div className="flex flex-col gap-2">
					<label htmlFor={levelId} className="app-eyebrow text-text-faint">
						{t('filter.label')}
					</label>
					<select
						id={levelId}
						value={level}
						onChange={(event) => setLevel(LEVELS.find((l) => l === event.target.value) ?? 'all')}
						className="app-input"
					>
						{LEVELS.map((value) => (
							<option key={value} value={value} className="bg-bg">
								{t(`filter.${value}`)}
							</option>
						))}
					</select>
				</div>
				<div className="flex flex-col gap-2">
					<label htmlFor={sortId} className="app-eyebrow text-text-faint">
						{t('sort.label')}
					</label>
					<select
						id={sortId}
						value={sort}
						onChange={(event) =>
							setSort(SORT_KEYS.find((key) => key === event.target.value) ?? 'newest')
						}
						className="app-input"
					>
						{SORT_KEYS.map((key) => (
							<option key={key} value={key} className="bg-bg">
								{t(`sort.${key}`)}
							</option>
						))}
					</select>
				</div>
			</div>
			<p role="status" className="text-text-muted text-sm">
				{t('count', { shown: shown.length, total: assessments.length })}
			</p>
			{shown.length === 0 ? (
				<div className="border-border flex flex-col items-start gap-3 border-y py-8">
					<p className="text-text-muted">{t('noMatches')}</p>
					{filtered ? (
						<button
							type="button"
							className="app-nav-link"
							onClick={() => {
								setQuery('')
								setLevel('all')
							}}
						>
							{t('clear')}
						</button>
					) : null}
				</div>
			) : (
				<ol className="border-border flex flex-col border-t">
					{shown.map((assessment) => (
						<li
							key={assessment.id}
							className="border-border flex flex-wrap items-center justify-between gap-4 border-b py-4"
						>
							<div className="flex flex-col gap-1">
								<p>
									{dateText(assessment)}
									{assessment.id === selectedId ? (
										<span className="app-eyebrow text-text ml-3">{t('viewing')}</span>
									) : null}
								</p>
								<p className="text-text-muted text-sm">
									{assessment.overallScore == null
										? t('noScore', { version: assessment.rubricVersion })
										: t('score', {
												score: assessment.overallScore,
												version: assessment.rubricVersion
											})}
								</p>
							</div>
							{assessment.id === selectedId ? null : (
								<Link href={`/assessment?id=${assessment.id}`} className="app-nav-link">
									{t('open')}
								</Link>
							)}
						</li>
					))}
				</ol>
			)}
		</div>
	)
}
