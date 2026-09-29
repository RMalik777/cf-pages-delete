import { queryOptions } from "@tanstack/react-query";

import { getProject, listAccounts, listProjects } from "#/server/cloudflare.functions";

export const accountsQuery = queryOptions({
	queryKey: ["accounts"],
	queryFn: () => listAccounts(),
	staleTime: 5 * 60_000,
});

export const projectsQuery = (accountId: string) =>
	queryOptions({
		queryKey: ["projects", accountId],
		queryFn: () => listProjects({ data: { accountId } }),
	});

export const projectQuery = (accountId: string, projectName: string) =>
	queryOptions({
		queryKey: ["project", accountId, projectName],
		queryFn: () => getProject({ data: { accountId, projectName } }),
	});

export const deploymentsKey = (accountId: string, projectName: string) =>
	["deployments", accountId, projectName] as const;
