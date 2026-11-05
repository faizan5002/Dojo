import { useId } from 'react'

// Original illustration for the Red Moon Era story. Every scene shares one horizon, one moon
// and one set of ink ridges, so the story reads as a single place changing over time: the moon
// rises, the landscape is cut by angular new forces, a traveller hesitates at a fork, a
// samurai stands against the moon, and finally a gate opens onto the dojo.

const INK = '#15111a'
const INK_2 = '#1d1722'
const INK_3 = '#251c25'
const MOON = '#d6452b'
const GOLD = '#c9a24a'
const PAPER = '#f1e7cf'

type SceneProps = { className?: string }

function Defs({ id }: { id: string }) {
	return (
		<defs>
			<linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
				<stop offset="0" stopColor="#0c1028" />
				<stop offset="0.55" stopColor="#1f1a2e" />
				<stop offset="1" stopColor="#3a1d1e" />
			</linearGradient>
			<radialGradient id={`${id}-halo`} cx="0.5" cy="0.5" r="0.5">
				<stop offset="0" stopColor={MOON} stopOpacity="0.55" />
				<stop offset="0.45" stopColor={MOON} stopOpacity="0.16" />
				<stop offset="1" stopColor={MOON} stopOpacity="0" />
			</radialGradient>
			<linearGradient id={`${id}-mist`} x1="0" y1="0" x2="0" y2="1">
				<stop offset="0" stopColor={PAPER} stopOpacity="0" />
				<stop offset="1" stopColor={PAPER} stopOpacity="0.16" />
			</linearGradient>
			<filter id={`${id}-brush`} x="-5%" y="-5%" width="110%" height="110%">
				<feTurbulence
					type="fractalNoise"
					baseFrequency="0.02 0.05"
					numOctaves="2"
					seed="3"
					result="n"
				/>
				<feDisplacementMap in="SourceGraphic" in2="n" scale="9" />
			</filter>
		</defs>
	)
}

function Moon({
	id,
	x,
	y,
	r,
	className
}: {
	id: string
	x: number
	y: number
	r: number
	className?: string
}) {
	return (
		<g className={className}>
			<circle cx={x} cy={y} r={r * 2.6} fill={`url(#${id}-halo)`} />
			<circle cx={x} cy={y} r={r} fill={MOON} />
			<circle
				cx={x}
				cy={y}
				r={r * 0.94}
				fill="none"
				stroke="#f0a58f"
				strokeOpacity="0.28"
				strokeWidth="2"
			/>
		</g>
	)
}

function Ridges({ id, lift = 0 }: { id: string; lift?: number }) {
	return (
		<g transform={`translate(0 ${lift})`}>
			<path
				fill={INK_3}
				filter={`url(#${id}-brush)`}
				d="M0 470L90 400l80 40 110-90 100 80 90-50 130 80 120-90 110 60 110-70 110 70 140-40v250H0z"
			/>
			<path
				fill={INK_2}
				filter={`url(#${id}-brush)`}
				d="M0 540l120-60 110 40 130-70 140 70 140-50 140 70 120-60 140 50 160-50v240H0z"
			/>
			<rect x="0" y="520" width="1200" height="120" fill={`url(#${id}-mist)`} />
			<path
				fill={INK}
				filter={`url(#${id}-brush)`}
				d="M0 620l150-40 150 30 150-40 170 50 180-35 180 40 220-35v150H0z"
			/>
		</g>
	)
}

/** A three-tier pagoda in ink: the traditional skyline. */
function Pagoda({ x, y, s = 1, o = 1 }: { x: number; y: number; s?: number; o?: number }) {
	return (
		<g transform={`translate(${x} ${y}) scale(${s})`} fill={INK} opacity={o}>
			<path d="M-46 0h92l-10-16h-72z" />
			<rect x="-26" y="0" width="52" height="30" />
			<path d="M-38 -34h76l-9-14h-58z" />
			<rect x="-20" y="-34" width="40" height="20" />
			<path d="M-30 -66h60l-8-12h-44z" />
			<rect x="-14" y="-66" width="28" height="20" />
			<path d="M0 -78v-26" stroke={INK} strokeWidth="3" />
			<circle cx="0" cy="-86" r="3" />
		</g>
	)
}

function Torii({
	x,
	y,
	s = 1,
	glow = false
}: {
	x: number
	y: number
	s?: number
	glow?: boolean
}) {
	return (
		<g transform={`translate(${x} ${y}) scale(${s})`}>
			{glow ? <ellipse cx="0" cy="-60" rx="170" ry="130" fill={MOON} opacity="0.12" /> : null}
			<g fill={INK}>
				<rect x="-96" y="-190" width="20" height="200" />
				<rect x="76" y="-190" width="20" height="200" />
				<path d="M-140 -196c40 14 240 14 280 0l-8 -26c-40 12-224 12-264 0z" />
				<rect x="-110" y="-160" width="220" height="14" />
			</g>
			<g stroke={MOON} strokeWidth="3" fill="none" opacity="0.7">
				<path d="M-132 -216c40 12 224 12 264 0" />
			</g>
			<circle cx="0" cy="-104" r="15" fill="none" stroke={GOLD} strokeWidth="3" />
			<path d="M0 -118l8 14-8 14-8-14z" fill={GOLD} />
		</g>
	)
}

function Samurai({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
	return (
		<g
			transform={`translate(${x} ${y}) scale(${s})`}
			fill={INK}
			stroke="#f0a58f"
			strokeOpacity="0.4"
			strokeWidth="2"
			strokeLinejoin="round"
		>
			{/* kabuto: dome, layered neck guard, crescent horns */}
			<path d="M100 30c-20-10-12-30-2-48 3 12 9 30 2 48z" />
			<path d="M100 30c20-10 12-30 2-48-3 12-9 30-2 48z" />
			<path d="M68 70c0-34 64-34 64 0z" />
			<path d="M60 70h80l16 26H44z" />
			<path d="M50 84h100l10 14H40z" opacity="0.9" />
			<ellipse cx="100" cy="82" rx="13" ry="11" />
			{/* shoulder guards and torso */}
			<path d="M64 102c-18 2-30 10-32 30l-4 52c16 8 34 6 46-2l4-70z" />
			<path d="M136 102c18 2 30 10 32 30l4 52c-16 8-34 6-46-2l-4-70z" />
			<path d="M66 100h68l4 112H62z" />
			<path d="M62 204h76v10H62z" fill={GOLD} stroke="none" opacity="0.85" />
			{/* hakama: wide, pleated, planted */}
			<path d="M62 214h76l40 200H22z" />
			<path d="M100 220l-2 194" stroke={PAPER} strokeOpacity="0.12" strokeWidth="2" fill="none" />
			{/* katana at the hip, hand on the hilt */}
			<path
				d="M78 206L196 156"
				stroke="#d9c99f"
				strokeOpacity="0.85"
				strokeWidth="5"
				fill="none"
				strokeLinecap="round"
			/>
			<path
				d="M66 211l20-9"
				stroke={INK}
				strokeOpacity="1"
				strokeWidth="10"
				fill="none"
				strokeLinecap="round"
			/>
			<path d="M82 196l10 20" stroke={GOLD} strokeWidth="4" fill="none" strokeLinecap="round" />
		</g>
	)
}

function Traveller({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
	return (
		<g transform={`translate(${x} ${y}) scale(${s})`} fill={INK}>
			<path d="M-40 0l40-28 40 28z" />
			<circle cx="0" cy="12" r="9" />
			<path d="M-18 22h36l8 70h-52z" />
			<path d="M-14 92l-6 38h12l6-38zM8 92l6 38h12l-6-38z" />
			<path d="M24 36v90" stroke={INK} strokeWidth="4" />
		</g>
	)
}

/** Angular shards and a faint lattice: the new force cutting across an old landscape. */
function Disruption() {
	return (
		<g>
			<g stroke={GOLD} strokeOpacity="0.26" strokeWidth="1">
				{Array.from({ length: 14 }, (_, i) => (
					<path key={`v${i}`} d={`M${620 + i * 44} 60V520`} />
				))}
				{Array.from({ length: 11 }, (_, i) => (
					<path key={`h${i}`} d={`M600 ${70 + i * 42}H1200`} />
				))}
			</g>
			<g className="rm-shards">
				<path d="M560 40L760 150 640 210z" fill={MOON} opacity="0.85" />
				<path d="M780 90L980 40 940 190z" fill={GOLD} opacity="0.55" />
				<path d="M900 230L1120 170 1040 330z" fill={MOON} opacity="0.6" />
				<path d="M700 300L840 260 800 400z" fill={PAPER} opacity="0.22" />
				<path d="M1020 380L1160 340 1120 470z" fill={GOLD} opacity="0.4" />
			</g>
		</g>
	)
}

export function SceneRise({ className }: SceneProps) {
	const id = useId().replace(/:/g, '')
	return (
		<svg
			viewBox="0 0 1200 700"
			preserveAspectRatio="xMidYMid slice"
			className={className}
			aria-hidden="true"
		>
			<Defs id={id} />
			<rect width="1200" height="700" fill={`url(#${id}-sky)`} />
			<g fill="#f1e7cf" opacity="0.5">
				{[
					[140, 90],
					[320, 150],
					[470, 60],
					[880, 100],
					[1040, 170],
					[1120, 70]
				].map(([cx, cy]) => (
					<circle key={`${cx}${cy}`} cx={cx} cy={cy} r="1.6" />
				))}
			</g>
			<g className="rm-moon">
				<Moon id={id} x={600} y={360} r={118} />
			</g>
			<Ridges id={id} />
			<Pagoda x={300} y={500} s={1.1} o={0.95} />
			<Pagoda x={880} y={540} s={0.8} o={0.9} />
		</svg>
	)
}

export function SceneDisrupt({ className }: SceneProps) {
	const id = useId().replace(/:/g, '')
	return (
		<svg
			viewBox="0 0 1200 700"
			preserveAspectRatio="xMidYMid slice"
			className={className}
			aria-hidden="true"
		>
			<Defs id={id} />
			<rect width="1200" height="700" fill={`url(#${id}-sky)`} />
			<Moon id={id} x={880} y={210} r={86} />
			<Ridges id={id} />
			<Pagoda x={260} y={500} s={1.2} />
			<Pagoda x={560} y={540} s={0.7} o={0.85} />
			<Disruption />
		</svg>
	)
}

export function SceneFork({ className }: SceneProps) {
	const id = useId().replace(/:/g, '')
	return (
		<svg
			viewBox="0 0 1200 700"
			preserveAspectRatio="xMidYMid slice"
			className={className}
			aria-hidden="true"
		>
			<Defs id={id} />
			<rect width="1200" height="700" fill={`url(#${id}-sky)`} />
			<Moon id={id} x={760} y={250} r={96} />
			<Ridges id={id} lift={-30} />
			<g className="rm-fog">
				<rect x="0" y="380" width="1200" height="260" fill={`url(#${id}-mist)`} />
				<ellipse cx="300" cy="520" rx="380" ry="40" fill={PAPER} opacity="0.07" />
				<ellipse cx="900" cy="470" rx="320" ry="30" fill={PAPER} opacity="0.06" />
			</g>
			{/* a road that forks three ways */}
			<g fill="none" stroke={PAPER} strokeOpacity="0.26" strokeLinecap="round">
				<path d="M600 700C600 640 590 600 560 560C520 510 430 480 340 470" strokeWidth="14" />
				<path d="M600 700C600 620 600 560 604 500C606 450 610 410 612 380" strokeWidth="10" />
				<path d="M600 700C610 640 640 600 690 560C750 510 850 490 960 480" strokeWidth="14" />
			</g>
			<Traveller x={600} y={560} s={0.9} />
		</svg>
	)
}

export function SceneSamurai({ className }: SceneProps) {
	const id = useId().replace(/:/g, '')
	return (
		<svg
			viewBox="0 0 1200 700"
			preserveAspectRatio="xMidYMid slice"
			className={className}
			aria-hidden="true"
		>
			<Defs id={id} />
			<rect width="1200" height="700" fill={`url(#${id}-sky)`} />
			<g className="rm-moon-still">
				<Moon id={id} x={640} y={350} r={200} />
			</g>
			<Ridges id={id} lift={40} />
			<Samurai x={540} y={236} s={1.1} />
			<path d="M0 650h1200v50H0z" fill={INK} />
		</svg>
	)
}

export function SceneGate({ className }: SceneProps) {
	const id = useId().replace(/:/g, '')
	return (
		<svg
			viewBox="0 0 1200 700"
			preserveAspectRatio="xMidYMid slice"
			className={className}
			aria-hidden="true"
		>
			<Defs id={id} />
			<rect width="1200" height="700" fill={`url(#${id}-sky)`} />
			<Moon id={id} x={820} y={190} r={70} />
			<Ridges id={id} lift={30} />
			<Torii x={820} y={600} s={1.45} glow />
			<g fill="none" stroke={GOLD} strokeOpacity="0.45" strokeLinecap="round">
				<path d="M820 640C830 610 810 590 820 560" strokeWidth="26" strokeOpacity="0.18" />
			</g>
			<g>
				<circle cx="690" cy="520" r="8" fill={GOLD} opacity="0.8" />
				<circle cx="950" cy="520" r="8" fill={GOLD} opacity="0.8" />
			</g>
		</svg>
	)
}
