import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
	server: {
		BETTER_AUTH_SECRET: z.string().min(32),
		BETTER_AUTH_URL: z.url(),
		CLOUDFLARE_CLIENT_ID: z.string().min(1),
		CLOUDFLARE_CLIENT_SECRET: z.string().min(1),
		CLOUDFLARE_OAUTH_SCOPES: z
			.string()
			.default("account-settings.read page.read page.write user-details.read")
			.transform((value) => value.split(/\s+/).filter(Boolean)),
	},

	clientPrefix: "VITE_",

	client: {},

	/**
	 * On Workers, `nodejs_compat` populates `process.env` with vars and secrets
	 * (and with `.env` values during local dev).
	 */
	runtimeEnv:
		typeof process === "undefined" ? import.meta.env : { ...import.meta.env, ...process.env },

	emptyStringAsUndefined: true,
});
