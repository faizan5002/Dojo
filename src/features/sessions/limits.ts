// Intake runs in the browser on files the user picks, so these caps keep one
// oversized or runaway selection from freezing the tab. A real digest is
// kilobytes per session; the per-file cap leaves two orders of magnitude.
export const MAX_LOG_FILE_BYTES = 5 * 1024 * 1024
export const MAX_LOG_FILES = 200
export const MAX_SESSION_ID_LENGTH = 128
export const LOG_FILE_EXTENSION = '.md'

/** The largest redacted upload sent to the server; next.config.ts allows this much. */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024
