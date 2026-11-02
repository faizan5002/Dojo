import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/features/app-shell/section'
import { AuthForm } from '@/features/auth/auth-form'
import { Link } from '@/i18n/routing'
import { signIn } from '@/server/actions/auth'
import { getCurrentUser, isAuthConfigured } from '@/server/auth/current-user'

export async function generateMetadata({
	params
}: {
	params: Promise<{ locale: string }>
}): Promise<Metadata> {
	const t = await getTranslations({ locale: (await params).locale, namespace: 'Auth' })
	return { title: { absolute: t('signIn.meta') } }
}

export default async function SignInPage({
	searchParams
}: {
	searchParams: Promise<{ error?: string }>
}) {
	if ((await getCurrentUser()) != null) redirect('/sessions')
	const t = await getTranslations('Auth')
	const hasLinkError = (await searchParams).error === 'link'

	return (
		<main className="flex flex-col gap-12 px-5 py-14 md:px-14 md:py-20">
			<PageHeader eyebrow={t('eyebrow')} title={t('signIn.title')} intro={t('signIn.intro')} />
			{hasLinkError ? <p className="text-danger text-sm">{t('linkError')}</p> : null}
			{isAuthConfigured() ? null : (
				<p className="text-danger text-sm">{t('codes.notConfigured')}</p>
			)}
			<AuthForm
				action={signIn}
				submitLabel={t('signIn.submit')}
				fields={[
					{ name: 'email', type: 'email', label: t('fields.email'), autoComplete: 'email' },
					{
						name: 'password',
						type: 'password',
						label: t('fields.password'),
						autoComplete: 'current-password'
					}
				]}
			/>
			<div className="flex flex-col gap-3 text-sm">
				<p className="text-text-muted">
					{t('signIn.noAccount')}{' '}
					<Link href="/sign-up" className="text-text underline underline-offset-4">
						{t('signIn.signUpLink')}
					</Link>
				</p>
				<Link href="/forgot-password" className="text-text-muted underline underline-offset-4">
					{t('signIn.forgot')}
				</Link>
			</div>
		</main>
	)
}
