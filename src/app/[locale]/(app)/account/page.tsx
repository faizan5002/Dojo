import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { PageHeader, SectionHeading } from '@/features/app-shell/section'
import { AuthForm } from '@/features/auth/auth-form'
import { UploadList } from '@/features/sessions/upload-list'
import { listUploads } from '@/features/workspace/workspace-data'
import { deleteAccount } from '@/server/actions/auth'
import { requireUser } from '@/server/auth/current-user'

const STORED = ['parsed', 'metrics', 'assessments', 'account'] as const
const NOT_STORED = ['rawFiles', 'secrets', 'identity', 'thirdParties'] as const

export async function generateMetadata({
	params
}: {
	params: Promise<{ locale: string }>
}): Promise<Metadata> {
	const t = await getTranslations({ locale: (await params).locale, namespace: 'Account' })
	return { title: { absolute: t('meta.title') } }
}

export default async function AccountPage() {
	const user = await requireUser()
	const t = await getTranslations('Account')
	const uploads = await listUploads(user)

	return (
		<main className="flex flex-col gap-16 px-5 py-14 md:px-14 md:py-20">
			<PageHeader
				eyebrow={t('eyebrow')}
				title={t('title')}
				intro={t('signedInAs', { email: user.email })}
			/>

			<section aria-labelledby="privacy-heading" className="flex flex-col gap-8">
				<SectionHeading id="privacy-heading" number="02">
					{t('privacy.heading')}
				</SectionHeading>
				<div className="grid gap-10 lg:grid-cols-2">
					{[
						{ heading: t('privacy.storedHeading'), items: STORED },
						{ heading: t('privacy.notStoredHeading'), items: NOT_STORED }
					].map((group) => (
						<div key={group.heading} className="flex flex-col gap-4">
							<h3 className="app-eyebrow">{group.heading}</h3>
							<ul className="border-border flex flex-col border-t">
								{group.items.map((item) => (
									<li key={item} className="border-border text-text-muted border-b py-3 text-sm">
										{t(`privacy.items.${item}`)}
									</li>
								))}
							</ul>
						</div>
					))}
				</div>
				<p className="text-text-muted max-w-3xl text-sm">{t('privacy.redaction')}</p>
			</section>

			<section aria-labelledby="uploads-heading" className="flex flex-col gap-8">
				<SectionHeading id="uploads-heading" number="03">
					{t('uploads')}
				</SectionHeading>
				<UploadList uploads={uploads} selectedId={null} />
			</section>

			<section aria-labelledby="delete-heading" className="flex flex-col gap-6">
				<SectionHeading id="delete-heading" number="04">
					{t('delete.heading')}
				</SectionHeading>
				<p className="text-text-muted max-w-2xl">{t('delete.body')}</p>
				<AuthForm
					action={deleteAccount}
					submitLabel={t('delete.submit')}
					fields={[
						{
							name: 'confirm',
							type: 'text',
							label: t('delete.confirmLabel'),
							autoComplete: 'off',
							hint: t('delete.confirmHint', { email: user.email })
						}
					]}
				/>
			</section>
		</main>
	)
}
