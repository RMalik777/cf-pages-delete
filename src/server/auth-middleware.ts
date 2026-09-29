import { createMiddleware } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";

import { auth } from "#/lib/auth";
import { UNAUTHORIZED } from "#/lib/errors";

/**
 * Resolves the signed-in user and a valid Cloudflare access token (refreshing
 * it when needed) for every server function that talks to the Cloudflare API.
 */
export const cloudflareAuthMiddleware = createMiddleware({ type: "function" }).server(
	async ({ next }) => {
		const headers = getRequestHeaders();
		const session = await auth.api.getSession({ headers });
		if (!session) throw new Error(UNAUTHORIZED);

		let accessToken: string | undefined;
		try {
			const tokens = await auth.api.getAccessToken({
				// Stateless mode: the OAuth account lives in the signed account cookie.
				body: { useAccountCookie: true },
				headers,
			});
			accessToken = tokens.accessToken;
		} catch {
			accessToken = undefined;
		}
		if (!accessToken) throw new Error(UNAUTHORIZED);

		return next({ context: { user: session.user, accessToken } });
	},
);
