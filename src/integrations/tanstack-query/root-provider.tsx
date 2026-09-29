import { QueryCache, QueryClient } from "@tanstack/react-query";

import { handleExpiredSession } from "#/lib/auth-client";
import { isUnauthorized } from "#/lib/errors";

export function getContext() {
	const queryClient = new QueryClient({
		queryCache: new QueryCache({
			onError: (error) => {
				// Expired session or revoked Cloudflare access: start over at sign in.
				if (isUnauthorized(error) && typeof window !== "undefined") void handleExpiredSession();
			},
		}),
		defaultOptions: {
			queries: {
				staleTime: 30_000,
				refetchOnWindowFocus: false,
				retry: (count, error) => !isUnauthorized(error) && count < 2,
			},
		},
	});

	return {
		queryClient,
	};
}
