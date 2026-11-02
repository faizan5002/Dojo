'use client'

import { useState, useTransition } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { Link, useRouter } from '@/i18n/routing'
import { deleteUploadAction } from '@/server/actions/workspace'

export interface UploadListItem {
	readonly id: string
	readonly createdAt: Date
	readonly sessionCount: number
	readonly promptCount: number
	readonly redactionCount: number
	readonly assessmentCount: number
}

/** Two clicks: the first asks, the second deletes. Deletion is checked on the server. */
export function DeleteUploadButton({ uploadId }: { uploadId: string }) {
	const t = useTranslations('Uploads')
	const router = useRouter()
	const [isConfirming, setIsConfirming] = useState(false)
	const [hasFailed, setHasFailed] = useState(false)
	const [note, setNote] = useState<string | null>(null)
	const [isPending, startTransition] = useTransition()

	function handleClick() {
		if (!isConfirming) {
			setIsConfirming(true)
			return
		}
		startTransition(async () => {
			const result = await deleteUploadAction({ uploadId })
			if (!result.ok) {
				setNote(result.status === 403 ? result.error : null)
				setHasFailed(true)
				setIsConfirming(false)
				return
			}
			router.push('/sessions')
			router.refresh()
		})
	}

	return (
		<span className="inline-flex flex-col gap-1">
			<button
				type="button"
				className="app-pill"
				disabled={isPending}
				aria-busy={isPending}
				onClick={handleClick}
			>
				{isConfirming ? t('confirmDelete') : t('delete')}
			</button>
			{hasFailed ? <span className="text-danger text-xs">{note ?? t('deleteFailed')}</span> : null}
		</span>
	)
}

export function UploadList({
	uploads,
	selectedId
}: {
	uploads: readonly UploadListItem[]
	selectedId: string | null
}) {
	const t = useTranslations('Uploads')
	const format = useFormatter()
	if (uploads.length === 0) return <p className="text-text-muted text-sm">{t('none')}</p>
	return (
		<ul className="border-border flex flex-col border-t">
			{uploads.map((upload) => (
				<li
					key={upload.id}
					className="border-border flex flex-wrap items-center justify-between gap-4 border-b py-4"
				>
					<div className="flex flex-col gap-1">
						<p>
							{format.dateTime(upload.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}
							{upload.id === selectedId ? (
								<span className="app-eyebrow text-text ml-3">{t('viewing')}</span>
							) : null}
						</p>
						<p className="text-text-muted text-sm">
							{t('summary', {
								sessions: upload.sessionCount,
								prompts: upload.promptCount,
								redactions: upload.redactionCount,
								assessments: upload.assessmentCount
							})}
						</p>
					</div>
					<div className="flex flex-wrap items-center gap-3">
						{upload.id === selectedId ? null : (
							<Link href={`/sessions?upload=${upload.id}`} className="app-nav-link">
								{t('view')}
							</Link>
						)}
						<DeleteUploadButton uploadId={upload.id} />
					</div>
				</li>
			))}
		</ul>
	)
}
