import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { createElement as h, type ComponentProps, type ReactElement, type ReactNode } from 'react'
import {
	Circle,
	Document,
	Font,
	Page,
	StyleSheet,
	Svg,
	Text,
	View,
	type DocumentProps
} from '@react-pdf/renderer'
import { DOTS, DOT_RADIUS, DOT_VIEWBOX } from '@/components/brand/dot-grid'
import type {
	EvidenceItem,
	Fact,
	PatternItem,
	Quote,
	RecommendationItem,
	ReportModel,
	ReportSuggestion,
	SkillSection
} from './report-model'

// The PDF layout of a ReportModel. Written with createElement rather than JSX
// so the unit tests (node --test, which strips types but not JSX) can render
// real PDFs from it. Light content pages for reading and printing, a dark
// Dojo band on the cover, one accent colour.

const INK = '#0a0e12'
const BONE = '#dfe7e0'
const BONE_DIM = '#aab4ad'
const ACCENT = '#e0231c'
const TEXT = '#14181c'
const MUTED = '#5b6560'
const LINE = '#d9ddd9'
const QUOTE_FILL = '#f3f4f2'
const TRACK = '#e6e8e6'

const PAGE_X = 48
// A4 in points. The footer is placed from the top: react-pdf drops fixed
// elements positioned with `bottom` on this layout.
const A4_HEIGHT = 841.89
const FOOTER_RULE_TOP = A4_HEIGHT - 38
const FOOTER_TEXT_TOP = A4_HEIGHT - 32
const PAGE_TOP = 64
const PAGE_BOTTOM = 60
const HEADING_KEEP_WITH = 90
// Longer than any line can hold at the body size, so only these ever break.
const LONG_WORD = 60
const WORD_CHUNK = 40

// Geist ships with Next (next/og uses it). Its coverage beats the PDF
// standard fonts, which only encode Western European text, so users' own
// words are set in it whenever it is there; Dojo's own headings stay in
// Helvetica Bold, since Geist ships here in one weight only.
const GEIST = join(
	process.cwd(),
	'node_modules',
	'next',
	'dist',
	'compiled',
	'@vercel',
	'og',
	'Geist-Regular.ttf'
)
let bodyFont = 'Helvetica'
let isFontSetUp = false

function setUpFonts() {
	if (isFontSetUp) return
	isFontSetUp = true
	if (existsSync(GEIST)) {
		Font.register({ family: 'Geist', src: GEIST })
		bodyFont = 'Geist'
	}
	// Words are never hyphenated; only an unbroken run too long for a line
	// (a path, a URL) gets break points, so it wraps instead of overflowing.
	Font.registerHyphenationCallback((word) =>
		word.length <= LONG_WORD
			? [word]
			: Array.from({ length: Math.ceil(word.length / WORD_CHUNK) }, (_, index) =>
					word.slice(index * WORD_CHUNK, (index + 1) * WORD_CHUNK)
				)
	)
}

const styles = StyleSheet.create({
	page: {
		paddingTop: PAGE_TOP,
		paddingBottom: PAGE_BOTTOM,
		paddingHorizontal: PAGE_X,
		fontSize: 9.5,
		lineHeight: 1.45,
		color: TEXT,
		backgroundColor: '#ffffff'
	},
	header: {
		position: 'absolute',
		top: 26,
		left: PAGE_X,
		right: PAGE_X,
		flexDirection: 'row',
		justifyContent: 'space-between',
		fontSize: 7,
		color: MUTED,
		letterSpacing: 1.2
	},
	footerRule: {
		position: 'absolute',
		top: FOOTER_RULE_TOP,
		left: PAGE_X,
		right: PAGE_X,
		height: 0.6,
		backgroundColor: LINE
	},
	footerLeft: {
		position: 'absolute',
		top: FOOTER_TEXT_TOP,
		left: PAGE_X,
		fontSize: 7,
		color: MUTED
	},
	footerRight: {
		position: 'absolute',
		top: FOOTER_TEXT_TOP,
		right: PAGE_X,
		fontSize: 7,
		color: MUTED
	},
	cover: {
		backgroundColor: INK,
		marginTop: -PAGE_TOP,
		marginHorizontal: -PAGE_X,
		paddingTop: 44,
		paddingBottom: 36,
		paddingHorizontal: PAGE_X,
		color: BONE
	},
	coverTitle: {
		fontFamily: 'Helvetica-Bold',
		fontSize: 26,
		lineHeight: 1.2,
		marginTop: 22,
		color: BONE
	},
	coverSubtitle: { fontSize: 10, color: BONE_DIM, marginTop: 6 },
	coverMeta: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 24, gap: 18 },
	coverMetaItem: { minWidth: 120 },
	coverLabel: { fontSize: 6.5, letterSpacing: 1.3, color: BONE_DIM, textTransform: 'uppercase' },
	coverValue: { fontSize: 9.5, color: BONE, marginTop: 3 },
	scoreRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 28, gap: 10 },
	score: { fontFamily: 'Helvetica-Bold', fontSize: 54, color: BONE, lineHeight: 1 },
	scoreOutOf: { fontSize: 8, letterSpacing: 1.3, color: BONE_DIM, marginBottom: 8 },
	scoreBand: {
		fontSize: 8,
		letterSpacing: 1.3,
		color: ACCENT,
		marginTop: 6,
		textTransform: 'uppercase'
	},
	eyebrow: {
		fontFamily: 'Helvetica-Bold',
		fontSize: 7,
		letterSpacing: 1.3,
		color: MUTED,
		textTransform: 'uppercase'
	},
	sectionNumber: { fontFamily: 'Helvetica-Bold', fontSize: 7.5, color: ACCENT, letterSpacing: 1.3 },
	h2: {
		fontFamily: 'Helvetica-Bold',
		fontSize: 15,
		marginTop: 4,
		marginBottom: 10,
		textTransform: 'uppercase'
	},
	h3: { fontFamily: 'Helvetica-Bold', fontSize: 11 },
	section: { marginTop: 26 },
	paragraph: { marginBottom: 6 },
	muted: { color: MUTED },
	small: { fontSize: 8 },
	factGrid: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		borderTopWidth: 0.6,
		borderLeftWidth: 0.6,
		borderColor: LINE
	},
	factCell: {
		width: '50%',
		padding: 8,
		borderRightWidth: 0.6,
		borderBottomWidth: 0.6,
		borderColor: LINE
	},
	factValue: { fontSize: 12, marginTop: 3 },
	block: { borderTopWidth: 0.6, borderTopColor: LINE, paddingVertical: 10 },
	rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
	skillScore: { fontFamily: 'Helvetica-Bold', fontSize: 16 },
	track: { height: 3, backgroundColor: TRACK, marginTop: 6, marginBottom: 6 },
	fill: { height: 3, backgroundColor: ACCENT },
	twoColumns: { flexDirection: 'row', gap: 16, marginTop: 4 },
	column: { flex: 1 },
	listItem: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		borderBottomWidth: 0.4,
		borderBottomColor: LINE,
		paddingVertical: 2
	},
	quote: {
		borderLeftWidth: 2,
		borderLeftColor: ACCENT,
		backgroundColor: QUOTE_FILL,
		paddingVertical: 6,
		paddingHorizontal: 9,
		marginTop: 3,
		marginBottom: 6
	},
	suggestion: { borderWidth: 0.6, borderColor: LINE, padding: 8, marginTop: 4 },
	chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 },
	chip: {
		borderWidth: 0.6,
		borderColor: LINE,
		borderRadius: 8,
		paddingVertical: 2,
		paddingHorizontal: 7,
		fontSize: 7.5
	}
})

/** The labels the layout needs that are not part of the model's content. */
export interface ReportLabels {
	readonly title: string
	readonly subtitle: string
	readonly headerTitle: string
	readonly preparedFor: string
	readonly assessedOn: string
	readonly reference: string
	readonly outOf: string
	readonly summary: string
	readonly habits: string
	readonly sections: {
		readonly overview: string
		readonly skills: string
		readonly evidence: string
		readonly profile: string
		readonly recommendations: string
		readonly metrics: string
		readonly about: string
	}
	readonly lookFor: string
	readonly seen: string
	readonly missing: string
	readonly yourPrompt: string
	readonly dojoReads: string
	readonly shows: string
	readonly why: string
	readonly better: string
	readonly suggestion: string
	readonly suggestionNote: string
	readonly noEvidence: string
	readonly strengths: string
	readonly risks: string
	readonly none: string
	readonly noRecommendations: string
	readonly problem: string
	readonly matters: string
	readonly practice: string
	readonly fromSession: string
	readonly metricsNote: string
	readonly noMetrics: string
	readonly rubricVersion: string
	readonly methodology: string
	readonly methodologyBody: string
	readonly disclaimer: string
	readonly footer: string
	readonly page: (page: number, total: number) => string
}

// Text accepts plain text props or SVG text props; these helpers only make the plain kind.
type TextStyle = Extract<ComponentProps<typeof Text>, { wrap?: boolean }>['style']

const text = (style: TextStyle, children: ReactNode) => h(Text, { style }, children)

function DotMark(): ReactElement {
	const scale = 0.9
	return h(
		Svg,
		{
			width: DOT_VIEWBOX.width * scale,
			height: DOT_VIEWBOX.height * scale,
			viewBox: `0 0 ${DOT_VIEWBOX.width} ${DOT_VIEWBOX.height}`
		},
		...DOTS.map((dot) =>
			h(Circle, { key: `${dot.x}:${dot.y}`, cx: dot.x, cy: dot.y, r: DOT_RADIUS, fill: BONE })
		)
	)
}

function SectionHeading({ number, title }: { number: string; title: string }): ReactElement {
	// Kept with what follows: a heading never ends a page.
	return h(
		View,
		{ minPresenceAhead: HEADING_KEEP_WITH },
		text(styles.sectionNumber, number),
		text(styles.h2, title)
	)
}

function QuoteBlock({ quote, labels }: { quote: Quote; labels: ReportLabels }): ReactElement {
	return h(
		View,
		null,
		text(styles.eyebrow, `${labels.yourPrompt} · ${quote.location}`),
		h(
			View,
			{ style: styles.quote },
			h(
				Text,
				{ style: { fontFamily: bodyFont } },
				`${quote.clippedBefore ? '… ' : ''}${quote.text}${quote.clippedAfter ? ' …' : ''}`
			)
		)
	)
}

function SuggestionBlock({
	suggestion,
	labels
}: {
	suggestion: ReportSuggestion
	labels: ReportLabels
}): ReactElement {
	return h(
		View,
		{ style: styles.suggestion },
		text(styles.eyebrow, labels.suggestion),
		h(Text, { style: { fontFamily: bodyFont, marginTop: 4 } }, suggestion.base),
		...suggestion.lines.map((line) => h(Text, { key: line, style: styles.muted }, line)),
		text([styles.small, styles.muted, { marginTop: 4 }], labels.suggestionNote)
	)
}

function FactList({
	label,
	facts
}: {
	label: string
	facts: readonly Fact[]
}): ReactElement | null {
	if (facts.length === 0) return null
	return h(
		View,
		{ style: styles.column },
		text(styles.eyebrow, label),
		...facts.map((fact) =>
			h(
				View,
				{ key: fact.label, style: styles.listItem },
				h(Text, null, fact.label),
				text(styles.muted, fact.value)
			)
		)
	)
}

function SkillBlock({
	skill,
	labels
}: {
	skill: SkillSection
	labels: ReportLabels
}): ReactElement {
	return h(
		View,
		{ style: styles.block, wrap: false },
		h(
			View,
			{ style: styles.rowBetween },
			text(styles.h3, skill.name),
			skill.score == null
				? text([styles.eyebrow, { color: ACCENT }], skill.confidenceLabel)
				: text(styles.skillScore, `${skill.score}/100`)
		),
		skill.score == null
			? null
			: h(
					View,
					{ style: styles.track },
					h(View, { style: [styles.fill, { width: `${skill.score}%` }] })
				),
		text(
			[styles.eyebrow, { marginTop: skill.score == null ? 6 : 0 }],
			[skill.proficiency, skill.confidenceLabel].filter(Boolean).join(' · ')
		),
		text([styles.small, styles.muted, { marginTop: 2 }], skill.confidenceDetail),
		text({ marginTop: 5 }, skill.summary),
		text([styles.small, styles.muted, { marginTop: 3 }], `${labels.lookFor}: ${skill.lookFor}`),
		h(
			View,
			{ style: styles.twoColumns },
			h(FactList, { label: labels.seen, facts: skill.seen }),
			h(FactList, { label: labels.missing, facts: skill.missing })
		)
	)
}

function EvidenceBlock({
	item,
	labels
}: {
	item: EvidenceItem
	labels: ReportLabels
}): ReactElement {
	return h(
		View,
		{ style: styles.block, wrap: false },
		h(QuoteBlock, { quote: item.quote, labels }),
		text(styles.eyebrow, labels.dojoReads),
		text({ marginTop: 3 }, `${labels.shows}: ${item.shows}`),
		text(styles.muted, `${labels.why}: ${item.why}`),
		item.better == null ? null : text(undefined, `${labels.better}: ${item.better}`),
		item.suggestion == null ? null : h(SuggestionBlock, { suggestion: item.suggestion, labels })
	)
}

function PatternList({
	title,
	patterns,
	labels
}: {
	title: string
	patterns: readonly PatternItem[]
	labels: ReportLabels
}): ReactElement {
	return h(
		View,
		{ style: styles.column },
		text(styles.eyebrow, title),
		patterns.length === 0
			? text([styles.muted, { marginTop: 4 }], labels.none)
			: patterns.map((pattern) =>
					h(
						View,
						{ key: pattern.name, style: styles.block, wrap: false },
						text(styles.h3, pattern.name),
						text(styles.muted, pattern.detail),
						pattern.quote == null ? null : h(QuoteBlock, { quote: pattern.quote, labels })
					)
				)
	)
}

function RecommendationBlock({
	item,
	labels
}: {
	item: RecommendationItem
	labels: ReportLabels
}): ReactElement {
	return h(
		View,
		{ style: styles.block, wrap: false },
		text(styles.eyebrow, item.skillName),
		text([styles.h3, { marginTop: 2 }], item.title),
		text([styles.small, styles.muted], item.observed),
		text({ marginTop: 5 }, `${labels.problem}: ${item.problem}`),
		text(styles.muted, `${labels.matters}: ${item.matters}`),
		text(undefined, `${labels.practice}: ${item.practice}`),
		item.quote == null
			? null
			: h(View, { style: { marginTop: 6 } }, h(QuoteBlock, { quote: item.quote, labels })),
		item.suggestion == null ? null : h(SuggestionBlock, { suggestion: item.suggestion, labels })
	)
}

export function ReportDocument({
	model,
	labels
}: {
	model: ReportModel
	labels: ReportLabels
}): ReactElement<DocumentProps> {
	setUpFonts()
	const { overview } = model
	return h(
		Document,
		{
			title: `${labels.title} · ${model.assessedOn}`,
			author: 'Dojo',
			subject: labels.subtitle,
			creator: 'Dojo'
		},
		h(
			Page,
			{ size: 'A4', style: styles.page },
			h(
				View,
				{ fixed: true, style: styles.header },
				// Blank on the cover, where the dark band is the header.
				h(Text, {
					fixed: true,
					render: ({ pageNumber }: { pageNumber: number }) =>
						pageNumber === 1 ? '' : labels.headerTitle
				}),
				h(Text, {
					fixed: true,
					render: ({ pageNumber }: { pageNumber: number }) =>
						pageNumber === 1 ? '' : `${labels.reference} ${model.reference}`
				})
			),
			// Absolutely placed fixed texts, as react-pdf's page-number example does.
			h(Text, { fixed: true, style: styles.footerRule }),
			h(Text, { fixed: true, style: styles.footerLeft }, labels.footer),
			h(Text, {
				fixed: true,
				style: styles.footerRight,
				render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
					labels.page(pageNumber, totalPages)
			}),

			// Cover: the dark band.
			h(
				View,
				{ style: styles.cover },
				h(DotMark, null),
				text(styles.coverTitle, labels.title),
				text(styles.coverSubtitle, labels.subtitle),
				h(
					View,
					{ style: styles.coverMeta },
					model.preparedFor == null
						? null
						: h(
								View,
								{ style: styles.coverMetaItem },
								text(styles.coverLabel, labels.preparedFor),
								h(Text, { style: [styles.coverValue, { fontFamily: bodyFont }] }, model.preparedFor)
							),
					h(
						View,
						{ style: styles.coverMetaItem },
						text(styles.coverLabel, labels.assessedOn),
						text(styles.coverValue, model.assessedOn)
					),
					h(
						View,
						{ style: styles.coverMetaItem },
						text(styles.coverLabel, labels.reference),
						text(styles.coverValue, model.reference)
					)
				),
				overview.score == null
					? text([styles.coverValue, { marginTop: 24 }], overview.noScore)
					: h(
							View,
							null,
							h(
								View,
								{ style: styles.scoreRow },
								text(styles.score, String(overview.score)),
								text(styles.scoreOutOf, labels.outOf)
							),
							text(styles.scoreBand, overview.proficiency)
						)
			),

			// 01 Overview
			h(
				View,
				{ style: styles.section },
				h(SectionHeading, { number: '01', title: labels.sections.overview }),
				text(styles.paragraph, overview.summary),
				h(
					View,
					{ style: styles.factGrid },
					...overview.facts.map((fact) =>
						h(
							View,
							{ key: fact.label, style: styles.factCell },
							text(styles.eyebrow, fact.label),
							text(styles.factValue, fact.value)
						)
					)
				),
				overview.habits.length === 0
					? null
					: h(
							View,
							{ style: { marginTop: 10 } },
							text(styles.eyebrow, labels.habits),
							h(
								View,
								{ style: styles.chipRow },
								...overview.habits.map((habit) => text(styles.chip, habit))
							)
						)
			),

			// 02 Skills
			h(
				View,
				{ style: styles.section, break: true },
				h(SectionHeading, { number: '02', title: labels.sections.skills }),
				...model.skills.map((skill) => h(SkillBlock, { key: skill.name, skill, labels }))
			),

			// 03 Evidence
			h(
				View,
				{ style: styles.section },
				h(SectionHeading, { number: '03', title: labels.sections.evidence }),
				...model.skills.map((skill) =>
					h(
						View,
						{ key: skill.name, style: { marginTop: 8 } },
						h(View, { minPresenceAhead: HEADING_KEEP_WITH }, text(styles.h3, skill.name)),
						skill.evidence.length === 0
							? text([styles.muted, { marginTop: 4 }], labels.noEvidence)
							: skill.evidence.map((item, index) => h(EvidenceBlock, { key: index, item, labels }))
					)
				)
			),

			// 04 Profile
			h(
				View,
				{ style: styles.section },
				h(SectionHeading, { number: '04', title: labels.sections.profile }),
				h(
					View,
					{ style: styles.twoColumns },
					h(PatternList, { title: labels.strengths, patterns: model.profile.strengths, labels }),
					h(PatternList, { title: labels.risks, patterns: model.profile.risks, labels })
				)
			),

			// 05 Recommendations
			h(
				View,
				{ style: styles.section },
				h(SectionHeading, { number: '05', title: labels.sections.recommendations }),
				model.recommendations.length === 0
					? text(styles.muted, labels.noRecommendations)
					: model.recommendations.map((item) =>
							h(RecommendationBlock, { key: `${item.skillName}:${item.title}`, item, labels })
						)
			),

			// 06 Free metrics
			h(
				View,
				{ style: styles.section, wrap: false },
				h(SectionHeading, { number: '06', title: labels.sections.metrics }),
				text([styles.paragraph, styles.muted], labels.metricsNote),
				model.metrics == null
					? text(styles.muted, labels.noMetrics)
					: h(
							View,
							{ style: styles.factGrid },
							...model.metrics.map((fact) =>
								h(
									View,
									{ key: fact.label, style: styles.factCell },
									text(styles.eyebrow, fact.label),
									text(styles.factValue, fact.value)
								)
							)
						)
			),

			// 07 About
			h(
				View,
				{ style: styles.section, wrap: false },
				h(SectionHeading, { number: '07', title: labels.sections.about }),
				h(
					View,
					{ style: styles.factGrid },
					...[
						{ label: labels.rubricVersion, value: model.about.rubricVersion },
						{ label: labels.assessedOn, value: model.assessedOn },
						{ label: labels.methodology, value: labels.methodologyBody },
						{ label: labels.reference, value: model.reference }
					].map((fact) =>
						h(
							View,
							{ key: fact.label, style: styles.factCell },
							text(styles.eyebrow, fact.label),
							text({ marginTop: 3 }, fact.value)
						)
					)
				),
				text([styles.muted, { marginTop: 8 }], model.about.redactions),
				text([styles.muted, { marginTop: 4 }], labels.disclaimer)
			)
		)
	)
}
