'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { CopyIcon } from '@/components/ui/icons'

/** Copies the suggested prompt; says so for a moment. */
export function CopyButton({ text }: { text: string }) {
	const t = useTranslations('Guru.result')
	const [isCopied, setIsCopied] = useState(false)

	async function copy() {
		await navigator.clipboard.writeText(text)
		setIsCopied(true)
	}

	return (
		<button type="button" className="app-pill" onClick={copy} onBlur={() => setIsCopied(false)}>
			{isCopied ? t('copied') : t('copy')}
			<CopyIcon size={14} />
		</button>
	)
}
