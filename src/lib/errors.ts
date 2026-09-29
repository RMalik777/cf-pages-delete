/** Thrown by server functions when the session or Cloudflare token is missing or expired. */
export const UNAUTHORIZED = "UNAUTHORIZED";

export function isUnauthorized(error: unknown): boolean {
	return error instanceof Error && error.message === UNAUTHORIZED;
}

export function errorMessage(error: unknown): string {
	if (isUnauthorized(error)) return "Your Cloudflare session expired. Sign in again.";
	return error instanceof Error ? error.message : "Something went wrong.";
}
