import type { ChallengeDefinition, Criterion } from '@/features/practice/types'
import {
	acceptanceCriteria,
	edgeCases,
	expectedBehaviour,
	objective,
	technicalContext,
	vaguePitfall
} from './shared'

// Five more prompt-clarity exercises: each gives a one-line request whose gaps
// are specific to its situation (data, uploads, filters, rules, a third party).

const REPORT = [/\b(?:report|revenue|orders?|sales|month\w*|query|totals?)\b/i]
const UPLOAD = [/\b(?:upload\w*|images?|pictures?|photos?|avatars?|files?)\b/i]
const PRODUCTS = [/\b(?:products?|categor\w*|price|stock|filter\w*|pages?|results?|list)\b/i]
const SIGNUP = [/\b(?:sign ?up|form|fields?|company|vat|password|email|registration)\b/i]
const SHIPPING = [/\b(?:shipquick|shipping|rates?|checkout|carrier|provider|integration|api)\b/i]

const fileLimits: Criterion = {
	id: 'limits',
	label: 'Sets the file limits',
	weight: 25,
	anyOf: [
		/\b(?:\d+\s?(?:kb|mb|gb|px)|jpe?g|png|webp|gif|mime|file types?|size limit|max(?:imum)? size)\b/i
	],
	hint: 'Say which file types and sizes are allowed.',
	template: 'Limits: [allowed file types and the maximum size].'
}

const parameters: Criterion = {
	id: 'parameters',
	label: 'Defines the parameters exactly',
	weight: 25,
	anyOf: [
		/\b(?:query param\w*|parameters?|page ?size|limit|offset|cursor|sort(?:ed)? by|defaults? (?:to|of)|\(default)\b/i
	],
	near: PRODUCTS,
	hint: 'Name every filter, sort and paging parameter, with its type and default.',
	template: 'Parameters: [each filter, the sort options, page and page size with defaults].'
}

const rules: Criterion = {
	id: 'rules',
	label: 'Spells out each rule',
	weight: 30,
	anyOf: [
		/\b(?:at least \d+|\d+ (?:to|-) \d+ characters?|must (?:contain|include|be|match|start)|format|regex|pattern|required|unique)\b/i
	],
	near: SIGNUP,
	hint: 'Write each validation rule as something checkable: lengths, formats, required fields.',
	template: 'Rules: [each field, and exactly what makes it valid].'
}

const serverSide: Criterion = {
	id: 'server',
	label: 'Asks for the same rules on the server',
	weight: 10,
	anyOf: [
		/\b(?:server|backend|api)\b.{0,60}\b(?:validat\w*|same rules|enforc\w*)\b/i,
		/\b(?:validat\w*|same rules|enforc\w*)\b.{0,60}\b(?:server|backend|api)\b/i
	],
	hint: 'Browser validation can be skipped; ask for the same rules on the server.',
	template: 'Enforce the same rules in [the API handler], not only in the form.'
}

const sourceOfTruth: Criterion = {
	id: 'docs',
	label: 'Points to the real API contract',
	weight: 20,
	anyOf: [/\b(?:docs?|documentation|api reference|openapi|spec(?:ification)?|sandbox|v\d)\b/i],
	near: SHIPPING,
	hint: 'Point the agent to the provider documentation and sandbox, so it does not invent the API.',
	template: 'Work from [the provider API reference and version], and test against its sandbox.'
}

const failureModes: Criterion = {
	id: 'failures',
	label: 'Says how failures are handled',
	weight: 20,
	anyOf: [
		/\b(?:timeouts?|retr(?:y|ies)|rate limit\w*|429|5\d\d|5xx|unavailable|fall ?back|circuit)\b/i
	],
	hint: 'Say what happens when the provider is slow, rate-limited or down.',
	template: 'Failures: [timeouts, rate limits and outages, and the fallback].'
}

const secrets: Criterion = {
	id: 'secrets',
	label: 'Says where credentials live',
	weight: 10,
	anyOf: [
		/\b(?:env(?:ironment)? var\w*|secrets?|credentials?|api keys?|never (?:log|commit|hard-?code))\b/i
	],
	hint: 'Say where the credentials come from, and that they are never logged or committed.',
	template: 'Credentials: read [the keys] from environment variables; never log them.'
}

const surfaceUnknowns: Criterion = {
	id: 'unknowns',
	label: 'Asks for assumptions instead of guesses',
	weight: 15,
	anyOf: [
		/\b(?:ask (?:me )?(?:first|before)|list (?:your |any )?(?:assumptions|open questions|unknowns)|don'?t guess|do not guess|confirm with me)\b/i
	],
	hint: 'Ask the agent to list its assumptions and questions rather than guess.',
	template: 'Before coding, list your assumptions and open questions about [the API].'
}

export const CLARITY_EXPANSION: readonly ChallengeDefinition[] = [
	{
		slug: 'clarity-sales-report-query',
		version: 1,
		title: 'Give a report query its context',
		description: 'A query request without tables, columns or rules gets a guessed query.',
		skill: 'promptClarity',
		type: 'improveVaguePrompt',
		difficulty: 'beginner',
		scenario:
			'An admin page needs monthly sales figures. Orders live in a PostgreSQL `orders` table (accessed with Prisma) with `status`, `total_cents` and `created_at`; refunded orders keep the status "refunded".',
		instructions:
			'Rewrite the prompt so the agent knows which data to use, what the result looks like, which rows count, and how you will check it.',
		given: { label: 'The vague prompt', text: 'Write a query for the sales report.' },
		criteria: [
			objective(20, REPORT),
			technicalContext(25),
			expectedBehaviour(20, REPORT),
			edgeCases(15, REPORT),
			acceptanceCriteria(20, REPORT)
		],
		pitfalls: [vaguePitfall],
		exemplar:
			"Write a Prisma query in `src/server/reports/sales.ts` that returns total revenue per calendar month for the last 12 months from the `orders` table in PostgreSQL. It should return an array of { month: 'YYYY-MM', revenue, orderCount }, counting only orders with status 'paid' and summing `total_cents`. Empty months with no orders must still appear with zero revenue, and refunded orders are excluded. Done when: a test with seeded orders across three months checks the totals, including an empty month, and it passes.",
		explanation:
			'It names the table, columns and tool, defines the result shape, says which orders count, and covers the empty month a naive GROUP BY would drop.',
		minutes: 5,
		tags: ['database', 'reporting'],
		isActive: true
	},
	{
		slug: 'clarity-avatar-upload',
		version: 1,
		title: 'Specify an upload before it is built',
		description: 'Uploads need types, sizes, storage and failure messages spelled out.',
		skill: 'promptClarity',
		type: 'improveVaguePrompt',
		difficulty: 'beginner',
		scenario:
			'Your React app talks to an Express API. Files are stored in S3 through the helper in `src/server/storage.ts`. Users have asked to set a profile picture.',
		instructions:
			'Rewrite the prompt so the agent knows what to build, which files are allowed, what success and failure look like, and how it is tested.',
		given: { label: 'The vague prompt', text: 'Add profile picture upload.' },
		criteria: [
			objective(15, UPLOAD),
			technicalContext(15),
			expectedBehaviour(25, UPLOAD),
			fileLimits,
			acceptanceCriteria(20, UPLOAD)
		],
		pitfalls: [vaguePitfall],
		exemplar:
			'Add a profile picture upload to the account settings page (React), backed by a new POST /api/me/avatar route in our Express server. Accept only JPEG, PNG or WebP files up to 5 MB, store the image in S3 through `src/server/storage.ts` and save its URL on the user. On success the endpoint should return 200 with the new image URL and the page should show the picture at once. A wrong file type or a file over 5 MB must return 400 with a message shown next to the upload button. Done when: tests cover a valid upload, an oversized file and a wrong file type, and they pass.',
		explanation:
			'It fixes the allowed types and size, says where the file goes, describes both the success and the failure the user sees, and ends with tests for each.',
		minutes: 5,
		tags: ['uploads', 'api'],
		isActive: true
	},
	{
		slug: 'clarity-product-filters',
		version: 1,
		title: 'Pin down filters and pagination',
		description: '"Add filters" leaves every parameter, default and limit to chance.',
		skill: 'promptClarity',
		type: 'improveVaguePrompt',
		difficulty: 'intermediate',
		scenario:
			'GET /api/products in a NestJS service (`ProductsController`) returns all 20,000 products at once. The admin list needs to filter by category, price range and stock, sort, and page through the results.',
		instructions:
			'Rewrite the prompt so every parameter, its default and its limit is explicit, along with the response shape and what happens with bad input.',
		given: { label: 'The vague prompt', text: 'Add filters and pagination to the products list.' },
		criteria: [
			objective(15, PRODUCTS),
			technicalContext(10),
			parameters,
			expectedBehaviour(15, PRODUCTS),
			edgeCases(20, PRODUCTS),
			acceptanceCriteria(15, PRODUCTS)
		],
		pitfalls: [vaguePitfall],
		exemplar:
			'Add filtering and pagination to GET /api/products in our NestJS `ProductsController`, which today returns all 20,000 products. Support the query parameters category, minPrice and maxPrice in cents, inStock, sort (price or name, ascending by default), page (default 1) and pageSize (default 20, at most 100). The response should return { items, total, page, pageSize } so the admin list can show the page count. Invalid values, such as a negative price, minPrice above maxPrice or a pageSize over 100, must return 400 naming the wrong field. Done when: tests cover each filter, combined filters, the last page and the invalid inputs, and they pass.',
		explanation:
			'Every parameter has a type, a default and a ceiling, the response shape supports a page count, and invalid input has a defined answer instead of a crash.',
		minutes: 7,
		tags: ['api', 'pagination'],
		isActive: true
	},
	{
		slug: 'clarity-signup-validation',
		version: 1,
		title: 'Turn "validate it" into rules',
		description: 'Validation is only as good as the rules you actually write down.',
		skill: 'promptClarity',
		type: 'improveVaguePrompt',
		difficulty: 'intermediate',
		scenario:
			'A B2B signup form in a Next.js app (`app/signup/page.tsx`, React Hook Form with Zod) posts to `/api/signup`. Sales wants only work emails, a strong password and a valid VAT number for EU companies.',
		instructions:
			'Rewrite the prompt so each rule is precise, the user sees errors in the right place, and the server enforces the same rules.',
		given: { label: 'The vague prompt', text: 'Add validation to the signup form.' },
		criteria: [
			objective(15, SIGNUP),
			technicalContext(15),
			rules,
			expectedBehaviour(15, SIGNUP),
			serverSide,
			acceptanceCriteria(15, SIGNUP)
		],
		pitfalls: [vaguePitfall],
		exemplar:
			"Add validation to the company signup form in `app/signup/page.tsx` (React Hook Form with Zod). The rules: company name is required and 2 to 100 characters; the work email must not use a free provider such as gmail.com; the password must be at least 12 characters and contain a number; the VAT number is required for EU companies and must match that country's format. Each field should show its error under the field when it loses focus. Enforce the same rules on the server in the /api/signup handler, returning 400 with the failing fields. Done when: tests cover every rule in both the form and the API, and they pass.",
		explanation:
			'Each rule is testable as written, the error placement is decided, and the server repeats the rules so they cannot be bypassed.',
		minutes: 7,
		tags: ['validation', 'forms'],
		isActive: true
	},
	{
		slug: 'clarity-shipping-provider',
		version: 1,
		title: 'Brief an agent on an unfamiliar API',
		description: 'With a third party, the agent must work from the contract, not memory.',
		skill: 'promptClarity',
		type: 'improveVaguePrompt',
		difficulty: 'advanced',
		scenario:
			'Your older Node.js monolith needs live shipping rates at checkout from ShipQuick, a provider nobody on the team has used. Its v2 REST API uses OAuth client credentials, allows 10 requests per second and has a sandbox. Checkout must never block on it.',
		instructions:
			'Rewrite the prompt so the agent works from the real API, handles its failures, keeps the credentials safe, surfaces what it does not know, and proves it works.',
		given: { label: 'The vague prompt', text: 'Integrate ShipQuick for shipping rates.' },
		criteria: [
			objective(10, SHIPPING),
			technicalContext(10),
			sourceOfTruth,
			failureModes,
			secrets,
			surfaceUnknowns,
			acceptanceCriteria(15, SHIPPING)
		],
		pitfalls: [vaguePitfall],
		exemplar:
			'Add live shipping rates at checkout by integrating the ShipQuick REST API into our Node.js monolith, in a new `src/shipping/shipquick-client.ts` used by the existing `CheckoutService`. Work from the ShipQuick v2 API reference and test against their sandbox, not from memory of other shipping providers. Read the client id and client secret from environment variables and never log or commit them. A timeout after 3 seconds, a 429 rate limit or any 5xx response should fall back to our flat-rate shipping, so checkout never blocks. Before you write code, list your assumptions and open questions about the API, and do not guess field names. Done when: tests with a mocked ShipQuick API cover normal rates, a timeout, a 429 and a 500, and checkout still shows rates.',
		explanation:
			'It anchors the agent to the documented contract, decides the failure behaviour up front, protects the credentials, and makes the agent say what it is unsure of instead of inventing it.',
		minutes: 10,
		tags: ['integration', 'third-party'],
		isActive: true
	}
]
