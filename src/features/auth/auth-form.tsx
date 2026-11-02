'use client'

import { useActionState, useId } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowUpRightIcon } from '@/components/ui/icons'
import type { AuthFormState } from '@/server/actions/auth'

export interface AuthField {
	readonly name: string
	readonly type: 'email' | 'password' | 'text'
	readonly label: string
	readonly autoComplete: string
	readonly hint?: string
}

const INITIAL: AuthFormState = { status: 'idle' }

/** One credentials form: labelled fields, a submit pill, and the action's message. */
export function AuthForm({
	action,
	fields,
	submitLabel
}: {
	action: (previous: AuthFormState, formData: FormData) => Promise<AuthFormState>
	fields: readonly AuthField[]
	submitLabel: string
}) {
	const t = useTranslations('Auth.codes')
	const [state, formAction, isPending] = useActionState(action, INITIAL)
	const formId = useId()

	return (
		<form
			action={formAction}
			className="flex max-w-md flex-col gap-6"
			aria-describedby={`${formId}-message`}
		>
			{fields.map((field) => (
				<div key={field.name} className="flex flex-col gap-2">
					<label htmlFor={`${formId}-${field.name}`} className="app-eyebrow">
						{field.label}
					</label>
					<input
						id={`${formId}-${field.name}`}
						name={field.name}
						type={field.type}
						autoComplete={field.autoComplete}
						required
						aria-describedby={field.hint == null ? undefined : `${formId}-${field.name}-hint`}
						className="app-input"
					/>
					{field.hint == null ? null : (
						<p id={`${formId}-${field.name}-hint`} className="text-text-faint text-xs">
							{field.hint}
						</p>
					)}
				</div>
			))}
			<button
				type="submit"
				className="app-pill disabled:cursor-wait disabled:opacity-60"
				disabled={isPending}
				aria-busy={isPending}
			>
				{submitLabel}
				<ArrowUpRightIcon size={14} />
			</button>
			<p
				id={`${formId}-message`}
				role={state.status === 'error' ? 'alert' : 'status'}
				className={state.status === 'error' ? 'text-danger text-sm' : 'text-text-muted text-sm'}
			>
				{state.code == null ? '' : t(state.code)}
			</p>
		</form>
	)
}
