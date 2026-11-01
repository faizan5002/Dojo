// Git exports repository-selecting variables (GIT_DIR, GIT_INDEX_FILE,
// GIT_WORK_TREE, ...) to the hooks it runs, and a child process inherits them.
// A test that runs `git init` or `git config` in a temporary directory then
// operates on the repository that is running the hook instead: it can flip
// `core.bare`, write a `[user]` section or overwrite the index. Tests that use
// git against a temporary repo take their environment from here.

const isGitVariable = (name) => name.toUpperCase().startsWith('GIT_')

/** A copy of `env` without any inherited `GIT_*` variable. */
export function cleanGitEnv(env = process.env) {
	return Object.fromEntries(Object.entries(env).filter(([name]) => !isGitVariable(name)))
}

/**
 * Runs `fn` with `GIT_*` removed from `process.env`, then restores them. For
 * code that runs in this process and spawns git itself, where there is no
 * `env` option to pass. Synchronous on purpose: the removal must not span an
 * await, where another test could observe it.
 */
export function withoutGitEnv(fn) {
	const saved = Object.entries(process.env).filter(([name]) => isGitVariable(name))
	for (const [name] of saved) delete process.env[name]
	try {
		return fn()
	} finally {
		for (const [name, value] of saved) process.env[name] = value
	}
}
