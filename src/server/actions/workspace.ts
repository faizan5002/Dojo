'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { AppError } from '@/lib/errors/app-error'
import { deleteUpload, runAssessment, saveUpload } from '@/features/workspace/repository'
import { uploadInputSchema } from '@/features/workspace/stored'
import { requireActionUser } from '@/server/auth/current-user'
import { db } from '@/server/db/client'
import { validatedAction } from './validated-action'

// The workspace's writes. Each one resolves the signed-in user itself and
// passes that id down; an id in the input only ever narrows within it.

const uploadId = z.object({ uploadId: z.string().uuid() })

const notFound = () =>
	new AppError('That upload could not be found.', { status: 404, code: 'not_found' })

export const saveUploadAction = validatedAction({
	input: uploadInputSchema,
	handler: async (input) => {
		const user = await requireActionUser()
		const id = await saveUpload({ db, userId: user.id, input })
		revalidatePath('/sessions')
		return { uploadId: id }
	}
})

export const runAssessmentAction = validatedAction({
	input: uploadId,
	handler: async ({ uploadId }) => {
		const user = await requireActionUser()
		const id = await runAssessment({ db, userId: user.id, uploadId })
		if (id == null) throw notFound()
		revalidatePath('/assessment')
		return { assessmentId: id }
	}
})

export const deleteUploadAction = validatedAction({
	input: uploadId,
	handler: async ({ uploadId }) => {
		const user = await requireActionUser()
		if (!(await deleteUpload({ db, userId: user.id, uploadId }))) throw notFound()
		revalidatePath('/sessions')
		revalidatePath('/assessment')
		return { deleted: true }
	}
})
