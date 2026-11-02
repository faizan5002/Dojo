import { NextResponse, type NextRequest } from 'next/server'
import { getTranslations } from 'next-intl/server'
import { z } from 'zod'
import { renderReportPdf } from '@/features/assessment/report/render-report'
import { getAssessment } from '@/features/workspace/repository'
import { routing } from '@/i18n/routing'
import { captureError } from '@/lib/observability/capture-error'
import { getCurrentUser } from '@/server/auth/current-user'
import { db } from '@/server/db/client'

// A report is the signed-in user's own data: never cached, never shared.
const PRIVATE = { 'Cache-Control': 'private, no-store' }

const failure = (status: number, error: string) =>
	NextResponse.json({ error }, { status, headers: PRIVATE })

/**
 * The PDF report of one saved assessment. The id is looked up within the
 * signed-in user's own assessments, so another account's id is a 404, the
 * same answer as an id that does not exist. The PDF is built in memory from
 * the stored assessment; nothing is re-scored and no file is written.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const user = await getCurrentUser()
	if (user == null) return failure(401, 'Sign in to download this report.')
	const id = z
		.string()
		.uuid()
		.safeParse((await params).id)
	if (!id.success) return failure(404, 'That assessment could not be found.')
	const stored = await getAssessment({ db, userId: user.id, assessmentId: id.data })
	if (stored == null) return failure(404, 'That assessment could not be found.')

	try {
		const [profile, t] = await Promise.all([
			db.user.findUnique({ where: { id: user.id }, select: { name: true } }),
			getTranslations({ locale: routing.defaultLocale })
		])
		const { pdf, filename } = await renderReportPdf({
			stored,
			preparedFor: profile?.name ?? null,
			t: (key, values) => t(key, values)
		})
		return new NextResponse(new Uint8Array(pdf), {
			headers: {
				...PRIVATE,
				'Content-Type': 'application/pdf',
				'Content-Disposition': `attachment; filename="${filename}"`
			}
		})
	} catch (error) {
		const { userMessage, status } = captureError(error)
		return failure(status, userMessage)
	}
}
