'use client'

import { useId, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { intakeLogFiles, type IntakeResult } from './intake'
import { MAX_LOG_FILE_BYTES, MAX_LOG_FILES } from './limits'
import { SessionMetricsView } from './session-metrics-view'

const BYTES_PER_MEGABYTE = 1024 * 1024
const MAX_MEGABYTES = MAX_LOG_FILE_BYTES / BYTES_PER_MEGABYTE

type IntakeState =
	| { readonly status: 'idle' }
	| { readonly status: 'reading' }
	| { readonly status: 'done'; readonly result: IntakeResult }

// Files are read with the File API and kept only in this component's state:
// no request carries their content, and nothing is written to storage.
export function SessionIntake() {
	const t = useTranslations('Sessions')
	const inputId = useId()
	const hintId = useId()
	const [state, setState] = useState<IntakeState>({ status: 'idle' })

	async function handleFiles(event: React.ChangeEvent<HTMLInputElement>) {
		const input = event.currentTarget
		const files = Array.from(input.files ?? [])
		if (files.length === 0) return
		setState({ status: 'reading' })
		const result = await intakeLogFiles(
			files.map((file) => ({ name: file.name, size: file.size, read: () => file.text() }))
		)
		// Lets the same files be chosen again after a Clear.
		input.value = ''
		setState({ status: 'done', result })
	}

	return (
		<section className="flex flex-col gap-8">
			<div className="border-border bg-surface flex flex-col gap-4 rounded-lg border p-6 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex flex-col gap-1">
					<label
						htmlFor={inputId}
						className="bg-accent text-accent-ink hover:bg-accent-hover has-[:focus-visible]:outline-accent inline-flex h-10 w-fit cursor-pointer items-center rounded px-6 font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2"
					>
						{t('pick')}
						<input
							id={inputId}
							type="file"
							accept=".md,text/markdown"
							multiple
							aria-describedby={hintId}
							className="sr-only"
							onChange={handleFiles}
						/>
					</label>
					<p id={hintId} className="text-text-faint text-sm">
						{t('pickHint', { maxFiles: MAX_LOG_FILES, maxMegabytes: MAX_MEGABYTES })}
					</p>
				</div>
				{state.status === 'done' ? (
					<Button variant="outline" onClick={() => setState({ status: 'idle' })}>
						{t('clear')}
					</Button>
				) : null}
			</div>

			<div aria-live="polite" className="empty:hidden">
				{state.status === 'reading' ? <p className="text-text-muted">{t('reading')}</p> : null}
				{state.status === 'idle' ? <p className="text-text-muted">{t('empty')}</p> : null}
			</div>

			{state.status === 'done' ? (
				<SessionMetricsView
					result={state.result}
					maxFiles={MAX_LOG_FILES}
					maxMegabytes={MAX_MEGABYTES}
				/>
			) : null}
		</section>
	)
}
