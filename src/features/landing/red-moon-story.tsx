import { Onest } from 'next/font/google'
import { EvidenceIcon, ScrollIcon, SwordsIcon } from '@/features/progression/ui/dojo-icons'
import { Link } from '@/i18n/routing'
import { cn } from '@/lib/cn'
import { SceneDisrupt, SceneFork, SceneGate, SceneRise, SceneSamurai } from './red-moon-art'
import './red-moon.css'

const onest = Onest({ subsets: ['latin'], variable: '--font-onest', display: 'swap' })

const SCENES = [
	{
		id: 'rise',
		Art: SceneRise,
		line: 'The red moon rises.',
		body: 'Software development is changing shape, and fast.'
	},
	{
		id: 'disruption',
		Art: SceneDisrupt,
		line: 'The landscape is being redrawn.',
		body: 'AI is changing how software gets built. The tools, the workflows and what a developer is expected to know are all in motion.'
	},
	{
		id: 'uncertainty',
		Art: SceneFork,
		line: 'Every road looks uncertain.',
		body: 'Which skills still matter? What does good work look like now? The untrained are overwhelmed by the change.'
	},
	{
		id: 'samurai',
		Art: SceneSamurai,
		line: 'A samurai does not fear a changing battlefield.',
		body: 'The trained adapt. Discipline is what carries over from one era to the next. A samurai trains.'
	}
] as const

const STEPS = [
	{
		Icon: ScrollIcon,
		title: 'Bring your own sessions',
		body: 'Upload the coding-agent conversations you already have. Prompts and final answers only, secrets redacted.'
	},
	{
		Icon: EvidenceIcon,
		title: 'See how you actually work',
		body: 'Five skills scored against the lines you wrote, each with the evidence behind it.'
	},
	{
		Icon: SwordsIcon,
		title: 'Train what is weakest',
		body: 'Practice built from your own weakest habit, then checked against the same rules.'
	}
] as const

/**
 * The Red Moon Era story, below the landing hero (which is left exactly as it was): five scenes
 * (the moon rises, the landscape is redrawn by AI, the road forks, the samurai stands, the dojo
 * opens), then how Dojo trains. It makes no claims about jobs or numbers: the story is qualitative,
 * and the product facts are the ones the product delivers.
 */
export function RedMoonStory() {
	return (
		<div className={cn(onest.variable, 'rm')}>
			{SCENES.map(({ id, Art, line, body }) => (
				<section key={id} className={`rm-scene rm-${id}`} aria-labelledby={`rm-${id}-line`}>
					<Art className="rm-art" />
					<div className="rm-copy">
						<h2 id={`rm-${id}-line`}>{line}</h2>
						<p>{body}</p>
					</div>
				</section>
			))}

			<section className="rm-scene rm-gate" aria-labelledby="rm-gate-line">
				<SceneGate className="rm-art" />
				<div className="rm-copy">
					<h2 id="rm-gate-line">Dojo is where developers train for the new era.</h2>
					<p>
						Practise how you direct an AI coding agent, against the work you actually do. Rank,
						streak and seals are a demonstration; the scores and the evidence are real.
					</p>
					<div className="rm-cta">
						<Link href="/sample" className="rm-btn rm-btn-primary">
							Start with the sample
						</Link>
						<Link href="/sign-up" className="rm-btn">
							Create an account
						</Link>
					</div>
				</div>
			</section>

			<section className="rm-steps" aria-labelledby="rm-steps-title">
				<h2 id="rm-steps-title">How training works</h2>
				<ol>
					{STEPS.map(({ Icon, title, body }) => (
						<li key={title}>
							<Icon size={30} />
							<h3>{title}</h3>
							<p>{body}</p>
						</li>
					))}
				</ol>
				<p className="rm-end">The era has changed. The discipline remains.</p>
			</section>
		</div>
	)
}
