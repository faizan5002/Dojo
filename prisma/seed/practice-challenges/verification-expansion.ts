import type { ChallengeDefinition, Criterion } from '@/features/practice/types'
import { asksForEvidence, asksForTests, blindTrustPitfall } from './shared'
import { NOTE, challengesClaim } from './verification'

// Five more verification exercises. Each agent reply sounds finished and hides
// a different class of fault: access control, edge cases, injection, unsafe
// uploads, and a mismatch with the acceptance criteria.

const ORDERS = [/\b(?:orders?|endpoint|api|requests?|users?|customers?)\b/i]
const DISCOUNT = [/\b(?:discount\w*|codes?|carts?|totals?|percent\w*|coupons?)\b/i]
const SEARCH = [/\b(?:search\w*|query|queries|products?|term|input|sql)\b/i]
const UPLOAD = [/\b(?:upload\w*|files?|images?|avatars?)\b/i]
const RATES = [/\b(?:rates?|currenc\w*|freefx|api|conver\w*|eur|usd|base)\b/i]

const ownership: Criterion = {
	id: 'ownership',
	label: 'Asks for an ownership check',
	weight: 30,
	anyOf: [
		/\b(?:owner\w*|belongs? to|another (?:user|customer)|other (?:users|customers)|someone else'?s|their own|idor)\b/i
	],
	hint: 'Ask that a user can only read their own records, and what everyone else gets.',
	template: 'Scope the lookup to the signed-in user: [whose records, and the response otherwise].'
}

const signedOut: Criterion = {
	id: 'authentication',
	label: 'Covers signed-out requests',
	weight: 15,
	anyOf: [
		/\b(?:signed[- ]out|not signed in|logged[- ]out|unauthenticated|401|without a session)\b/i
	],
	hint: 'Ask what a request with no session gets.',
	template: 'A request without a session gets [401].'
}

const discountCases: Criterion = {
	id: 'cases',
	label: 'Names the cases it skipped',
	weight: 35,
	anyOf: [
		/\b(?:expired?|unknown|invalid|empty|negative|zero|over 100|more than 100|already used|used twice|once per|rounding|whole cents)\b/i
	],
	near: DISCOUNT,
	hint: 'List the inputs a happy-path test never tries: expired, unknown, reused, over 100%, empty.',
	template: 'Handle: [the expired, unknown, reused and out-of-range cases].'
}

const injection: Criterion = {
	id: 'injection',
	label: 'Flags the injection risk and the fix',
	weight: 30,
	anyOf: [
		/\b(?:sql injection|injection|parameteri[sz]ed|bind (?:parameters?|variables?)|placeholders?|findMany|tagged template)\b/i
	],
	hint: 'Point out that user input is concatenated into SQL, and ask for a parameterized query.',
	template: 'Use a parameterized query: [never concatenate user input into SQL].'
}

const resultLimits: Criterion = {
	id: 'limits',
	label: 'Limits what the query returns',
	weight: 15,
	anyOf: [
		/\b(?:limit|paginat\w*|select \*|only the (?:columns|fields)|max(?:imum)? (?:results|rows))\b/i
	],
	hint: 'Ask for only the columns needed and a cap on the number of rows.',
	template: 'Return only [the columns needed], at most [N] rows.'
}

const fileType: Criterion = {
	id: 'fileType',
	label: 'Asks for a real file type check',
	weight: 20,
	anyOf: [
		/\b(?:file types?|mime|content[- ]type|magic bytes|extension|only (?:jpe?g|png|images?)|allow ?list)\b/i
	],
	hint: 'Ask that the type is checked from the content, against an allowed list.',
	template: 'Check the file type from its content; allow only [the image types].'
}

const fileName: Criterion = {
	id: 'fileName',
	label: 'Rejects the user-supplied filename',
	weight: 20,
	anyOf: [/\b(?:file ?names?|path traversal|random (?:name|id|uuid)|uuid|sanitiz\w*)\b/i],
	hint: 'Ask that stored files get generated names, so a filename cannot escape the folder.',
	template: 'Store files under [a generated name], never the original filename.'
}

const fileSize: Criterion = {
	id: 'size',
	label: 'Asks for a size limit',
	weight: 15,
	anyOf: [/\b(?:size limit|max(?:imum)? size|\d+\s?mb|too large|oversized)\b/i],
	hint: 'Ask for a maximum file size, enforced on the server.',
	template: 'Reject files over [the size limit].'
}

const eachCriterion: Criterion = {
	id: 'criteria',
	label: 'Checks each acceptance criterion',
	weight: 25,
	anyOf: [
		/\b(?:each (?:acceptance )?criterion|every (?:acceptance )?criterion|criteri(?:on|a) (?:1|2|3|one|two|three)|one by one)\b/i
	],
	hint: 'Walk through the acceptance criteria one at a time, not the summary "all met".',
	template: 'Check [each acceptance criterion] and show where the code meets it.'
}

const assumptions: Criterion = {
	id: 'assumptions',
	label: 'Challenges an assumption about the API',
	weight: 20,
	anyOf: [/\b(?:assum\w*|base currency|eur[- ]based|docs say|api reference)\b/i],
	near: RATES,
	hint: 'Question what the agent assumed about the external API, against its documentation.',
	template: 'You assumed [X] about the API; confirm it against the documentation.'
}

const staleness: Criterion = {
	id: 'staleness',
	label: 'Catches the stale cache',
	weight: 15,
	anyOf: [/\b(?:cached forever|stale|older than|expir\w*|ttl|one hour|1 hour)\b/i],
	hint: 'Notice that a cache with no expiry breaks the freshness requirement.',
	template: 'Expire the cache after [the freshness limit].'
}

export const VERIFICATION_EXPANSION: readonly ChallengeDefinition[] = [
	{
		slug: 'verification-order-access',
		version: 1,
		title: 'Whose order is it?',
		description: '"It works with order 42" says nothing about who else can read order 42.',
		skill: 'verification',
		type: 'verifyOutput',
		difficulty: 'beginner',
		scenario:
			"You asked an agent for an endpoint that returns one order with its items and delivery address. The handler finds the order by its id only, so any signed-in user who guesses an id can read another customer's address.",
		instructions:
			'Write the follow-up that makes the agent close the access-control gap and prove it.',
		given: {
			label: `The agent's reply. ${NOTE}`,
			text: "Done! GET /api/orders/:id now returns the order with its items and the customer's address. I tested it with order 42 and it works."
		},
		criteria: [
			challengesClaim,
			ownership,
			signedOut,
			{ ...asksForTests(20, ORDERS), label: 'Asks for access-control tests' },
			asksForEvidence(20)
		],
		pitfalls: [blindTrustPitfall],
		exemplar:
			"Not done yet: this returns any order to anyone who knows its id. Look the order up by both its id and the signed-in user's id, so a customer can only read their own orders, and return 404 for an order that belongs to another customer. A signed-out request must get 401. Add tests for reading your own order, another customer's order and a signed-out request, then run them and paste the output.",
		explanation:
			'It names the hole (lookup by id alone), fixes it at the query, decides what outsiders see, and asks for tests that would have caught it.',
		minutes: 5,
		tags: ['security', 'authorization'],
		isActive: true
	},
	{
		slug: 'verification-discount-cases',
		version: 1,
		title: 'One test is not coverage',
		description: 'A single happy-path example hides every case that can go wrong.',
		skill: 'verification',
		type: 'verifyOutput',
		difficulty: 'beginner',
		scenario:
			'An agent wrote `applyDiscount(cart, code)` for checkout. It looks up the code and subtracts its percentage. Codes can expire, can be single-use, and marketing has created a 150% "test" code by mistake.',
		instructions:
			'Write the follow-up that makes the agent handle and test the cases its one example skipped.',
		given: {
			label: `The agent's reply. ${NOTE}`,
			text: 'Implemented applyDiscount(cart, code): it looks up the code and subtracts its percentage from the cart total. Tested with SAVE10 on a 100 dollar cart and the total is 90.'
		},
		criteria: [
			challengesClaim,
			discountCases,
			{ ...asksForTests(25, DISCOUNT), label: 'Asks for a test per case' },
			asksForEvidence(25)
		],
		pitfalls: [blindTrustPitfall],
		exemplar:
			'Before I accept this, one happy-path check is not enough to call it done. Handle the discount cases it skips: an unknown or expired code, a code that was already used, a percentage over 100 that would make the total negative, an empty cart, and rounding to whole cents. Each should either apply correctly or return a clear error without changing the cart total. Add unit tests for every one of those discount cases plus the SAVE10 example, then run them and paste the results.',
		explanation:
			'It lists the realistic failures (including the bad 150% code), defines what "handled" means, and asks for a test per case with the output.',
		minutes: 5,
		tags: ['edge-cases', 'checkout'],
		isActive: true
	},
	{
		slug: 'verification-raw-search-query',
		version: 1,
		title: 'Spot the injectable query',
		description: 'A search that "works great" can still hand the database to an attacker.',
		skill: 'verification',
		type: 'verifyOutput',
		difficulty: 'intermediate',
		scenario:
			'An agent added product search using Prisma. Instead of the query builder it used `$queryRawUnsafe` and concatenated the search term into the SQL string. The products table has 40 columns, including internal cost prices.',
		instructions:
			'Write the follow-up that makes the agent remove the injection risk, limit what is returned, and prove it with tests.',
		given: {
			label: `The agent's reply. ${NOTE}`,
			text: 'Added search! The handler runs db.$queryRawUnsafe("SELECT * FROM products WHERE name LIKE \'%" + term + "%\'") and returns the matching products. Works great.'
		},
		criteria: [
			challengesClaim,
			injection,
			resultLimits,
			{ ...asksForTests(20, SEARCH), label: 'Asks for tests with hostile input' },
			asksForEvidence(20)
		],
		pitfalls: [blindTrustPitfall],
		exemplar:
			"Before I merge this, the search builds SQL from user input, which is open to SQL injection. Rewrite it with a parameterized query, ideally Prisma's findMany with a contains filter, so the search term is never concatenated into SQL. Return only the columns the page needs instead of SELECT *, and limit results to 50. Add tests that search for a normal term, a term with a quote character and an injection attempt, then run them and show me the output.",
		explanation:
			'It recognises the concatenation as injection, asks for the safe API instead, stops internal columns leaking, and tests with the input an attacker would send.',
		minutes: 6,
		tags: ['security', 'database'],
		isActive: true
	},
	{
		slug: 'verification-upload-security',
		version: 1,
		title: 'An upload that trusts the user',
		description: 'Original filenames and unchecked types turn an avatar upload into an attack.',
		skill: 'verification',
		type: 'verifyOutput',
		difficulty: 'intermediate',
		scenario:
			'An agent built avatar uploads. Files are saved into `public/uploads/` under their original filename and served from the same domain as the app. Nothing checks the type or the size.',
		instructions:
			'Write the follow-up that makes the agent fix the type, filename and size problems and prove the fixes.',
		given: {
			label: `The agent's reply. ${NOTE}`,
			text: 'Upload is working! POST /api/avatar saves req.file to public/uploads/ using the original filename, so images are served straight away. Tested with a PNG.'
		},
		criteria: [
			challengesClaim,
			fileType,
			fileName,
			fileSize,
			{ ...asksForTests(15, UPLOAD), label: 'Asks for tests with malicious files' },
			asksForEvidence(15)
		],
		pitfalls: [blindTrustPitfall],
		exemplar:
			'Before we ship this, the upload is not safe. Check the real file type from its content, not the extension, and accept only JPEG, PNG or WebP, so nobody can upload an HTML or SVG file that runs scripts. Never use the original filename: store each file under a random UUID name, which also closes path traversal through names like ../../app.js on the server. Reject avatar files over 2 MB. Add tests for a valid image, a renamed HTML file, an oversized file and a traversal filename, then run them and show me the output.',
		explanation:
			'It catches all three trust failures (type, name, size), explains the attack each enables, and asks for tests using exactly those attacks.',
		minutes: 7,
		tags: ['security', 'uploads'],
		isActive: true
	},
	{
		slug: 'verification-acceptance-check',
		version: 1,
		title: '"All criteria met", checked',
		description: 'Hold the reply against the acceptance criteria one by one.',
		skill: 'verification',
		type: 'verifyOutput',
		difficulty: 'advanced',
		scenario:
			'The ticket\'s acceptance criteria: (1) exchange rates are never older than one hour; (2) converted amounts are rounded half-even to 2 decimals; (3) if the rate provider is unavailable, the last known rate is used with a "rates may be out of date" notice. The FreeFX documentation says /latest returns EUR-based rates unless a base is passed.',
		instructions:
			'Write the follow-up that checks the work against each criterion, challenges the assumption about the API, and asks for proof.',
		given: {
			label: `The agent's reply. ${NOTE}`,
			text: 'Done! Added the currency converter using the FreeFX API: GET /latest returns the rates and I multiply the amount by the USD rate. Rates are cached forever in memory for speed. All 3 acceptance criteria are met.'
		},
		criteria: [
			challengesClaim,
			eachCriterion,
			assumptions,
			staleness,
			{ ...asksForTests(10, RATES), label: 'Asks for tests per criterion' },
			asksForEvidence(15)
		],
		pitfalls: [blindTrustPitfall],
		exemplar:
			'Before I accept this, check the reply against each acceptance criterion, one by one, and show where the code meets it. Criterion 1 is not met: rates cached forever in memory will be older than one hour, so give the cache a one-hour expiry. For criterion 2, show me where amounts are rounded half-even to 2 decimals; I do not see it. For criterion 3, nothing handles FreeFX being unavailable, so fall back to the last known rate with its notice. You also assumed the rates are USD-based, but the FreeFX docs say /latest is EUR-based unless you pass a base currency. Add tests for each criterion, including stale rates and a provider timeout, then run them and paste the output.',
		explanation:
			'It replaces "all met" with a criterion-by-criterion check, finds the two that are broken, and catches the base-currency assumption that would make every conversion wrong.',
		minutes: 10,
		tags: ['acceptance-criteria', 'integration'],
		isActive: true
	}
]
