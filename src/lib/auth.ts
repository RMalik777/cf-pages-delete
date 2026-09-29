import { betterAuth } from "better-auth";
import { genericOAuth } from "better-auth/plugins/generic-oauth";
import { tanstackStartCookies } from "better-auth/tanstack-start";

import { env } from "#/env";
import { cloudflareClient } from "#/lib/cloudflare-api";

/**
 * Stateless setup: no database. The session and the user's Cloudflare OAuth
 * tokens live in encrypted cookies (`account.storeAccountCookie` is enabled
 * automatically when no database is configured).
 */
export const auth = betterAuth({
	appName: "Pages Cleaner",
	baseURL: env.BETTER_AUTH_URL,
	secret: env.BETTER_AUTH_SECRET,
	session: {
		expiresIn: 60 * 60 * 24 * 7,
		cookieCache: {
			enabled: true,
			maxAge: 60 * 60 * 24 * 7,
			strategy: "jwe",
			refreshCache: true,
		},
	},
	account: {
		// Encrypt the OAuth tokens kept in the account cookie.
		encryptOAuthTokens: true,
	},
	advanced: {
		cookiePrefix: "pages-cleaner",
	},
	plugins: [
		genericOAuth({
			config: [
				{
					// Callback: /api/auth/callback/cloudflare
					providerId: "cloudflare",
					name: "Cloudflare",
					// Endpoints from https://dash.cloudflare.com/.well-known/openid-configuration
					authorizationUrl: "https://dash.cloudflare.com/oauth2/auth",
					tokenUrl: "https://dash.cloudflare.com/oauth2/token",
					clientId: env.CLOUDFLARE_CLIENT_ID,
					clientSecret: env.CLOUDFLARE_CLIENT_SECRET,
					tokenEndpointAuth: { method: "client_secret_basic" },
					scopes: env.CLOUDFLARE_OAUTH_SCOPES,
					pkce: true,
					// Cloudflare's userinfo endpoint only returns `sub`, so read the
					// profile from the API instead (needs the `user-details.read` scope).
					getUserInfo: async (tokens) => {
						if (!tokens.accessToken) return null;
						const user = await cloudflareClient(tokens.accessToken).user.get();
						const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ");
						return {
							id: user.id,
							email: user.email,
							name: fullName || user.email,
							emailVerified: true,
						};
					},
				},
			],
		}),
		// Must stay last so Set-Cookie headers from server functions are applied.
		tanstackStartCookies(),
	],
});
