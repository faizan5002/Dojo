import { useFormatter } from 'next-intl'
import { cn } from '@/lib/cn'
import type { Comparison } from '../dashboard-model'

/**
 * A change in points. Only a comparison that rests on strong evidence is coloured;
 * a provisional one is grey, and no comparison draws nothing. The meaning is always
 * in the text (a sign and a sentence for screen readers), never in colour alone, and
 * there is no tooltip: everything it says is on the page.
 */
export function Change({
	comparison,
	label
}: {
	comparison: Comparison
	/** What the number means, given the formatted signed value. */
	label: (signed: string) => string
}) {
	const format = useFormatter()
	if (comparison.status === 'unavailable') return null
	const { delta } = comparison
	const signed = delta === 0 ? '±0' : format.number(delta, { signDisplay: 'exceptZero' })
	return (
		<span
			className={cn(
				'text-xs tabular-nums',
				comparison.status === 'provisional' || delta === 0
					? 'text-text-muted'
					: delta > 0
						? 'text-success'
						: 'text-danger'
			)}
		>
			<span aria-hidden="true">{signed}</span>
			<span className="sr-only">{label(signed)}</span>
		</span>
	)
}
