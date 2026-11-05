'use client'

import { useEffect, useRef, useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { CloseIcon, EditIcon } from '@/components/ui/icons'
import type { ReviewNote } from '../review-store'

/** The floating button, bottom right, with the number of notes. */
export function NotesButton({
	count,
	isOpen,
	onToggle
}: {
	count: number
	isOpen: boolean
	onToggle: () => void
}) {
	const t = useTranslations('Review.notes')
	return (
		<button
			type="button"
			onClick={onToggle}
			aria-expanded={isOpen}
			aria-controls="notes-drawer"
			data-testid="notes-button"
			className="app-pill bg-surface fixed right-4 bottom-20 z-40 shadow-lg max-md:bottom-[calc(136px+env(safe-area-inset-bottom,0px))] lg:right-8 lg:bottom-8"
		>
			<EditIcon size={14} />
			{t('button', { count })}
		</button>
	)
}

/**
 * A medium-width drawer beside the conversation. Notes are the reader's own,
 * timestamped, and live in this browser only; the drawer says so.
 */
export function NotesDrawer({
	notes,
	activeNumber,
	scopeNote,
	couldNotSave,
	onAdd,
	onClose
}: {
	notes: readonly ReviewNote[]
	/** The selected finding's position, when one is selected. */
	activeNumber: number | null
	scopeNote: 'browser' | 'sample'
	couldNotSave: boolean
	onAdd: (text: string, attachToActive: boolean) => void
	onClose: () => void
}) {
	const t = useTranslations('Review.notes')
	const format = useFormatter()
	const [text, setText] = useState('')
	const [attach, setAttach] = useState(true)
	const input = useRef<HTMLTextAreaElement>(null)

	useEffect(() => {
		input.current?.focus()
	}, [])

	const ordered = [...notes].reverse()
	return (
		<aside
			id="notes-drawer"
			role="complementary"
			aria-label={t('heading')}
			data-testid="notes-drawer"
			onKeyDown={(event) => {
				if (event.key === 'Escape') onClose()
			}}
			className="border-border-strong bg-surface fixed top-0 right-0 bottom-0 z-50 flex w-full max-w-md flex-col gap-5 border-l p-5 shadow-2xl"
		>
			<header className="flex items-center justify-between gap-4">
				<h2 className="app-eyebrow">{t('heading')}</h2>
				<button type="button" onClick={onClose} className="app-nav-link" aria-label={t('close')}>
					<CloseIcon size={16} />
				</button>
			</header>
			<p className="text-text-muted text-xs">{t(`scope.${scopeNote}`)}</p>
			{couldNotSave ? (
				<p role="alert" className="text-danger text-xs">
					{t('couldNotSave')}
				</p>
			) : null}
			<form
				className="flex flex-col gap-3"
				onSubmit={(event) => {
					event.preventDefault()
					if (text.trim() === '') return
					onAdd(text, attach && activeNumber != null)
					setText('')
				}}
			>
				<label htmlFor="note-text" className="sr-only">
					{t('label')}
				</label>
				<textarea
					id="note-text"
					ref={input}
					value={text}
					rows={4}
					maxLength={2000}
					placeholder={t('placeholder')}
					onChange={(event) => setText(event.target.value)}
					className="border-border-strong bg-bg w-full border p-3 text-sm leading-relaxed"
				/>
				{activeNumber == null ? null : (
					<label className="text-text-muted flex items-center gap-2 text-xs">
						<input
							type="checkbox"
							checked={attach}
							onChange={(event) => setAttach(event.target.checked)}
						/>
						{t('attach', { number: activeNumber })}
					</label>
				)}
				<button type="submit" className="app-pill self-start" disabled={text.trim() === ''}>
					{t('add')}
				</button>
			</form>
			<ul className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto" data-testid="notes-list">
				{ordered.length === 0 ? <li className="text-text-faint text-sm">{t('empty')}</li> : null}
				{ordered.map((note) => (
					<li key={note.id} className="border-border flex flex-col gap-1 border-t pt-3">
						<p className="text-text-faint text-xs">
							<time dateTime={note.at}>
								{format.dateTime(new Date(note.at), { dateStyle: 'medium', timeStyle: 'short' })}
							</time>
						</p>
						<p className="text-sm break-words whitespace-pre-wrap">{note.text}</p>
					</li>
				))}
			</ul>
		</aside>
	)
}
