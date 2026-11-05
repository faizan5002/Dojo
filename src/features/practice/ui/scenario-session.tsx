'use client'

import { useEffect, useRef, useState } from 'react'
import {
	ACHIEVEMENTS,
	levelOf,
	questsOf,
	recordPracticeSession,
	recordScenario,
	runSummary
} from '@/features/progression/model'
import { setCelebrationHold, updateProgress, useProgress } from '@/features/progression/store'
import { BadgeArt } from '@/features/progression/ui/badge-art'
import { HankoMark, ScrollIcon, SwordsIcon, XpIcon } from '@/features/progression/ui/dojo-icons'
import { useTranslations } from 'next-intl'
import { AlertIcon, CheckIcon, InfoIcon } from '@/components/ui/icons'
import { SkillGlyph } from '@/features/app-shell/skill-glyph'
import type { CriterionId, SkillId } from '@/features/assessment/rubric'
import { Link } from '@/i18n/routing'
import { SCENARIOS } from '../scenarios/catalog'
import {
	adjustDifficulty,
	chooseScenario,
	orderedOptions,
	type PlanSkill,
	type PracticePlan
} from '../scenarios/plan'
import type { Difficulty, Scenario } from '../scenarios/types'

interface Answer {
	readonly scenarioId: string
	readonly optionId: string
	readonly reasoning: string
}

export interface ScenarioLinks {
	readonly assessment: string
	/** The assessment's conversation viewer, when there is one to open. */
	readonly conversation: string
	readonly drill: string
	readonly upload: string
	readonly restart: string
}

const scenarioOf = (id: string): Scenario | undefined =>
	SCENARIOS.find((scenario) => scenario.id === id)

function pick(
	plan: PracticePlan,
	index: number,
	difficulty: Record<SkillId, Difficulty>,
	used: readonly string[]
): Scenario | null {
	const skill = plan.slots[index]
	if (skill == null) return null
	const entry = plan.skills.find((each) => each.skill === skill)
	return chooseScenario({
		skill,
		difficulty: difficulty[skill],
		preferred: entry?.preferred ?? null,
		used
	})
}

function Conversation({ scenario }: { scenario: Scenario }) {
	const t = useTranslations('Practice.session')
	return (
		<div className="dj-session">
			<div className="dj-session-bar" aria-hidden="true">
				<span>{t('file')}</span>
			</div>
			<ol aria-label={t('conversation')} data-testid="scenario-conversation">
				{scenario.conversation.map((turn, index) => (
					<li key={index} data-role={turn.role}>
						<span className="dj-session-role">{t(`role.${turn.role}`)}</span>
						<span className="break-words whitespace-pre-wrap">{turn.text}</span>
					</li>
				))}
			</ol>
		</div>
	)
}

/**
 * A scenario-based practice session. Choose an action, confirm it (with an
 * optional line on why), read the coaching, and continue when you are ready.
 * No timer and no running score. Feedback is authored for each choice and held
 * against the assessment rules; nothing here is generated or saved, and one
 * session is not a skill assessment.
 */
export function ScenarioSession({
	plan,
	assessmentLabel,
	links
}: {
	plan: PracticePlan
	/** One line on where the plan came from, built on the server from the assessment. */
	assessmentLabel: string
	links: ScenarioLinks
}) {
	const t = useTranslations('Practice.session')
	const tAssessment = useTranslations('Assessment')
	const total = plan.slots.length
	const [difficulty, setDifficulty] = useState<Record<SkillId, Difficulty>>(() => {
		const start = {} as Record<SkillId, Difficulty>
		for (const each of plan.skills) start[each.skill] = each.start
		return start
	})
	const [queue, setQueue] = useState<readonly string[]>(() => {
		const first = pick(plan, 0, difficultyStart(plan), [])
		return first == null ? [] : [first.id]
	})
	const [answers, setAnswers] = useState<readonly Answer[]>([])
	const [selected, setSelected] = useState<string | null>(null)
	const [reasoning, setReasoning] = useState('')
	const [isConfirmed, setIsConfirmed] = useState(false)
	// One id per practice session: it ties this session's XP ledger entries together.
	const [run] = useState(() => `run-${Date.now().toString(36)}`)

	const index = answers.length
	const current = queue[index] == null ? null : (scenarioOf(queue[index]) ?? null)
	const isFinished = index >= total || current == null

	// Seal and rank reveals wait until the session summary, so they never land on a scenario.
	const holding = !(isFinished && !isConfirmed)
	useEffect(() => {
		setCelebrationHold(holding)
		return () => setCelebrationHold(false)
	}, [holding])

	const confirm = () => {
		if (current == null || selected == null) return
		const option = current.options.find((each) => each.id === selected)
		if (option == null) return
		updateProgress((state, today) =>
			recordScenario(
				state,
				{ quality: option.quality, skill: current.skill, run, step: answers.length + 1 },
				today
			)
		)
		setAnswers((list) => [...list, { scenarioId: current.id, optionId: selected, reasoning }])
		setDifficulty((levels) => ({
			...levels,
			[current.skill]: adjustDifficulty(levels[current.skill], option.quality)
		}))
		setIsConfirmed(true)
	}

	const next = () => {
		// `index` already counts the answer just given, so it is the next scenario's slot.
		const upcoming = pick(plan, index, difficulty, queue)
		setQueue((list) => (upcoming == null ? list : [...list, upcoming.id]))
		setSelected(null)
		setReasoning('')
		setIsConfirmed(false)
	}

	const answered = answers.map((answer) => {
		const scenario = scenarioOf(answer.scenarioId)
		const option = scenario?.options.find((each) => each.id === answer.optionId)
		return { answer, scenario, option }
	})

	if (isFinished && !isConfirmed) {
		return (
			<Summary
				run={run}
				plan={plan}
				answered={answered}
				assessmentLabel={assessmentLabel}
				links={links}
				labelOf={(criterion) => tAssessment(`criteria.${criterion}.label`)}
				skillName={(skill) => tAssessment(`skills.${skill}.name`)}
			/>
		)
	}

	const justAnswered = isConfirmed ? answered[answered.length - 1] : null
	const shown = justAnswered?.scenario ?? current
	if (shown == null) return null
	const chosen = justAnswered?.option ?? shown.options.find((each) => each.id === selected) ?? null

	return (
		<div
			className="mx-auto grid w-full max-w-6xl gap-10 lg:grid-cols-[15rem_minmax(0,1fr)]"
			data-testid="scenario-session"
		>
			<aside
				aria-label={t('progress.listHeading')}
				className="border-border-strong bg-surface hidden h-fit flex-col gap-4 border p-4 lg:sticky lg:top-24 lg:flex"
			>
				<p className="app-eyebrow">{t('progress.listHeading')}</p>
				<ol className="flex flex-col gap-3">
					{plan.slots.map((slot, slotIndex) => {
						const doneRow = answered[slotIndex]
						const isHere = slotIndex === (isConfirmed ? answers.length - 1 : answers.length)
						const title =
							doneRow?.scenario?.title ?? (isHere ? shown.title : t('progress.upcoming'))
						return (
							<li
								key={slotIndex}
								className={`flex items-start gap-3 text-sm ${isHere ? 'text-text' : 'text-text-muted'}`}
							>
								<span
									className={`app-keycap shrink-0 ${isHere ? '!border-accent !text-text' : ''}`}
								>
									{doneRow == null || isHere ? slotIndex + 1 : <CheckIcon size={12} />}
								</span>
								<span className="flex min-w-0 flex-col gap-0.5">
									<span className="leading-snug">{title}</span>
									<span className="text-text-faint text-xs">
										{tAssessment(`skills.${slot}.name`)}
									</span>
								</span>
							</li>
						)
					})}
				</ol>
			</aside>
			<div key={shown.id} className="dj-scene flex min-w-0 flex-col gap-8">
				<header className="flex flex-col gap-3">
					<p className="text-text-muted text-xs max-md:hidden">{assessmentLabel}</p>
					<ol
						className="dj-marks"
						aria-label={t('progress.label', {
							current: Math.min(index + (isConfirmed ? 0 : 1), total),
							total
						})}
						data-testid="scenario-progress"
					>
						{plan.slots.map((slot, slotIndex) => {
							const done = slotIndex < answers.length
							const here = slotIndex === (isConfirmed ? answers.length - 1 : answers.length)
							return (
								<li
									key={slotIndex}
									aria-current={here ? 'step' : undefined}
									className="dj-mark"
									data-state={done ? 'done' : here ? 'here' : 'next'}
								>
									<SwordsIcon size={18} />
									<span className="sr-only">
										{t('progress.step', { number: slotIndex + 1, total })}
										{done ? ` ${t('progress.answered')}` : ''}
									</span>
								</li>
							)
						})}
					</ol>
					<p className="dj-meta" data-testid="scenario-count">
						<span>
							{t('progress.label', {
								current: isConfirmed ? answers.length : answers.length + 1,
								total
							})}{' '}
							· {tAssessment(`skills.${shown.skill}.name`)}
						</span>
						<span className="dj-diff" title={t(`difficulty.${shown.difficulty}`)}>
							<span className="sr-only">
								{t('difficulty.label')} {t(`difficulty.${shown.difficulty}`)}
							</span>
							{[1, 2, 3].map((pip) => (
								<i key={pip} aria-hidden="true" data-on={shown.difficulty >= pip} />
							))}
						</span>
						<span className="dj-tag">{tAssessment(`criteria.${shown.criterion}.label`)}</span>
					</p>
				</header>

				<section aria-labelledby="scenario-title" className="flex flex-col gap-4">
					<h2 id="scenario-title" className="app-heading">
						{shown.title}
					</h2>
					<div className="dj-situation">
						<ScrollIcon size={22} className="dj-situation-icon" />
						<div className="flex flex-col gap-0.5">
							<p className="dj-label">{t('situation')}</p>
							<p>{shown.setup}</p>
						</div>
					</div>
					<Conversation scenario={shown} />
				</section>

				{justAnswered == null ? (
					<form
						className="flex flex-col gap-5"
						onSubmit={(event) => {
							event.preventDefault()
							confirm()
						}}
					>
						<fieldset className="flex flex-col gap-3">
							<legend className="mb-2 text-lg">{shown.question}</legend>
							{orderedOptions(shown).map((option) => (
								<label
									key={option.id}
									data-testid="answer-card"
									data-picked={selected === option.id}
									className="dj-answer"
								>
									<input
										type="radio"
										name="answer"
										value={option.id}
										checked={selected === option.id}
										onChange={() => setSelected(option.id)}
										className="sr-only"
									/>
									<span aria-hidden="true" className="dj-answer-key">
										{selected === option.id ? (
											<CheckIcon size={16} />
										) : (
											String.fromCharCode(65 + orderedOptions(shown).indexOf(option))
										)}
									</span>
									<span className="break-words whitespace-pre-wrap">{option.label}</span>
								</label>
							))}
						</fieldset>
						{chosen == null ? null : (
							<div className="flex flex-col gap-3" data-testid="confirm-step">
								<p className="dj-pick">
									<span className="dj-answer-key" aria-hidden="true">
										{String.fromCharCode(65 + orderedOptions(shown).indexOf(chosen))}
									</span>
									<span className="sr-only">
										{t('confirm.heading')} {t('confirm.chose')}
									</span>
									<span className="dj-pick-label">
										Your pick: {String.fromCharCode(65 + orderedOptions(shown).indexOf(chosen))}
									</span>
								</p>
								<label htmlFor="reasoning" className="text-text-muted text-sm">
									{t('confirm.why')}
								</label>
								<textarea
									id="reasoning"
									value={reasoning}
									rows={2}
									maxLength={400}
									onChange={(event) => setReasoning(event.target.value)}
									className="border-border-strong bg-surface w-full border p-3 text-sm"
								/>
								<p className="text-text-faint text-xs max-md:hidden">{t('confirm.note')}</p>
								<div className="dj-actionbar">
									<button type="submit" className="app-pill">
										{t('confirm.submit')}
									</button>
									<button type="button" className="app-nav-link" onClick={() => setSelected(null)}>
										{t('confirm.change')}
									</button>
								</div>
							</div>
						)}
					</form>
				) : (
					<Coaching
						run={run}
						step={answers.length}
						scenario={justAnswered.scenario ?? shown}
						optionId={justAnswered.answer.optionId}
						reasoning={justAnswered.answer.reasoning}
						isLast={answers.length >= total}
						onContinue={next}
						criterionLabel={tAssessment(`criteria.${shown.criterion}.label`)}
					/>
				)}
			</div>
		</div>
	)
}

function difficultyStart(plan: PracticePlan): Record<SkillId, Difficulty> {
	const start = {} as Record<SkillId, Difficulty>
	for (const each of plan.skills) start[each.skill] = each.start
	return start
}

/** What the answer just earned, read from the same XP ledger the summary uses: one total. */
function AnswerReward({ run, step }: { run: string; step: number }) {
	const { state } = useProgress()
	if (state == null) return null
	const entries = state.ledger.filter((entry) => entry.run === run && entry.step === step)
	if (entries.length === 0) return null
	const total = entries.reduce((sum, entry) => sum + entry.xp, 0)
	const sealed = entries.some((entry) => entry.source === 'seal')
	const objective = questsOf(state).find((quest) => quest.id === 'three-scenarios')
	return (
		<div className="dj-reward-row" data-testid="answer-reward">
			<span className="dj-xp-chip" title={entries.map((e) => `${e.label} +${e.xp}`).join(', ')}>
				<XpIcon size={18} filled />+{total} XP
			</span>
			{sealed ? (
				<span className="dj-reward-note">A seal was earned. See it at the end.</span>
			) : null}
			{objective == null ? null : (
				<span className="dj-reward-quest">
					<span>
						{objective.title} {objective.progress}/{objective.goal}
					</span>
					<span aria-hidden="true" className="app-meter">
						<span style={{ width: `${(objective.progress / objective.goal) * 100}%` }} />
					</span>
				</span>
			)}
		</div>
	)
}

function Coaching({
	run,
	step,
	scenario,
	optionId,
	reasoning,
	isLast,
	onContinue,
	criterionLabel
}: {
	run: string
	step: number
	scenario: Scenario
	optionId: string
	reasoning: string
	isLast: boolean
	onContinue: () => void
	criterionLabel: string
}) {
	const t = useTranslations('Practice.session')
	const option = scenario.options.find((each) => each.id === optionId)
	const best = scenario.options.find((each) => each.quality === 'effective')
	if (option == null || best == null) return null
	const good = option.quality === 'effective'
	return (
		<section
			aria-labelledby="coaching-heading"
			aria-live="polite"
			data-testid="coaching"
			data-quality={option.quality}
			className="dj-coach"
		>
			<span className="dj-slash" aria-hidden="true" />
			<h3 id="coaching-heading" className="sr-only">
				{t('coaching.heading')} · {criterionLabel}
			</h3>
			<div className="dj-verdict" data-tone={option.quality}>
				<span className="dj-verdict-badge" aria-hidden="true">
					{good ? (
						<CheckIcon size={22} />
					) : option.quality === 'partial' ? (
						<InfoIcon size={22} />
					) : (
						<AlertIcon size={22} />
					)}
				</span>
				<div className="flex min-w-0 flex-col gap-1">
					<p className="dj-verdict-title">{t(`coaching.quality.${option.quality}`)}</p>
					<p className="text-sm">{option.why}</p>
				</div>
			</div>
			<AnswerReward run={run} step={step} />
			<div className="dj-pick-row">
				<p className="dj-label">{t('coaching.chose')}</p>
				<p className="dj-pick-text break-words whitespace-pre-wrap">“{option.label}”</p>
				{reasoning.trim() === '' ? null : (
					<p className="text-text-muted text-sm">
						{t('coaching.yourReason')} {reasoning}
					</p>
				)}
			</div>
			{good ? null : (
				<div className="dj-better">
					<p className="dj-label">
						<SwordsIcon size={16} />
						{t('coaching.better')}
					</p>
					<p className="text-sm">{scenario.better}</p>
					<blockquote className="dj-example break-words whitespace-pre-wrap">
						{best.label}
					</blockquote>
				</div>
			)}
			<div className="dj-takeaway">
				<ScrollIcon size={20} className="dj-situation-icon" />
				<div className="flex flex-col gap-0.5">
					<p className="dj-label">{t('coaching.takeaway')}</p>
					<p>{scenario.takeaway}</p>
				</div>
			</div>
			<details className="dj-why">
				<summary>{t('coaching.matters')}</summary>
				<p>{scenario.matters}</p>
			</details>
			<div className="dj-actionbar">
				<button type="button" className="app-pill" onClick={onContinue} data-testid="continue">
					{isLast ? t('coaching.finish') : t('coaching.continue')}
				</button>
			</div>
		</section>
	)
}

function Summary({
	run,
	plan,
	answered,
	assessmentLabel,
	links,
	labelOf,
	skillName
}: {
	run: string
	plan: PracticePlan
	answered: readonly {
		answer: Answer
		scenario: Scenario | undefined
		option: Scenario['options'][number] | undefined
	}[]
	assessmentLabel: string
	links: ScenarioLinks
	labelOf: (criterion: CriterionId) => string
	skillName: (skill: SkillId) => string
}) {
	const t = useTranslations('Practice.session')
	const rows = answered.flatMap((row) =>
		row.scenario == null || row.option == null
			? []
			: [{ scenario: row.scenario, option: row.option, reasoning: row.answer.reasoning }]
	)
	const bySkill = plan.skills.map((entry: PlanSkill) => {
		const own = rows.filter((row) => row.scenario.skill === entry.skill)
		return {
			entry,
			total: own.length,
			effective: own.filter((row) => row.option.quality === 'effective').length
		}
	})
	const habits = [
		...new Set(
			rows.filter((row) => row.option.quality === 'effective').map((row) => row.scenario.criterion)
		)
	]
	const toWorkOn = [
		...new Set(
			rows.filter((row) => row.option.quality !== 'effective').map((row) => row.scenario.criterion)
		)
	]
	const effectiveTotal = rows.filter((row) => row.option.quality === 'effective').length
	const recorded = useRef(false)
	const { state: progress } = useProgress()
	useEffect(() => {
		if (recorded.current || rows.length === 0) return
		recorded.current = true
		updateProgress((state, today) => recordPracticeSession(state, run, today))
	}, [rows.length, run])
	const ledger = progress == null ? null : runSummary(progress, run)
	const rank = progress == null ? null : levelOf(progress.xp)
	const before = progress == null || ledger == null ? null : levelOf(progress.xp - ledger.total)
	const sealsEarned = (ledger?.entries ?? [])
		.filter((entry) => entry.source === 'seal')
		.flatMap((entry) => ACHIEVEMENTS.filter((a) => entry.label === `Seal: ${a.title}`))
	const questsPaid = (ledger?.entries ?? []).filter((entry) => entry.source === 'quest')
	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-10" data-testid="practice-summary">
			<header className="app-hero flex items-center gap-5 p-4 md:gap-8 md:p-10">
				<div
					className="app-ring app-ring-md md:app-ring-lg"
					style={
						{
							'--v': rows.length === 0 ? 0 : (effectiveTotal / rows.length) * 100
						} as React.CSSProperties
					}
				>
					<span className="app-number">
						{effectiveTotal}/{rows.length}
					</span>
				</div>
				<div className="flex min-w-0 flex-col gap-2">
					<h2 className="app-heading !text-[clamp(22px,4vw,34px)]">{t('summary.heading')}</h2>
					<details className="text-sm">
						<summary className="app-eyebrow text-text-muted cursor-pointer">
							About this score
						</summary>
						<p className="mt-2">{t('summary.honest')}</p>
						<p className="text-text-muted mt-1 text-xs">{assessmentLabel}</p>
					</details>
				</div>
			</header>

			<section
				aria-label="Rewards earned"
				data-testid="practice-rewards"
				className="dj-scroll dj-summary dj-rise"
			>
				<div className="flex items-center justify-between gap-3">
					<p className="pg-title">XP earned</p>
					<span
						className="app-chip"
						title="Progression is a demo kept in this browser. It does not change your assessment."
					>
						Demo
					</span>
				</div>
				{ledger == null ? null : (
					<>
						<p className="flex items-baseline gap-2">
							<span className="pg-big dj-pop" data-testid="session-xp-total">
								+{ledger.total}
							</span>
							<span className="text-text-muted text-sm">XP</span>
						</p>
						<dl className="dj-tiles">
							{[
								{ label: 'Answers', value: ledger.scenario },
								{ label: 'Session', value: ledger.session },
								{ label: 'Quests', value: ledger.quests },
								{ label: 'Seals', value: ledger.seals }
							].map((tile) => (
								<div
									key={tile.label}
									className="dj-tile"
									style={tile.value === 0 ? { opacity: 0.45 } : undefined}
								>
									<dd className="m-0">
										<b>+{tile.value}</b>
									</dd>
									<dt>
										<span>{tile.label}</span>
									</dt>
								</div>
							))}
						</dl>
					</>
				)}
				{rank == null || before == null ? null : (
					<div className="flex flex-col gap-2" data-testid="rank-progress">
						<p className="flex items-center justify-between gap-3 text-sm">
							<span className="flex items-center gap-2">
								<HankoMark size={26} />
								{before.level === rank.level ? (
									<b className="font-normal">{rank.title}</b>
								) : (
									<b className="font-normal">
										{before.title} → {rank.title}
									</b>
								)}
							</span>
							<span className="text-text-muted text-xs tabular-nums">
								{rank.xp} XP{rank.isMax ? '' : ` · ${rank.toNext} to ${rank.nextTitle}`}
							</span>
						</p>
						<span className="dj-rankbar" aria-hidden="true">
							<i
								className="was"
								style={{
									width: `${before.level === rank.level ? (before.into / before.span) * 100 : 0}%`
								}}
							/>
							<i
								className="now"
								style={{ width: `${rank.isMax ? 100 : (rank.into / rank.span) * 100}%` }}
							/>
						</span>
					</div>
				)}
				{questsPaid.length > 0 ? (
					<ul className="sr-only">
						{questsPaid.map((entry) => (
							<li key={entry.id}>
								{entry.label} · +{entry.xp} XP
							</li>
						))}
					</ul>
				) : null}
				{sealsEarned.length > 0 ? (
					<ul className="dj-shelf md:flex-wrap" aria-label="Seals earned">
						{sealsEarned.map((seal) => (
							<li
								key={seal.id}
								className="pg-badge dj-reveal-seal !cursor-default"
								data-rarity={seal.rarity}
								data-locked="false"
								style={{ minWidth: '8.5rem' }}
							>
								<BadgeArt achievement={seal} size={96} />
								<span className="text-sm leading-tight">{seal.title}</span>
								<span className="pg-rarity">{seal.rarity}</span>
							</li>
						))}
					</ul>
				) : null}
			</section>

			<section aria-labelledby="skills-heading" className="flex flex-col gap-4">
				<h3 id="skills-heading" className="app-eyebrow">
					<b>●</b> {t('summary.skills')}
				</h3>
				<ul className="grid gap-4 sm:grid-cols-3">
					{bySkill.map(({ entry, total, effective }) => (
						<li key={entry.skill} className="app-panel flex flex-col gap-4 p-5">
							<span className="flex items-center gap-3">
								<SkillGlyph skill={entry.skill} active={entry.isWeak} />
								<span className="leading-snug">{skillName(entry.skill)}</span>
							</span>
							<span aria-hidden="true" className="flex gap-1">
								{Array.from({ length: total }, (_, pip) => (
									<i
										key={pip}
										className={`block h-1.5 flex-1 ${pip < effective ? 'bg-[var(--brass)]' : 'bg-border-strong'}`}
									/>
								))}
							</span>
							<span className="text-text-muted text-sm">
								{t('summary.effective', { effective, total })} ·{' '}
								{t('summary.assessmentScore', { score: entry.score })}
							</span>
						</li>
					))}
				</ul>
			</section>

			<section aria-labelledby="habits-heading" className="grid gap-4 sm:grid-cols-2">
				<div className="app-panel flex flex-col gap-3 p-5">
					<h3 id="habits-heading" className="app-eyebrow">
						{t('summary.habits')}
					</h3>
					{habits.length === 0 ? (
						<p className="text-text-faint text-sm">{t('summary.noHabits')}</p>
					) : (
						<ul className="flex flex-col gap-2 text-sm">
							{habits.map((criterion) => (
								<li key={criterion} className="flex items-center gap-2">
									<CheckIcon size={14} />
									{labelOf(criterion)}
								</li>
							))}
						</ul>
					)}
				</div>
				<div className="app-panel flex flex-col gap-3 p-5">
					<h3 className="app-eyebrow">{t('summary.workOn')}</h3>
					{toWorkOn.length === 0 ? (
						<p className="text-text-faint text-sm">{t('summary.noWorkOn')}</p>
					) : (
						<ul className="flex flex-col gap-2 text-sm">
							{toWorkOn.map((criterion) => (
								<li key={criterion} className="flex items-center gap-2">
									<AlertIcon size={14} />
									{labelOf(criterion)}
								</li>
							))}
						</ul>
					)}
				</div>
			</section>

			<section aria-labelledby="each-heading" className="flex flex-col gap-4">
				<h3 id="each-heading" className="app-eyebrow">
					<b>●</b> {t('summary.each')}
				</h3>
				<ol className="flex flex-col">
					{rows.map((row, index) => (
						<li
							key={row.scenario.id}
							className="border-border grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-4 border-t py-4"
							data-testid="summary-row"
						>
							<span
								aria-hidden="true"
								className={`app-keycap ${row.option.quality === 'effective' ? '!border-text !text-text' : row.option.quality === 'ineffective' ? '!border-accent !text-accent-text' : ''}`}
							>
								{row.option.quality === 'effective' ? (
									<CheckIcon size={14} />
								) : row.option.quality === 'ineffective' ? (
									<AlertIcon size={14} />
								) : (
									<InfoIcon size={14} />
								)}
							</span>
							<div className="flex min-w-0 flex-col gap-1">
								<p className="app-eyebrow">
									{index + 1} · {row.scenario.title} · {t(`coaching.quality.${row.option.quality}`)}
								</p>
								<p className="text-text-muted text-sm break-words whitespace-pre-wrap max-md:hidden">
									{t('coaching.chose')} “{row.option.label}”
								</p>
								<p className="text-sm max-md:hidden">{row.scenario.takeaway}</p>
							</div>
						</li>
					))}
				</ol>
			</section>

			<section aria-labelledby="next-heading" className="flex flex-col gap-4">
				<h3 id="next-heading" className="app-eyebrow">
					<b>●</b> {t('summary.next')}
				</h3>
				<ul className="grid gap-3 text-sm max-md:hidden sm:grid-cols-3">
					<li className="app-panel p-4">{t('summary.nextUpload')}</li>
					<li className="app-panel p-4">{t('summary.nextDrill')}</li>
					<li className="app-panel p-4">{t('summary.nextConversation')}</li>
				</ul>
				<div className="dj-shelf md:mx-0 md:flex-wrap md:items-center md:p-0">
					<Link href={links.upload} className="app-pill">
						{t('summary.upload')}
					</Link>
					<Link href={links.drill} className="app-pill app-pill-sm">
						{t('summary.drill')}
					</Link>
					<Link href={links.conversation} className="app-pill app-pill-sm">
						{t('summary.conversation')}
					</Link>
					<Link href={links.assessment} className="app-pill app-pill-sm">
						{t('summary.assessment')}
					</Link>
					<Link href={links.restart} className="app-pill app-pill-sm">
						{t('summary.again')}
					</Link>
				</div>
			</section>
			<div className="dj-actionbar dj-only-phone">
				<Link href="/dashboard" className="app-pill" data-testid="back-to-dojo">
					Back to the dojo
				</Link>
			</div>
		</div>
	)
}
