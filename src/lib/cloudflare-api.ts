import type { APIError, RateLimitError } from "cloudflare/core/error";
import { BaseAccounts } from "cloudflare/resources/accounts/accounts";
import { BaseDeployments } from "cloudflare/resources/pages/projects/deployments/deployments";
import { BaseProjects } from "cloudflare/resources/pages/projects/projects";
import { BaseUser } from "cloudflare/resources/user/user";
import { createClient } from "cloudflare/tree-shakable";

/**
 * Official Cloudflare SDK client for the signed-in user's OAuth access token.
 * Only the resources the app uses are included, to keep the Worker bundle small.
 */
export function cloudflareClient(accessToken: string) {
	return createClient({
		apiToken: accessToken,
		// The SDK falls back to these env vars when unset. Clear them so a request
		// never carries credentials other than the user's own token.
		apiKey: null,
		apiEmail: null,
		userServiceKey: null,
		resources: [BaseAccounts, BaseUser, BaseProjects, BaseDeployments],
	});
}

/** Seconds to wait before retrying a rate-limited request. */
export function retryAfterSeconds(error: RateLimitError): number {
	const seconds = Number.parseInt(error.headers.get("retry-after") ?? "", 10);
	return Math.max(1, seconds || 10);
}

/** The API's own error messages, without the raw JSON the SDK puts in `message`. */
export function apiErrorMessage(error: APIError): string {
	const messages = error.errors.map((e) => e.message).filter(Boolean);
	return messages.length > 0
		? messages.join("; ")
		: `Cloudflare API request failed (${error.status ?? "network error"})`;
}
