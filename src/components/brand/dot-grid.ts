// The geometry of Dojo's dot-matrix wordmark, on the same 5x7 grid as the landing page's mark
// (dotMark in scripts/adapt-kage-landing.mjs). Each row is a five-bit pattern.
const GLYPHS = {
	D: [30, 17, 17, 17, 17, 17, 30],
	O: [14, 17, 17, 17, 17, 17, 14],
	J: [7, 2, 2, 2, 2, 18, 12]
} as const
const WORD = ['D', 'O', 'J', 'O'] as const
const PITCH = 4
export const DOT_RADIUS = 1.45
const GLYPH_COLUMNS = 5
const ADVANCE_COLUMNS = 6
const WIDTH_COLUMNS = 23
const ROWS = 7

/** The mark's coordinate space; DOTS are placed in it. */
export const DOT_VIEWBOX = { width: WIDTH_COLUMNS * PITCH, height: ROWS * PITCH }

/** Each dot's centre, in the DOT_VIEWBOX coordinate space. */
export const DOTS: readonly { readonly x: number; readonly y: number }[] = WORD.flatMap(
	(letter, index) =>
		GLYPHS[letter].flatMap((bits, row) =>
			Array.from({ length: GLYPH_COLUMNS }, (_, column) => column)
				.filter((column) => bits & (1 << (GLYPH_COLUMNS - 1 - column)))
				.map((column) => ({
					x: (index * ADVANCE_COLUMNS + column) * PITCH + PITCH / 2,
					y: row * PITCH + PITCH / 2
				}))
		)
)
