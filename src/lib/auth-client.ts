import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();

export function signInWithCloudflare() {
	return authClient.signIn.social({ provider: "cloudflare", callbackURL: "/projects" });
}

/**
 * Cloudflare access tokens expire and this app gets no refresh token, so an
 * expired token ends the session: clear cookies and return to sign in.
 */
export async function handleExpiredSession() {
	await authClient.signOut().catch(() => undefined);
	window.location.assign("/");
}
