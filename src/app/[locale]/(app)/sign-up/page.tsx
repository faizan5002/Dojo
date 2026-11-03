import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/features/app-shell/section'
import { AuthForm } from '@/features/auth/auth-form'
import { SampleCallout } from '@/features/sample/ui/sample-callout'
import { Link } from '@/i18n/routing'
import { signUp } from '@/server/actions/auth'
import { getCurrentUser, isAuthConfigured } from '@/server/auth/current-user'

const MIN_PASSWORD_LENGTH = 10

export async function generateMetadata({
	params
}: {
	params: Promise<{ locale: string }>
}): Promise<Metadata> {
	const t = await getTranslations({ locale: (await params).locale, namespace: 'Auth' })
	return { title: { absolute: t('signUp.meta') } }
}

export default async function SignUpPage() {
	if ((await getCurrentUser()) != null) redirect('/sessions')
	const t = await getTranslations('Auth')

	return (
		<main className="flex flex-col gap-12 px-5 py-14 md:px-14 md:py-20">
			<PageHeader
				eyebrow={t('eyebrow')}
				title={t('signUp.title')}
				intro={t('signUp.intro')}
				note={t('signUp.privacy')}
			/>
			<SampleCallout />
			{isAuthConfigured() ? null : (
				<p className="text-danger text-sm">{t('codes.notConfigured')}</p>
			)}
			<AuthForm
				action={signUp}
				submitLabel={t('signUp.submit')}
				fields={[
					{ name: 'email', type: 'email', label: t('fields.email'), autoComplete: 'email' },
					{
						name: 'password',
						type: 'password',
						label: t('fields.password'),
						autoComplete: 'new-password',
						hint: t('signUp.passwordHint', { min: MIN_PASSWORD_LENGTH })
					}
				]}
			/>
			<p className="text-text-muted text-sm">
				{t('signUp.haveAccount')}{' '}
				<Link href="/sign-in" className="text-text underline underline-offset-4">
					{t('signUp.signInLink')}
				</Link>
			</p>
		</main>
	)
}
