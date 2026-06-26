export const EXIT_CODES = {
  SUCCESS: 0,
  GENERAL_ERROR: 1,
  AUTH_ERROR: 2,
  SCOPE_ERROR: 3,
  NOT_FOUND: 4,
  RATE_LIMITED: 5,
  VALIDATION_ERROR: 6,
  NETWORK_ERROR: 7,
} as const

export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES]

// Named sentinel classes used for instanceof checks against @autoposting.ai/sdk errors.
// We match by constructor name so this works even if the SDK hasn't shipped error
// classes yet (dynamic require would silently fail). When the SDK exports these
// classes they will inherit from AutopostingError and carry the same names.
function matchesClass(error: unknown, className: string): boolean {
  if (error == null || typeof error !== 'object') return false
  // Walk prototype chain checking constructor names
  let proto = Object.getPrototypeOf(error) as object | null
  while (proto !== null) {
    const ctor = (proto as { constructor?: { name?: string } }).constructor
    if (ctor?.name === className) return true
    proto = Object.getPrototypeOf(proto) as object | null
  }
  return false
}

export function exitCodeFromError(error: unknown): ExitCode {
  // An explicit numeric `exitCode` (e.g. attached by resolveAuth for missing/invalid
  // credentials) takes precedence over class-name matching, so every command — not
  // just the ones with a local wrapper — exits with the right code.
  const attached = (error as { exitCode?: number } | null)?.exitCode
  if (typeof attached === 'number' && Number.isInteger(attached) && attached >= 0) {
    return attached as ExitCode
  }
  if (matchesClass(error, 'AuthenticationError')) return EXIT_CODES.AUTH_ERROR
  if (matchesClass(error, 'ScopeError')) return EXIT_CODES.SCOPE_ERROR
  if (matchesClass(error, 'NotFoundError')) return EXIT_CODES.NOT_FOUND
  if (matchesClass(error, 'RateLimitError')) return EXIT_CODES.RATE_LIMITED
  if (matchesClass(error, 'ValidationError')) return EXIT_CODES.VALIDATION_ERROR
  if (matchesClass(error, 'NetworkError')) return EXIT_CODES.NETWORK_ERROR
  // SDK transport failures are an AutopostingError carrying a string `code`, not a
  // dedicated class — match on the code so timeouts/network drops map to exit 7.
  const code = (error as { code?: unknown } | null)?.code
  if (code === 'NETWORK_ERROR' || code === 'TIMEOUT') return EXIT_CODES.NETWORK_ERROR
  return EXIT_CODES.GENERAL_ERROR
}
