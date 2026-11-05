'use client'

import { useId, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowUpRightIcon } from '@/components/ui/icons'
import { Link, useRouter } from '@/i18n/routing'
import { MAX_ANSWER_CHARS } from '../stored'
import { submitAnswer, type ApiFailure } from './practice-api'

const FAILURE_MESSAGES = {
	signedOut: 'sessionExpired',
	notFound: 'unavailable',
	invalid: 'failed',
	failed: 'failed'
} as const satisfies Record<ApiFailure, string>

/**
 * The answer editor. It posts only the text to the challenge's submit
 * endpoint; the score comes back from the server. The text stays in place if
 * scoring fails, including when the session has expired.
 */
export function PracticeEditor({ slug }: { slug: string }) {
	const t = useTranslations('Guru.exercise')
	const router = useRouter()
	const editorId = useId()
	const countId = useId()
	const [text, setText] = useState('')
	const [failure, setFailure] = useState<ApiFailure | null>(null)
	const [isSubmitting, startTransition] = useTransition()
	const words = text.split(/\s+/).filter(Boolean).length
	const isTooLong = text.length > MAX_ANSWER_CHARS
	const canSubmit = text.trim() !== '' && !isTooLong && !isSubmitting

	function submit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault()
		if (!canSubmit) return
		setFailure(null)
		startTransition(async () => {
			const result = await submitAnswer(slug, text)
			if (!result.ok) {
				setFailure(result.reason)
				return
			}
			router.push(`/prompting-guru/challenges/${slug}?attempt=${result.data.id}`)
		})
	}

	return (
		<form onSubmit={submit} className="flex flex-col gap-4">
			<label htmlFor={editorId} className="app-eyebrow">
				{t('answerLabel')}
			</label>
			<textarea
				id={editorId}
				value={text}
				onChange={(event) => setText(event.target.value)}
				placeholder={t('placeholder')}
				aria-describedby={countId}
				rows={12}
				className="app-input min-h-64 resize-y leading-relaxed"
			/>
			<p id={countId} className={isTooLong ? 'text-danger text-xs' : 'text-text-faint text-xs'}>
				{isTooLong
					? t('tooLong', { max: MAX_ANSWER_CHARS })
					: t('count', { words, chars: text.length, max: MAX_ANSWER_CHARS })}
			</p>
			<div className="flex flex-wrap items-center gap-4">
				<button
					type="submit"
					className="app-pill disabled:cursor-not-allowed disabled:opacity-50"
					disabled={!canSubmit}
					aria-busy={isSubmitting}
				>
					{isSubmitting ? t('submitting') : t('submit')}
					<ArrowUpRightIcon size={14} />
				</button>
				<Link href="/prompting-guru" className="app-nav-link">
					{t('exit')}
				</Link>
			</div>
			<div aria-live="polite" className="text-danger text-sm empty:hidden">
				{failure == null ? null : <p>{t(FAILURE_MESSAGES[failure])}</p>}
				{failure === 'signedOut' ? (
					// A new tab, so the answer typed here survives signing in again.
					<Link href="/sign-in" target="_blank" rel="noopener" className="app-nav-link">
						{t('signIn')}
					</Link>
				) : null}
			</div>
			<p className="text-text-faint text-xs">{t('privacy')}</p>
		</form>
	)
}
