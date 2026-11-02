import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/features/app-shell/section'
import { AuthForm } from '@/features/auth/auth-form'
import { Link } from '@/i18n/routing'
import { requestPasswordReset } from '@/server/actions/auth'

export async function generateMetadata({
	params
}: {
	params: Promise<{ locale: string }>
}): Promise<Metadata> {
	const t = await getTranslations({ locale: (await params).locale, namespace: 'Auth' })
	return { title: { absolute: t('forgot.meta') } }
}

export default async function ForgotPasswordPage() {
	const t = await getTranslations('Auth')
	return (
		<main className="flex flex-col gap-12 px-5 py-14 md:px-14 md:py-20">
			<PageHeader eyebrow={t('eyebrow')} title={t('forgot.title')} intro={t('forgot.intro')} />
			<AuthForm
				action={requestPasswordReset}
				submitLabel={t('forgot.submit')}
				fields={[{ name: 'email', type: 'email', label: t('fields.email'), autoComplete: 'email' }]}
			/>
			<Link href="/sign-in" className="text-text-muted text-sm underline underline-offset-4">
				{t('forgot.back')}
			</Link>
		</main>
	)
}
