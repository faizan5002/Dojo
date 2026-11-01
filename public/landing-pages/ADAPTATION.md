# Kage landing page: Dojo adaptation

`kage.html` here is **not** the package file. It is generated from the document
shipped in `@designcodeio/threeui` 1.2.0 by `scripts/adapt-kage-landing.mjs`
(`node scripts/adapt-kage-landing.mjs`), which refuses to run unless the source
hash matches and every edit matches exactly once.

| File | SHA-256 |
| --- | --- |
| Package `kage.html` (source, revision c8e06b90397a) | `c8e06b90397ac246baf0ab6f32f5f6b570acc6fe03c7009f711b579fb72d9f49` |
| Adapted `kage.html` (this directory) | `bbb9b07ad266e72746b9fa27e535b0cf405241e01a38b237d12b50f4dbfe5618` |
| `secret-pathways-assets/fonts.css` (unmodified) | `985f85a904a4096f92c06552b06f42a45973ac004af4780d68f18af65ddcc1b0` |
| `secret-pathways-assets/three.min.js` (unmodified) | `8a5f7249903b54d30f79f708699d2fed2d6a1d0741a4cd41377d1f01bb5a2271` |

Everything under `secret-pathways-assets/` is copied unmodified from the package.

What the adaptation changes, and nothing else:

- All visible copy, navigation labels, the preloader text and the rail tooltips.
- The "Why evidence matters" link opens `/sessions` (with `target="_top"`, so it leaves the iframe).
- Brand marks: the torii mark is replaced by Dojo's dot mark (a 5x7 dot grid,
  drawn inline in `scripts/adapt-kage-landing.mjs`).
- Japanese labels, the stats block and the footer's "Elsewhere" column are removed.
- The 3-D wordmark reads DOJO. The embedded `Wordmark` font is a subset with no
  D, O or J, so the word is set in Onest 700 (embedded in full Latin by the same
  `fonts.css`). This is the one visual change to the scene.
- A small CSS block for the changed content: six skill plates (3+3), a horizontal
  closing title, a two-column footer.
- An added Evidence heading and paragraph (that section had no text), with a dark scrim behind the intro paragraphs of the Evidence and Skills sections so they stay readable over the scene.

The scenes, Three.js runtime, shaders, animation and scroll logic are untouched.
The iframe's accessible title is set from `src/features/landing/kage-landing.tsx`
because the package hardcodes it.
