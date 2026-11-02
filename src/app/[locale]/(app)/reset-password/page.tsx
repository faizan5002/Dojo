import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/features/app-shell/section'
import { AuthForm } from '@/features/auth/auth-form'
import { updatePassword } from '@/server/actions/auth'
import { requireUser } from '@/server/auth/current-user'

const MIN_PASSWORD_LENGTH = 10

export async function generateMetadata({
	params
}: {
	params: Promise<{ locale: string }>
}): Promise<Metadata> {
	const t = await getTranslations({ locale: (await params).locale, namespace: 'Auth' })
	return { title: { absolute: t('reset.meta') } }
}

// Reached from the reset email: the callback has already signed the person in.
export default async function ResetPasswordPage() {
	await requireUser()
	const t = await getTranslations('Auth')
	return (
		<main className="flex flex-col gap-12 px-5 py-14 md:px-14 md:py-20">
			<PageHeader eyebrow={t('eyebrow')} title={t('reset.title')} intro={t('reset.intro')} />
			<AuthForm
				action={updatePassword}
				submitLabel={t('reset.submit')}
				fields={[
					{
						name: 'password',
						type: 'password',
						label: t('fields.newPassword'),
						autoComplete: 'new-password',
						hint: t('signUp.passwordHint', { min: MIN_PASSWORD_LENGTH })
					}
				]}
			/>
		</main>
	)
}
