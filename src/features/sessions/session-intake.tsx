'use client'

import { useId, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowUpRightIcon } from '@/components/ui/icons'
import { redactSessions } from '@/features/workspace/redact-sessions'
import { Link, useRouter } from '@/i18n/routing'
import { saveUploadAction } from '@/server/actions/workspace'
import { intakeLogFiles } from './intake'
import { MAX_LOG_FILE_BYTES, MAX_LOG_FILES, MAX_UPLOAD_BYTES } from './limits'
import { DeleteUploadButton } from './upload-list'

const BYTES_PER_MEGABYTE = 1024 * 1024
const MAX_MEGABYTES = MAX_LOG_FILE_BYTES / BYTES_PER_MEGABYTE
const MAX_UPLOAD_MEGABYTES = MAX_UPLOAD_BYTES / BYTES_PER_MEGABYTE

type Status = 'idle' | 'reading' | 'saving' | 'tooLarge' | 'saveFailed'

// Files are read with the File API and parsed and redacted in this tab. Only
// the redacted sessions are sent; the raw files never leave the browser. The
// server redacts again before it stores anything.
export function SessionIntake({ selectedUploadId }: { selectedUploadId: string | null }) {
	const t = useTranslations('Sessions')
	const router = useRouter()
	const inputId = useId()
	const hintId = useId()
	const [status, setStatus] = useState<Status>('idle')
	const [note, setNote] = useState<string | null>(null)
	const isBusy = status === 'reading' || status === 'saving'

	async function handleFiles(event: React.ChangeEvent<HTMLInputElement>) {
		const input = event.currentTarget
		const files = Array.from(input.files ?? [])
		input.value = ''
		if (files.length === 0 || isBusy) return
		setStatus('reading')
		const result = await intakeLogFiles(
			files.map((file) => ({ name: file.name, size: file.size, read: () => file.text() }))
		)
		const reasons = new Map(result.rejected.map((file) => [file.fileName, file.reason]))
		const payload = {
			files: files.map((file) => ({ fileName: file.name, reason: reasons.get(file.name) ?? null })),
			sessions: redactSessions(result.sessions)
		}
		if (new Blob([JSON.stringify(payload)]).size > MAX_UPLOAD_BYTES) {
			setStatus('tooLarge')
			return
		}
		setStatus('saving')
		const saved = await saveUploadAction(payload)
		if (!saved.ok) {
			setNote(saved.status === 403 ? saved.error : null)
			setStatus('saveFailed')
			return
		}
		setStatus('idle')
		router.push(`/sessions?upload=${saved.data.uploadId}`)
	}

	return (
		<section className="flex flex-col gap-8">
			<div className="border-border flex flex-col gap-5 border-y py-8 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex flex-col gap-3">
					<label htmlFor={inputId} className="app-pill" aria-disabled={isBusy}>
						{t('pick')}
						<ArrowUpRightIcon size={14} />
						<input
							id={inputId}
							type="file"
							accept=".md,text/markdown"
							multiple
							disabled={isBusy}
							aria-describedby={hintId}
							className="sr-only"
							onChange={handleFiles}
						/>
					</label>
					<p id={hintId} className="text-text-faint text-sm">
						{t('pickHint', { maxFiles: MAX_LOG_FILES, maxMegabytes: MAX_MEGABYTES })}
					</p>
				</div>
				{selectedUploadId == null ? null : (
					<div className="flex flex-wrap gap-3">
						<Link href={`/assessment?upload=${selectedUploadId}`} className="app-pill">
							{t('scoreWorkflow')}
							<ArrowUpRightIcon size={14} />
						</Link>
						<DeleteUploadButton uploadId={selectedUploadId} />
					</div>
				)}
			</div>

			<div aria-live="polite" className="empty:hidden">
				{status === 'reading' ? <p className="text-text-muted">{t('reading')}</p> : null}
				{status === 'saving' ? <p className="text-text-muted">{t('saving')}</p> : null}
				{status === 'tooLarge' ? (
					<p className="text-danger">{t('tooLarge', { maxMegabytes: MAX_UPLOAD_MEGABYTES })}</p>
				) : null}
				{status === 'saveFailed' ? <p className="text-danger">{note ?? t('saveFailed')}</p> : null}
			</div>
		</section>
	)
}
