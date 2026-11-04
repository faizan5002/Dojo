import { useTranslations } from 'next-intl'

const BLOCK = 'bg-surface border-border animate-pulse border motion-reduce:animate-none'

// Shown while the dashboard's data loads: the same shape as the page, coaching block
// first, as quiet blocks that stop pulsing for people who prefer less motion.
export default function DashboardLoading() {
	const t = useTranslations('Dashboard')
	return (
		<main
			aria-busy="true"
			aria-label={t('loading')}
			className="flex flex-col gap-8 px-5 py-8 md:px-14 md:py-10"
		>
			<div className={`${BLOCK} h-7 w-64`} />
			<div className={`${BLOCK} h-72`} />
			<div className="grid grid-cols-1 gap-8 xl:grid-cols-12">
				<div className={`${BLOCK} h-64 xl:col-span-5`} />
				<div className={`${BLOCK} h-96 xl:col-span-7`} />
			</div>
			<p role="status" className="sr-only">
				{t('loading')}
			</p>
		</main>
	)
}
