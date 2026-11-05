import {
	BrushIcon,
	CycleIcon,
	PlanIcon,
	ScopeIcon,
	VerifyIcon
} from '@/features/progression/ui/dojo-icons'
import type { SkillId } from '@/features/assessment/rubric'

const GLYPHS = {
	promptClarity: BrushIcon,
	planning: PlanIcon,
	verification: VerifyIcon,
	iteration: CycleIcon,
	scopeControl: ScopeIcon
} as const satisfies Record<SkillId, typeof BrushIcon>

/** The skill's own glyph in a square tile: recognised by shape, not by colour. */
export function SkillGlyph({
	skill,
	size = 18,
	active = false
}: {
	skill: SkillId
	size?: number
	active?: boolean
}) {
	const Glyph = GLYPHS[skill]
	return (
		<span
			aria-hidden="true"
			className={`flex shrink-0 items-center justify-center border ${
				active ? 'border-accent text-accent-text' : 'border-border-strong text-text-muted'
			}`}
			style={{ width: size * 2, height: size * 2 }}
		>
			<Glyph size={size} />
		</span>
	)
}
