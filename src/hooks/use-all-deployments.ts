import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { deploymentsKey } from "#/lib/queries";
import { listDeploymentsPage } from "#/server/cloudflare.functions";
import type { Deployment } from "#/server/cloudflare.functions";

const PAGE_CONCURRENCY = 3;

export interface LoadProgress {
	loaded: number;
	total: number | null;
}

/**
 * Loads every deployment of a project, page by page, so large projects
 * (thousands of deployments) show progress instead of a long blank wait.
 */
export function useAllDeployments(accountId: string, projectName: string) {
	const [progress, setProgress] = useState<LoadProgress>({ loaded: 0, total: null });

	const query = useQuery({
		queryKey: deploymentsKey(accountId, projectName),
		staleTime: Infinity,
		queryFn: async (): Promise<Array<Deployment>> => {
			setProgress({ loaded: 0, total: null });
			const first = await listDeploymentsPage({ data: { accountId, projectName, page: 1 } });
			const pages: Array<Array<Deployment>> = [first.deployments];
			let loaded = first.deployments.length;
			setProgress({ loaded, total: first.totalCount });

			let next = 2;
			const worker = async () => {
				while (next <= first.totalPages) {
					const page = next++;
					const result = await listDeploymentsPage({ data: { accountId, projectName, page } });
					pages[page - 1] = result.deployments;
					loaded += result.deployments.length;
					setProgress({ loaded, total: first.totalCount });
				}
			};
			await Promise.all(Array.from({ length: PAGE_CONCURRENCY }, worker));

			// Pages can shift while loading; de-duplicate by ID and keep newest first.
			const byId = new Map<string, Deployment>();
			for (const deployment of pages.flat()) byId.set(deployment.id, deployment);
			return [...byId.values()].sort((a, b) => b.createdOn.localeCompare(a.createdOn));
		},
	});

	return { ...query, progress };
}
