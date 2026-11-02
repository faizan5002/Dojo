import { cn } from '@/lib/cn'

// The numbered section heading and hairline stat cell of the app pages.
export function SectionHeading({
	id,
	number,
	children
}: {
	id: string
	number: string
	children: React.ReactNode
}) {
	return (
		<div className="flex flex-col gap-4">
			<p aria-hidden="true" className="app-eyebrow">
				<b>{number}</b>
			</p>
			<h2 id={id} className="app-heading">
				{children}
			</h2>
		</div>
	)
}

export function Stat({
	label,
	value,
	detail,
	className
}: {
	label: string
	value: string
	detail?: string
	className?: string
}) {
	return (
		<div className={cn('border-border flex flex-col gap-3 border-r border-b p-5', className)}>
			<dt className="app-eyebrow">{label}</dt>
			<dd className="app-number">{value}</dd>
			{detail == null ? null : <dd className="text-text-muted text-sm">{detail}</dd>}
		</div>
	)
}
