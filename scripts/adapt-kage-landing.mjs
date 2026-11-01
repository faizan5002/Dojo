// Builds public/landing-pages/kage.html, Dojo's adaptation of the Kage landing
// page, from the unmodified document shipped in @designcodeio/threeui.
//
//   node scripts/adapt-kage-landing.mjs
//
// The source is verified against its known SHA-256 first, and every edit must
// match exactly once, so a package upgrade fails loudly instead of producing a
// half-adapted page. See public/landing-pages/ADAPTATION.md.
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

const SOURCE = 'node_modules/@designcodeio/threeui/lib-dist/assets/landing-pages/kage.html'
const TARGET = 'public/landing-pages/kage.html'
const SOURCE_SHA256 = 'c8e06b90397ac246baf0ab6f32f5f6b570acc6fe03c7009f711b579fb72d9f49'

const original = readFileSync(SOURCE, 'utf8')
const hash = createHash('sha256').update(readFileSync(SOURCE)).digest('hex')
if (hash !== SOURCE_SHA256)
	throw new Error(`Package kage.html changed (${hash}); review the adaptation first.`)

let html = original

// A replacement that does not match exactly once is a bug in this script or a
// changed source, never something to skip.
function replace(find, to) {
	const pattern =
		find instanceof RegExp ? find : new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
	const matches = html.match(
		new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g')
	)
	if (!matches || matches.length !== 1)
		throw new Error(`Expected exactly one match for ${pattern} (got ${matches?.length ?? 0})`)
	html = html.replace(pattern, () => to)
}

// The dot-matrix wordmark, drawn from the same 5x7 grid as
// src/components/brand/dot-mark.tsx so the page uses Dojo's existing mark.
function dotMark(attrs) {
	const glyphs = {
		D: [30, 17, 17, 17, 17, 17, 30],
		O: [14, 17, 17, 17, 17, 17, 14],
		J: [7, 2, 2, 2, 2, 18, 12]
	}
	const pitch = 4
	const circles = []
	;[...'DOJO'].forEach((letter, index) => {
		glyphs[letter].forEach((bits, row) => {
			for (let col = 0; col < 5; col++) {
				if (bits & (1 << (4 - col))) {
					circles.push(
						`<circle cx="${(index * 6 + col) * pitch + pitch / 2}" cy="${row * pitch + pitch / 2}" r="1.45"/>`
					)
				}
			}
		})
	})
	return `<svg viewBox="0 0 ${23 * pitch} ${7 * pitch}" fill="currentColor" ${attrs}>${circles.join('')}</svg>`
}

// ── head ────────────────────────────────────────────────────────────────
replace(
	'<title>Kage — Where stillness reveals the unseen</title>',
	'<title>Dojo | Train how you work with AI agents</title>'
)
replace(
	/<meta name="description" content="[^"]*">/,
	'<meta name="description" content="Build better habits with AI coding agents through real work, reflection and practice.">'
)
replace(/<link rel="icon" href="data:image\/svg\+xml[^"]*">/, '<link rel="icon" href="data:,">')

// ── preloader ───────────────────────────────────────────────────────────
replace(
	/<div class="pre-mark">\s*<svg[\s\S]*?<\/svg>\s*<\/div>/,
	`<div class="pre-mark" style="width:92px;height:28px">${dotMark('aria-hidden="true"')}</div>`
)
replace('<div class="pre-jp jp">影の道</div>\n', '')
replace('Raising the mountain temple', 'Opening the dojo')

// ── navigation ──────────────────────────────────────────────────────────
replace(
	/<a class="brand" href="#top" data-cursor>\s*<svg[\s\S]*?<\/svg>\s*<span class="brand-tx"><b>KAGE<\/b><i>HIDDEN REALMS OF KYOTO<\/i><\/span>/,
	`<a class="brand" href="#top" data-cursor aria-label="Dojo, back to top">${dotMark('aria-hidden="true" style="width:62px;height:19px"')}<span class="brand-tx"><i>TRAIN WITH AI AGENTS</i></span>`
)
for (const [href, from, jp, to, alt] of [
	['#gate', 'Temples', '伽藍', 'Sessions', 'Real work'],
	['#pathways', 'Gardens', '庭園', 'Evidence', 'Grounded feedback'],
	['#lessons', 'Rituals', '神事', 'Skills', 'Six skills'],
	['#eternity', 'Afterlight', '残光', 'Practice', 'Better habits']
]) {
	replace(
		`<a class="nav-link" href="${href}" data-cursor><span>${from}</span><span class="alt">${jp}</span></a>`,
		`<a class="nav-link" href="${href}" data-cursor><span>${to}</span><span class="alt">${alt}</span></a>`
	)
}

// ── hero ────────────────────────────────────────────────────────────────
replace(
	'<span class="dot"></span> Chapter 00 — The Hidden Gate',
	'<span class="dot"></span> Dojo — AI coding practice'
)
replace(
	'<span class="mask-line"><span>Where stillness</span></span>',
	'<span class="mask-line"><span>Train how you</span></span>'
)
replace(
	'<span class="mask-line"><span>reveals the</span></span>',
	'<span class="mask-line"><span>work with</span></span>'
)
replace(
	'<span class="mask-line"><span>unseen.</span></span>',
	'<span class="mask-line"><span>AI agents.</span></span>'
)
replace(
	/<p class="hero-sub body" data-rv="up">[\s\S]*?<\/p>/,
	'<p class="hero-sub body" data-rv="up">Build better habits with AI coding agents through real work, reflection and practice.</p>'
)
for (const [from, fromText, to, toText] of [
	[
		'Thresholds',
		'Discover the hidden gates that open on to deeper paths.',
		'Sessions',
		'Start from the real work you already do.'
	],
	[
		'Still Gardens',
		'Witness the courts where silence gently unfolds.',
		'Evidence',
		'Ground feedback in what actually happened.'
	],
	[
		'Sacred Craft',
		'Embrace the hands and heritage that shape devotion.',
		'Skills',
		'Six skills that shape how you work.'
	],
	[
		'Night Rituals',
		'Explore the rites that awaken when the day is done.',
		'Practice',
		'Turn lessons into habits over time.'
	]
]) {
	replace(`<b>${from}</b><p>${fromText}</p>`, `<b>${to}</b><p>${toText}</p>`)
}
replace(
	'aria-label="Preview: Sanmon, before the bell"',
	'aria-label="Preview: the Evidence section"'
)
replace('<b class="jp">山門</b><i>Sanmon — before the bell</i>', '<i>Next — Evidence</i>')
replace(/\s*<div class="hero-side" data-rv="up">\s*<span class="v jp">影の道<\/span>\s*<\/div>/, '')
replace(
	'<div class="word-fb" aria-hidden="true">KAGE</div>',
	'<div class="word-fb" aria-hidden="true">DOJO</div>'
)

// ── sessions (#gate) ────────────────────────────────────────────────────
replace(
	'<span class="k"><b>01</b> — The Sanmon</span><span class="rule"></span><span class="k jp">山門</span>',
	'<span class="k"><b>01</b> — Sessions</span><span class="rule"></span>'
)
replace('Charred cypress, worn stone, one gate left open.', 'Start with the work you already do.')
replace(
	/<p class="lead" data-rv="up">[\s\S]*?<\/p>/,
	'<p class="lead" data-rv="up">Dojo is designed around real coding-agent work: the tasks you give Claude Code, Codex and other agents, and how you scope, steer and check them. Practice should start from what you actually do, not from a toy example.</p>'
)
replace(
	/<p class="body" data-rv="up">Climb the worn steps[\s\S]*?<\/p>/,
	'<p class="body" data-rv="up">The full coaching loop is still being built. This page describes where Dojo is headed: learning from your own sessions, one skill at a time.</p>'
)
replace('<span>Cross the threshold</span>', '<span>Why evidence matters</span>')
// The page lives in an iframe, so the link has to leave the frame to open the app.
replace(
	/<a class="arrowlink" href="#[a-z]+"( data-rv="fade" data-cursor>\s*<span>Why evidence matters)/,
	'<a class="arrowlink" href="/sessions" target="_top" data-rv="fade" data-cursor>\n        <span>Why evidence matters'
)
replace(
	/\s*<div class="gate-stats" data-rv="up">[\s\S]*?<\/div>\s*<\/div>\s*<\/section>/,
	'\n  </div>\n</section>'
)

// ── evidence (#pathways) ────────────────────────────────────────────────
replace(
	'<span class="k"><b>02</b> — Still Gardens</span><span class="rule"></span><span class="k jp">庭園</span>\n  </div>',
	`<span class="k"><b>02</b> — Evidence</span><span class="rule"></span>
  </div>
  <div class="cur-head">
    <h2 class="display h-sec" data-rv="up">Feedback should point at real work.</h2>
    <p class="body-lg" data-rv="up">Advice is only useful when it is grounded in what actually happened. Dojo is being designed so feedback can point back to the moment in your work that caused it. That linking is part of the plan, not something that is built yet.</p>
  </div>`
)
replace('<b>Approach</b><span class="jp">参道</span>', '<b>Real work</b>')
replace('<span>The long climb</span>', '<span>Start from your sessions</span>')
replace('<b>Lanterns</b><span class="jp">灯籠</span>', '<b>Evidence</b>')
replace('<span>Lantern court</span>', '<span>Ground feedback in the work</span>')
replace('<b>Moonwater</b><span class="jp">月影</span>', '<b>Reflection</b>')
replace('<span>The wet court</span>', '<span>Learn from what happened</span>')

// ── skills (#lessons) ───────────────────────────────────────────────────
replace(
	'<span class="k"><b>03</b> — Sacred Craft</span><span class="rule"></span><span class="k jp">手業</span>',
	'<span class="k"><b>03</b> — Skills</span><span class="rule"></span>'
)
replace('Five chapters. Ninety minutes. One quiet mind.', 'Six skills. One better workflow.')
replace(
	/<p class="body-lg" data-rv="up">Each chapter is a walk[\s\S]*?<\/p>/,
	'<p class="body-lg" data-rv="up">Dojo is organised around six skills of working with AI coding agents. Each one is a habit you can notice, name and practice.</p>'
)
const skills = [
	['Scoping', 'Defining the task clearly before the agent starts: what to do, and what not to.'],
	['Context', 'Giving the agent the right information, files and constraints to work with.'],
	['Steering', 'Guiding the agent mid-task and correcting course when it drifts.'],
	['Review', 'Reading what the agent produced with a critical eye before accepting it.'],
	['Recovery', 'Getting back on track when a session goes wrong, instead of starting over.'],
	['Verification', 'Checking that the result actually works, rather than trusting that it does.']
]
replace(
	/<div class="cur" id="cur">[\s\S]*?<\/div>\s*<\/section>\s*<!-- =+ chapter IV/,
	`<div class="cur" id="cur">
${skills
	.map(
		([name, text], index) => `    <div class="les" data-les="${index}" data-cursor>
      <span class="k">0${index + 1}</span>
      <h3>${name}</h3>
      <p>${text}</p>
      <i class="bar"></i>
    </div>`
	)
	.join('\n')}
  </div>
</section>

<!-- ============================================================ chapter IV`
)

// ── practice (#eternity) ────────────────────────────────────────────────
replace(
	'<div class="eyebrow" data-rv="fade">Chapter 04 — Afterlight</div>',
	'<div class="eyebrow" data-rv="fade">Practice</div>'
)
replace(
	'<h2 class="display" data-rv="up">Afterlight</h2>',
	'<h2 class="display" data-rv="up">Practice makes better workflows.</h2>'
)
replace(
	/<p class="body-lg" data-rv="up">The gate does not close[\s\S]*?<\/p>/,
	'<p class="body-lg" data-rv="up">Dojo is being built so every task with an AI agent can become a chance to improve. That is the vision; the coaching loop itself is still in development.</p>'
)
replace(
	'<a class="cta" href="#top" data-rv="fade" data-cursor>\n    <i></i><span>Begin the walk</span>',
	'<a class="cta" href="#gate" data-rv="fade" data-cursor>\n    <i></i><span>Explore how Dojo works</span>'
)

// ── footer ──────────────────────────────────────────────────────────────
replace(
	/<div class="foot-brand">\s*<svg[\s\S]*?<\/svg>\s*<p>[\s\S]*?<\/p>\s*<\/div>/,
	`<div class="foot-brand">
      ${dotMark('role="img" aria-label="Dojo" style="width:96px;height:29px"')}
      <p>Dojo is being built to help developers improve how they work with AI coding agents through real work, reflection, skill development and practice.</p>
    </div>`
)
replace(
	/<div><h4>Chapters<\/h4><ul>[\s\S]*?<div><h4>Elsewhere<\/h4>[\s\S]*?<\/ul><\/div>/,
	`<div><h4>Sections</h4><ul>
      <li><a href="#gate" data-cursor>Sessions</a></li>
      <li><a href="#pathways" data-cursor>Evidence</a></li>
      <li><a href="#lessons" data-cursor>Skills</a></li>
      <li><a href="#eternity" data-cursor>Practice</a></li>
    </ul></div>
    <div><h4>Skills</h4><ul>
${skills.map(([name]) => `      <li><a href="#lessons" data-cursor>${name}</a></li>`).join('\n')}
    </ul></div>`
)
replace(
	/<span>© 2026 Kage — Kage no Michi<\/span>\s*<span class="jp">[^<]*<\/span>\s*<span>WebGL · Onest · Kyoto<\/span>/,
	'<span>© 2026 Dojo</span>\n    <span>Train with AI agents</span>\n    <span>In development</span>'
)

// ── script strings and the wordmark face ────────────────────────────────
replace(
	"['The Hidden Gate', 'The Sanmon', 'Still Gardens', 'Sacred Craft', 'Afterlight', 'Colophon']",
	"['Top', 'Sessions', 'Evidence', 'Skills', 'Practice', 'Footer']"
)
replace("const word = 'KAGE', gl = [];", "const word = 'DOJO', gl = [];")
// The embedded 'Wordmark' face is a subset with no D, O or J, so the 3-D word
// is set in Onest 700, which the same fonts.css embeds in full Latin.
replace(
	"m.font = '600 ' + SZ + 'px Wordmark, sans-serif';",
	"m.font = '700 ' + SZ + 'px Onest, sans-serif';"
)
replace(
	"x.font = '600 ' + SZ + 'px Wordmark, sans-serif';",
	"x.font = '700 ' + SZ + 'px Onest, sans-serif';"
)
replace("document.fonts.load('600 320px Wordmark')", "document.fonts.load('700 320px Onest')")
replace(
	"font-family:'Wordmark','Onest',sans-serif; font-weight:600;",
	"font-family:'Onest',sans-serif; font-weight:700;"
)

// ── layout overrides for the changed content ────────────────────────────
// Six skills instead of five plates, a horizontal closing title (the original
// one-word title was set vertically), and a two-column footer.
replace(
	'@media (prefers-reduced-motion:reduce){\n  *{ animation-duration',
	`/* Dojo adaptation */
body[data-layout-curriculum="b"] .les:nth-child(n){ grid-column:span 2; }
@media (max-width:1080px){
  body[data-layout-curriculum="b"] .les:nth-child(n){ grid-column:span 3; }
}
@media (max-width:820px){
  body[data-layout-curriculum="b"] .les:nth-child(n){ grid-column:auto; }
}
body[data-layout-closing="b"] .fin h2{
  writing-mode:horizontal-tb; font-size:clamp(34px,5.2vw,84px); line-height:1; max-width:11ch;
  justify-self:end; text-align:right;
}
@media (max-width:820px){
  body[data-layout-closing="b"] .fin h2{ font-size:clamp(34px,10vw,64px); max-width:none; text-align:center; justify-self:auto; }
}
@media (min-width:821px){
  body[data-layout-footer="b"] .foot-grid{ grid-template-columns:repeat(2,1fr); }
  body[data-layout-footer="b"] .foot-brand{ grid-template-columns:120px minmax(0,1fr); }
}
body[data-layout-hero="b"] .peek-cap i{ white-space:nowrap; }
/* Body copy that sits over the busiest parts of the scene gets its own scrim. */
.cur-head p.body-lg{ padding:14px 18px; background:rgba(4,7,10,.68); }
@media (prefers-reduced-motion:reduce){
  *{ animation-duration`
)

// Nothing from the original narrative may remain visible.
const visible = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '')
if (/[぀-ヿ一-鿿]/.test(visible)) throw new Error('Japanese text remains in the document body')
const leftover = visible
	.replace(/(data-[a-z-]+|src)="[^"]*"/g, '')
	.match(/.{30}(kage|kyoto|sanmon|temple).{30}/gi)
if (leftover) throw new Error('Kage narrative text remains: ' + leftover.join(' | '))

writeFileSync(TARGET, html)
console.log(`${TARGET}: ${createHash('sha256').update(html).digest('hex')}`)
