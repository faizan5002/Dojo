'use client'

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import {
	AlertIcon,
	CheckIcon,
	ChevronDownIcon,
	ChevronUpIcon,
	MenuIcon
} from '@/components/ui/icons'
import { recordReviewComplete } from '@/features/progression/model'
import { updateProgress } from '@/features/progression/store'
import { SealHint } from '@/features/progression/ui/seal-hint'
import { Link } from '@/i18n/routing'
import {
	addNote,
	couldNotSave,
	markReviewed,
	setActive as withActive,
	setRailCollapsed,
	useReviewState
} from '../review-store'
import { segmentPrompt, type Finding, type SessionView } from '../session-view'
import { FindingCard } from './finding-card'
import { NotesButton, NotesDrawer } from './notes-drawer'

const REPLY_LINES = 6
const SCROLL_SETTLE_MS = 450

interface Connector {
	readonly d: string
}

export interface ReviewerLinks {
	readonly assessment: string
	readonly practice: string
}

function SeverityIcon({ polarity, size = 14 }: { polarity: Finding['polarity']; size?: number }) {
	return polarity === 'opportunity' ? <AlertIcon size={size} /> : <CheckIcon size={size} />
}

const prefersReducedMotion = () =>
	typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * The original conversation with the assessment's findings placed on the exact
 * words they quote. Selecting a finding (inline marker, rail or the bottom bar on
 * a phone) scrolls to its source, highlights it and opens its explanation; several
 * can stay open. Opening never marks anything reviewed: that is its own button.
 */
export function SessionReviewer({
	view,
	scope,
	scopeNote,
	initialFindingId,
	links
}: {
	view: SessionView
	/** The browser-storage scope: `sample`, or the user's id with the assessment. */
	scope: string
	scopeNote: 'browser' | 'sample'
	initialFindingId: string | null
	links: ReviewerLinks
}) {
	const t = useTranslations('Review')
	const tAssessment = useTranslations('Assessment')
	const format = useFormatter()
	const { state, update } = useReviewState(scope)
	const { findings, turns } = view
	const [selected, setSelected] = useState<string | null>(
		() => findings.find((finding) => finding.id === initialFindingId)?.id ?? null
	)
	const [expanded, setExpanded] = useState<readonly string[]>(() =>
		initialFindingId != null && findings.some((finding) => finding.id === initialFindingId)
			? [initialFindingId]
			: []
	)
	const [preview, setPreview] = useState<string | null>(null)
	const [notesOpen, setNotesOpen] = useState(false)
	const [fullReplies, setFullReplies] = useState<readonly number[]>([])
	const [connector, setConnector] = useState<Connector | null>(null)
	const wrapper = useRef<HTMLDivElement>(null)

	// What is selected: this visit's choice, else the one remembered in this browser.
	const rememberedActive = findings.some((finding) => finding.id === state.active)
		? state.active
		: null
	const active = selected ?? rememberedActive
	const activeIndex = active == null ? -1 : findings.findIndex((finding) => finding.id === active)
	const reviewedCount = findings.filter((finding) => state.reviewed[finding.id] != null).length
	const allReviewed = findings.length > 0 && reviewedCount === findings.length
	const byId = useMemo(() => new Map(findings.map((finding) => [finding.id, finding])), [findings])
	const rail = !state.railCollapsed

	const measure = useCallback(() => {
		const box = wrapper.current
		const source = active == null ? null : document.getElementById(`src-${active}`)
		const marker = active == null ? null : document.getElementById(`rail-${active}`)
		if (box == null || source == null || marker == null || marker.offsetParent == null) {
			setConnector(null)
			return
		}
		const frame = box.getBoundingClientRect()
		const from = marker.getBoundingClientRect()
		const to = source.getBoundingClientRect()
		const x1 = from.left - frame.left
		const y1 = from.top + from.height / 2 - frame.top
		const x2 = to.right - frame.left
		const y2 = to.top + to.height / 2 - frame.top
		const turn = x1 - Math.max(12, (x1 - x2) / 2)
		setConnector({ d: `M ${x1} ${y1} H ${turn} V ${y2} H ${x2}` })
	}, [active])

	useEffect(() => {
		let frame = 0
		const schedule = () => {
			cancelAnimationFrame(frame)
			frame = requestAnimationFrame(measure)
		}
		schedule()
		window.addEventListener('scroll', schedule, true)
		window.addEventListener('resize', schedule)
		return () => {
			cancelAnimationFrame(frame)
			window.removeEventListener('scroll', schedule, true)
			window.removeEventListener('resize', schedule)
		}
	}, [measure, rail, expanded.length, fullReplies.length])

	const scrollTo = useCallback((id: string) => {
		requestAnimationFrame(() => {
			document.getElementById(`src-${id}`)?.scrollIntoView({
				behavior: prefersReducedMotion() ? 'auto' : 'smooth',
				block: 'center'
			})
		})
	}, [])

	useEffect(() => {
		if (initialFindingId != null) scrollTo(initialFindingId)
	}, [initialFindingId, scrollTo])

	const select = useCallback(
		(id: string) => {
			setSelected(id)
			setPreview(null)
			setExpanded((current) => (current.includes(id) ? current : [...current, id]))
			update((current) => withActive(current, id))
			scrollTo(id)
			window.setTimeout(() => window.dispatchEvent(new Event('resize')), SCROLL_SETTLE_MS)
		},
		[scrollTo, update]
	)

	const go = (step: 1 | -1) => {
		if (findings.length === 0) return
		const next =
			activeIndex === -1
				? step === 1
					? 0
					: findings.length - 1
				: (activeIndex + step + findings.length) % findings.length
		const target = findings[next]
		if (target != null) select(target.id)
	}

	const collapse = (id: string) => setExpanded((current) => current.filter((item) => item !== id))
	const markDone = (id: string) => {
		update((current) => markReviewed(current, id, new Date()))
		const remaining = findings.filter(
			(finding) => state.reviewed[finding.id] == null && finding.id !== id
		)
		if (findings.length > 0 && state.reviewed[id] == null && remaining.length === 0) {
			updateProgress((progress, today) => recordReviewComplete(progress, today))
		}
	}

	const newNote = (text: string, attachToActive: boolean) =>
		update((current) =>
			addNote(current, {
				id: `${Date.now().toString(36)}-${current.notes.length}`,
				text,
				findingId: attachToActive ? active : null,
				now: new Date()
			})
		)

	const markerLabel = (finding: Finding, index: number) =>
		t('finding.markerLabel', {
			number: index + 1,
			total: findings.length,
			severity: t(`severity.${finding.polarity}`),
			skill: tAssessment(`skills.${finding.skill}.name`)
		})

	const previewText = (finding: Finding) =>
		tAssessment(
			`criteria.${finding.criterion}.${finding.polarity === 'strength' ? 'shows' : 'missing'}`
		)

	const clock = (iso: string | null) =>
		iso == null || Number.isNaN(Date.parse(iso))
			? null
			: format.dateTime(new Date(iso), { timeStyle: 'short' })

	const cards = (turnNumber: number | null) =>
		findings
			.map((finding, index) => ({ finding, index }))
			.filter(({ finding }) => finding.promptNumber === turnNumber && expanded.includes(finding.id))

	const activeFinding = active == null ? null : (byId.get(active) ?? null)

	return (
		<div ref={wrapper} className="relative flex flex-col gap-6 pb-28 lg:pb-0">
			<div
				role="toolbar"
				aria-label={t('toolbar.label')}
				className="border-border-strong bg-surface border-t-accent sticky top-[61px] z-30 flex flex-wrap items-center gap-x-5 gap-y-2 border border-t-2 px-4 py-3"
			>
				<p className="flex items-center gap-3 font-mono text-xs">
					<span aria-hidden="true" className="flex gap-1.5">
						<i className="bg-border-strong block size-2 rounded-full" />
						<i className="bg-border-strong block size-2 rounded-full" />
						<i className="bg-accent block size-2 rounded-full" />
					</span>
					<span className="text-text">{view.project ?? t('toolbar.untitled')}</span>
					<span className="text-text-faint">· {view.agent}</span>
				</p>
				<p className="text-text-muted text-xs" data-testid="review-progress">
					{t('toolbar.reviewed', { done: reviewedCount, total: findings.length })}
				</p>
				<div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2">
					<button
						type="button"
						className="app-nav-link inline-flex items-center gap-2"
						onClick={() => go(-1)}
						disabled={findings.length === 0}
					>
						<ChevronUpIcon size={14} />
						{t('toolbar.previous')}
					</button>
					<button
						type="button"
						className="app-nav-link inline-flex items-center gap-2"
						onClick={() => go(1)}
						disabled={findings.length === 0}
					>
						<ChevronDownIcon size={14} />
						{t('toolbar.next')}
					</button>
					{rail ? (
						<button
							type="button"
							className="app-nav-link hidden items-center gap-2 lg:inline-flex"
							onClick={() => update((current) => setRailCollapsed(current, true))}
						>
							<MenuIcon size={14} />
							{t('toolbar.hideRail')}
						</button>
					) : (
						<button
							type="button"
							className="app-nav-link hidden items-center gap-2 lg:inline-flex"
							data-testid="show-rail"
							onClick={() => {
								update((current) => setRailCollapsed(current, false))
								if (active != null) window.setTimeout(() => select(active), 0)
							}}
						>
							<MenuIcon size={14} />
							{t('toolbar.showRail')}
						</button>
					)}
				</div>
			</div>

			{allReviewed ? (
				<section
					role="status"
					aria-labelledby="done-heading"
					data-testid="review-complete"
					className="border-accent bg-surface flex flex-col gap-3 border p-5"
				>
					<h2 id="done-heading" className="text-lg font-normal">
						{t('complete.title', { total: findings.length })}
					</h2>
					<p className="text-text-muted text-sm">{t('complete.body')}</p>
					<div className="flex flex-wrap items-center gap-x-6 gap-y-2">
						<Link href={links.practice} className="app-pill">
							{t('complete.practice')}
						</Link>
						<Link href={links.assessment} className="app-nav-link">
							{t('complete.back')}
						</Link>
					</div>
				</section>
			) : null}

			{view.unmatched > 0 ? (
				<p className="text-text-faint text-xs">{t('unmatched', { count: view.unmatched })}</p>
			) : null}

			<div className={`grid items-start gap-8 ${rail ? 'lg:grid-cols-[minmax(0,1fr)_16rem]' : ''}`}>
				<ol
					className="border-border-strong bg-surface flex min-w-0 flex-col border font-mono text-sm"
					data-testid="conversation"
					aria-label={t('conversation')}
				>
					{turns.map((turn, turnIndex) => {
						const here = findings.filter((finding) => finding.promptNumber === turn.promptNumber)
						const segments =
							turn.prompt == null || turn.promptNumber == null
								? []
								: segmentPrompt(turn.prompt, here)
						const firstSegment = new Map<string, number>()
						const lastSegment = new Map<string, number>()
						segments.forEach((segment, segmentIndex) => {
							for (const id of segment.findingIds) {
								if (!firstSegment.has(id)) firstSegment.set(id, segmentIndex)
								lastSegment.set(id, segmentIndex)
							}
						})
						const reply = turn.response
						const replyLines = reply?.split('\n') ?? []
						const isLong = replyLines.length > REPLY_LINES
						const showFull = turn.promptNumber != null && fullReplies.includes(turn.promptNumber)
						return (
							<li
								key={turnIndex}
								className="border-border flex flex-col border-b last:border-b-0"
								data-prompt={turn.promptNumber ?? undefined}
							>
								{turn.prompt == null ? null : (
									<div className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-x-3 px-3 py-4">
										<span className="text-text-faint text-right text-xs select-none">
											{turn.promptNumber}
										</span>
										<div className="flex min-w-0 flex-col gap-2">
											<p className="app-eyebrow font-sans">
												{t('turn.you')}
												{clock(turn.promptTime) == null ? '' : ` · ${clock(turn.promptTime)}`}
											</p>
											<p className="leading-relaxed break-words whitespace-pre-wrap">
												{segments.map((segment, segmentIndex) => {
													const covering = segment.findingIds
													const isActiveText = active != null && covering.includes(active)
													const anchors = covering.filter(
														(id) => firstSegment.get(id) === segmentIndex
													)
													const endings = here.filter(
														(finding) => lastSegment.get(finding.id) === segmentIndex
													)
													return (
														<Fragment key={segmentIndex}>
															<span
																id={anchors[0] == null ? undefined : `src-${anchors[0]}`}
																data-finding-text={
																	covering.length > 0 ? covering.join(' ') : undefined
																}
																className={
																	covering.length === 0
																		? ''
																		: `underline decoration-2 underline-offset-4 ${
																				here.some(
																					(finding) =>
																						covering.includes(finding.id) &&
																						finding.polarity === 'opportunity'
																				)
																					? 'decoration-dashed'
																					: 'decoration-solid'
																			} ${isActiveText ? 'bg-accent/25 decoration-accent' : 'decoration-text-muted'}`
																}
															>
																{/* A piece that several findings start on carries each one's anchor. */}
																{anchors.slice(1).reduceRight<React.ReactNode>(
																	(inner, id) => (
																		<span id={`src-${id}`}>{inner}</span>
																	),
																	segment.text
																)}
															</span>
															{endings.map((finding) => {
																const number = findings.indexOf(finding)
																const isDone = state.reviewed[finding.id] != null
																const isOpen = expanded.includes(finding.id)
																return (
																	<span
																		key={finding.id}
																		className="relative inline-block align-baseline"
																	>
																		<button
																			type="button"
																			id={`marker-${finding.id}`}
																			data-testid="annotation"
																			data-finding={finding.id}
																			data-polarity={finding.polarity}
																			aria-label={markerLabel(finding, number)}
																			aria-expanded={isOpen}
																			onClick={() => select(finding.id)}
																			onMouseEnter={() => setPreview(finding.id)}
																			onMouseLeave={() => setPreview(null)}
																			onFocus={() => setPreview(finding.id)}
																			onBlur={() => setPreview(null)}
																			className={`mx-1 inline-flex min-h-6 min-w-6 items-center justify-center gap-1 border px-1 align-middle font-sans text-[11px] leading-none ${
																				active === finding.id
																					? 'border-accent text-text'
																					: 'border-border-strong text-text-muted'
																			}`}
																		>
																			<SeverityIcon polarity={finding.polarity} size={12} />
																			{number + 1}
																			{isDone ? <CheckIcon size={10} /> : null}
																		</button>
																		{preview === finding.id && !isOpen ? (
																			<span
																				role="tooltip"
																				data-testid="annotation-preview"
																				className="border-border-strong bg-bg absolute bottom-full left-0 z-20 mb-2 hidden w-64 border p-3 font-sans text-xs leading-snug whitespace-normal shadow-lg sm:block"
																			>
																				<span className="app-eyebrow mb-1 block">
																					{t(`severity.${finding.polarity}`)} ·{' '}
																					{tAssessment(`skills.${finding.skill}.name`)}
																				</span>
																				{previewText(finding)}
																			</span>
																		) : null}
																	</span>
																)
															})}
														</Fragment>
													)
												})}
												{segments.length === 0 ? turn.prompt : null}
											</p>
										</div>
									</div>
								)}
								{reply == null ? null : (
									<div className="border-border bg-bg/40 grid grid-cols-[3.25rem_minmax(0,1fr)] gap-x-3 border-t px-3 py-3">
										<span aria-hidden="true" />
										<div className="text-text-muted flex min-w-0 flex-col gap-2">
											<p className="app-eyebrow font-sans">
												{t('turn.agent')}
												{clock(turn.responseTime) == null ? '' : ` · ${clock(turn.responseTime)}`}
											</p>
											<p className="text-xs leading-relaxed break-words whitespace-pre-wrap">
												{isLong && !showFull ? replyLines.slice(0, REPLY_LINES).join('\n') : reply}
											</p>
											{isLong && turn.promptNumber != null ? (
												<button
													type="button"
													className="app-nav-link self-start font-sans"
													onClick={() =>
														setFullReplies((current) =>
															showFull
																? current.filter((n) => n !== turn.promptNumber)
																: [...current, turn.promptNumber as number]
														)
													}
												>
													{showFull ? t('turn.showLess') : t('turn.showMore')}
												</button>
											) : null}
										</div>
									</div>
								)}
								{cards(turn.promptNumber).length === 0 ? null : (
									<div className="flex flex-col gap-3 px-3 pb-4 font-sans">
										{cards(turn.promptNumber).map(({ finding, index }) => (
											<FindingCard
												key={finding.id}
												finding={finding}
												index={index}
												total={findings.length}
												turns={turns}
												reviewedAt={state.reviewed[finding.id] ?? null}
												isActive={active === finding.id}
												practiceHref={links.practice}
												onReview={() => markDone(finding.id)}
												onCollapse={() => collapse(finding.id)}
											/>
										))}
									</div>
								)}
							</li>
						)
					})}
				</ol>

				{rail ? (
					<nav
						aria-label={t('rail.heading')}
						data-testid="rail"
						className="border-border-strong bg-surface sticky top-20 hidden flex-col gap-4 border p-4 lg:flex"
					>
						<h2 className="app-eyebrow">{t('rail.heading')}</h2>
						<p className="text-text-muted text-xs">
							{t('toolbar.reviewed', { done: reviewedCount, total: findings.length })}
						</p>
						<span aria-hidden="true" className="app-meter">
							<span
								style={{
									width: `${findings.length === 0 ? 0 : (reviewedCount / findings.length) * 100}%`
								}}
							/>
						</span>
						<SealHint done={allReviewed} />
						{findings.length === 0 ? (
							<p className="text-text-faint text-xs">{t('rail.empty')}</p>
						) : (
							<ul className="flex flex-col gap-1">
								{findings.map((finding, index) => (
									<li key={finding.id}>
										<button
											type="button"
											id={`rail-${finding.id}`}
											data-testid="rail-marker"
											data-finding={finding.id}
											aria-current={active === finding.id ? 'true' : undefined}
											aria-label={markerLabel(finding, index)}
											onClick={() => select(finding.id)}
											className={`flex w-full items-center gap-2 border px-2 py-1.5 text-left text-xs ${
												active === finding.id
													? 'border-accent text-text'
													: 'border-border text-text-muted'
											}`}
										>
											<SeverityIcon polarity={finding.polarity} size={12} />
											<span className="tabular-nums">{index + 1}</span>
											<span className="min-w-0 flex-1 truncate">
												{tAssessment(`skills.${finding.skill}.name`)}
											</span>
											{state.reviewed[finding.id] != null ? <CheckIcon size={12} /> : null}
										</button>
									</li>
								))}
							</ul>
						)}
					</nav>
				) : null}
			</div>

			{connector == null || !rail ? null : (
				<svg
					aria-hidden="true"
					data-testid="connector"
					className="pointer-events-none absolute inset-0 hidden h-full w-full overflow-visible lg:block"
				>
					<path d={connector.d} fill="none" className="stroke-accent" strokeWidth="1.5" />
				</svg>
			)}

			<NotesButton
				count={state.notes.length}
				isOpen={notesOpen}
				onToggle={() => setNotesOpen((open) => !open)}
			/>
			{notesOpen ? (
				<NotesDrawer
					notes={state.notes}
					activeNumber={activeIndex === -1 ? null : activeIndex + 1}
					scopeNote={scopeNote}
					couldNotSave={couldNotSave()}
					onAdd={newNote}
					onClose={() => setNotesOpen(false)}
				/>
			) : null}

			<div
				data-testid="mobile-bar"
				className="border-border-strong bg-surface fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t px-4 py-3 max-md:bottom-[calc(60px+env(safe-area-inset-bottom,0px))] lg:hidden"
			>
				<div className="flex min-w-0 flex-1 flex-col">
					<p className="app-eyebrow truncate" data-testid="mobile-current">
						{activeFinding == null
							? t('mobile.none')
							: t('finding.position', { number: activeIndex + 1, total: findings.length })}
					</p>
					<p className="text-text-muted truncate text-xs">
						{activeFinding == null
							? t('mobile.start')
							: `${tAssessment(`skills.${activeFinding.skill}.name`)} · ${t(`severity.${activeFinding.polarity}`)}`}{' '}
						· {t('toolbar.reviewed', { done: reviewedCount, total: findings.length })}
					</p>
				</div>
				<button
					type="button"
					className="app-pill min-h-11"
					onClick={() => go(-1)}
					aria-label={t('toolbar.previous')}
					disabled={findings.length === 0}
				>
					<ChevronUpIcon size={16} />
				</button>
				<button
					type="button"
					className="app-pill min-h-11"
					onClick={() => go(1)}
					aria-label={t('toolbar.next')}
					disabled={findings.length === 0}
				>
					<ChevronDownIcon size={16} />
				</button>
			</div>
		</div>
	)
}
