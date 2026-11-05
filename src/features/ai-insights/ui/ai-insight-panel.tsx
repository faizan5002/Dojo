'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { SpinnerIcon } from '@/components/ui/icons'
import type { InsightFeature } from '../schemas'
import { generateInsight, readInsight, type InsightOutcome } from './ai-insight-api'
import { InsightContent } from './insight-content'

/**
 * One AI insight, beside the deterministic result it is about. It shows the
 * stored insight when there is one; otherwise it offers to generate it, which
 * only happens on the user's click. Generation can take up to a minute and can
 * fail (AI off, free model busy, quota used up); none of that blocks the page,
 * whose own content is already rendered around this panel.
 */
export function AiInsightPanel({ feature, path }: { feature: InsightFeature; path: string }) {
	const t = useTranslations('AiInsight')
	const queryClient = useQueryClient()
	const queryKey = ['ai-insight', path]
	const stored = useQuery({ queryKey, queryFn: () => readInsight(path) })
	const create = useMutation({
		mutationFn: () => generateInsight(path),
		onSuccess: (outcome: InsightOutcome) => {
			if (outcome.ok) queryClient.setQueryData(queryKey, outcome)
		}
	})

	const insight = stored.data?.ok ? stored.data.insight : null
	const failed = create.data != null && !create.data.ok ? create.data : null
	const readFailed = stored.data != null && !stored.data.ok

	return (
		<div
			className="border-border flex flex-col gap-5 border p-6"
			data-testid={`ai-insight-${feature}`}
			aria-busy={stored.isPending || create.isPending}
		>
			<div className="flex flex-wrap items-center gap-3">
				<span className="app-chip">{t(`labels.${feature}`)}</span>
				<p className="text-text-muted text-xs">{t('notice')}</p>
			</div>

			{stored.isPending ? (
				<p className="text-text-muted text-sm">{t('checking')}</p>
			) : insight != null ? (
				<>
					<InsightContent feature={feature} content={insight.content} />
					<p className="text-text-faint text-xs">{t('generatedBy', { model: insight.model })}</p>
				</>
			) : readFailed ? (
				<div className="flex flex-wrap items-center gap-4">
					<p className="text-sm">{t('readFailed')}</p>
					<button type="button" className="app-pill" onClick={() => stored.refetch()}>
						{t('retry')}
					</button>
				</div>
			) : (
				<div className="flex flex-col items-start gap-4">
					<p className="text-text-muted max-w-2xl text-sm">{t(`intros.${feature}`)}</p>
					<button
						type="button"
						className="app-pill disabled:cursor-wait disabled:opacity-60"
						disabled={create.isPending}
						onClick={() => create.mutate()}
					>
						{create.isPending ? (
							<>
								<SpinnerIcon size={14} className="animate-spin" />
								{t('generating')}
							</>
						) : failed != null ? (
							t('retry')
						) : (
							t(`actions.${feature}`)
						)}
					</button>
					{create.isPending ? <p className="text-text-faint text-xs">{t('slow')}</p> : null}
					<p aria-live="polite" className="text-danger text-sm empty:hidden">
						{failed == null ? '' : (failed.message ?? t('failed'))}
					</p>
				</div>
			)}
		</div>
	)
}
