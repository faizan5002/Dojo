'use client'

import { useState, useTransition } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/base/modal/modal'
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

/**
 * Asks in an alert dialog before deleting (focus is trapped, Escape and Cancel back
 * out, and the dialog is named for assistive technology). Deletion is checked on the server.
 */
export function DeleteUploadButton({ uploadId }: { uploadId: string }) {
	const t = useTranslations('Uploads')
	const router = useRouter()
	const [isOpen, setIsOpen] = useState(false)
	const [hasFailed, setHasFailed] = useState(false)
	const [note, setNote] = useState<string | null>(null)
	const [isPending, startTransition] = useTransition()

	function confirmDelete() {
		startTransition(async () => {
			const result = await deleteUploadAction({ uploadId })
			if (!result.ok) {
				setNote(result.status === 403 ? result.error : null)
				setHasFailed(true)
				setIsOpen(false)
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
				onClick={() => setIsOpen(true)}
			>
				{t('delete')}
			</button>
			<Modal isOpen={isOpen} onOpenChange={setIsOpen} role="alertdialog" size="sm">
				<ModalHeader title={t('deleteTitle')} description={t('deleteBody')} />
				<ModalBody>
					<p className="text-text-muted text-sm">{t('deleteNote')}</p>
				</ModalBody>
				<ModalFooter>
					<button
						type="button"
						className="app-pill"
						disabled={isPending}
						aria-busy={isPending}
						onClick={confirmDelete}
					>
						{t('confirmDelete')}
					</button>
					<button type="button" className="app-nav-link" onClick={() => setIsOpen(false)}>
						{t('cancel')}
					</button>
				</ModalFooter>
			</Modal>
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
