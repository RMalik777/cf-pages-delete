import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import {
	APIError,
	AuthenticationError,
	NotFoundError,
	RateLimitError,
} from "cloudflare/core/error";
import type { BaseDeployments } from "cloudflare/resources/pages/projects/deployments/deployments";
import type {
	Deployment as ApiDeployment,
	Project as ApiProject,
} from "cloudflare/resources/pages/projects/projects";
import { z } from "zod";

import { auth } from "#/lib/auth";
import { apiErrorMessage, cloudflareClient, retryAfterSeconds } from "#/lib/cloudflare-api";
import { UNAUTHORIZED, errorMessage } from "#/lib/errors";
import { cloudflareAuthMiddleware } from "#/server/auth-middleware";

/** Largest page size the Pages deployments endpoint accepts. */
export const DEPLOYMENTS_PER_PAGE = 25;
/** Deployment IDs deleted per server function call. */
export const DELETE_BATCH_SIZE = 10;
const DELETE_CONCURRENCY = 3;

const accountId = z.string().regex(/^[a-f0-9]{32}$/, "Invalid account ID");
const projectName = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "Invalid project name");
const deploymentId = z.string().regex(/^[0-9a-f-]{36}$/i, "Invalid deployment ID");

export interface Account {
	id: string;
	name: string;
}

export interface PagesProject {
	name: string;
	subdomain: string;
	domains: Array<string>;
	productionBranch: string | null;
	createdOn: string;
	liveDeploymentId: string | null;
	latestDeployment: { id: string; createdOn: string; branch: string | null } | null;
}

export interface Deployment {
	id: string;
	shortId: string;
	environment: "production" | "preview";
	url: string;
	aliases: Array<string>;
	createdOn: string;
	branch: string | null;
	commitHash: string | null;
	commitMessage: string | null;
	status: string | null;
}

export interface DeleteResult {
	id: string;
	ok: boolean;
	error?: string;
	/** Not attempted or rejected by rate limiting; safe to retry later. */
	retry?: boolean;
}

function toDeployment(raw: ApiDeployment): Deployment {
	const meta = raw.deployment_trigger.metadata;
	return {
		id: raw.id,
		shortId: raw.short_id,
		environment: raw.environment,
		url: raw.url,
		aliases: raw.aliases ?? [],
		createdOn: raw.created_on,
		branch: meta.branch || null,
		commitHash: meta.commit_hash || null,
		commitMessage: meta.commit_message || null,
		status: raw.latest_stage.status,
	};
}

function toProject(raw: ApiProject): PagesProject {
	return {
		name: raw.name,
		subdomain: raw.subdomain ?? `${raw.name}.pages.dev`,
		domains: raw.domains ?? [],
		productionBranch: raw.production_branch || null,
		createdOn: raw.created_on,
		liveDeploymentId: raw.canonical_deployment?.id ?? null,
		latestDeployment: raw.latest_deployment
			? {
					id: raw.latest_deployment.id,
					createdOn: raw.latest_deployment.created_on,
					branch: raw.latest_deployment.deployment_trigger.metadata.branch || null,
				}
			: null,
	};
}

/**
 * Maps upstream auth failures to UNAUTHORIZED so the client can send the user
 * back to sign in, and replaces the SDK's raw JSON message with the API's own.
 */
function rethrow(error: unknown): never {
	if (error instanceof AuthenticationError) throw new Error(UNAUTHORIZED);
	if (error instanceof APIError) throw new Error(apiErrorMessage(error));
	throw error;
}

export const getSessionUser = createServerFn({ method: "GET" }).handler(async () => {
	const session = await auth.api.getSession({ headers: getRequestHeaders() });
	if (!session) return null;
	const { id, name, email, image } = session.user;
	return { id, name, email, image: image ?? null };
});

export const listAccounts = createServerFn({ method: "GET" })
	.middleware([cloudflareAuthMiddleware])
	.handler(async ({ context }) => {
		try {
			const accounts: Array<Account> = [];
			for await (const account of cloudflareClient(context.accessToken).accounts.list({
				per_page: 50,
			})) {
				accounts.push({ id: account.id, name: account.name });
			}
			return accounts;
		} catch (error) {
			rethrow(error);
		}
	});

export const listProjects = createServerFn({ method: "GET" })
	.middleware([cloudflareAuthMiddleware])
	.validator(z.object({ accountId }))
	.handler(async ({ context, data }) => {
		try {
			const projects: Array<PagesProject> = [];
			for await (const project of cloudflareClient(context.accessToken).pages.projects.list({
				account_id: data.accountId,
			})) {
				projects.push(toProject(project));
			}
			return projects;
		} catch (error) {
			rethrow(error);
		}
	});

export const getProject = createServerFn({ method: "GET" })
	.middleware([cloudflareAuthMiddleware])
	.validator(z.object({ accountId, projectName }))
	.handler(async ({ context, data }) => {
		try {
			const project = await cloudflareClient(context.accessToken).pages.projects.get(
				data.projectName,
				{ account_id: data.accountId },
			);
			return toProject(project);
		} catch (error) {
			rethrow(error);
		}
	});

export const listDeploymentsPage = createServerFn({ method: "GET" })
	.middleware([cloudflareAuthMiddleware])
	.validator(z.object({ accountId, projectName, page: z.number().int().min(1) }))
	.handler(async ({ context, data }) => {
		try {
			const page = await cloudflareClient(context.accessToken).pages.projects.deployments.list(
				data.projectName,
				{ account_id: data.accountId, page: data.page, per_page: DEPLOYMENTS_PER_PAGE },
			);
			// The API also returns totals, which the SDK's page type does not declare.
			const info = page.result_info as { total_count?: number; total_pages?: number };
			const totalCount = info.total_count ?? page.result.length;
			return {
				deployments: page.result.map(toDeployment),
				totalCount,
				totalPages: info.total_pages ?? Math.max(1, Math.ceil(totalCount / DEPLOYMENTS_PER_PAGE)),
			};
		} catch (error) {
			rethrow(error);
		}
	});

/** Deletes one deployment and classifies the outcome for the client's queue. */
async function deleteDeployment(
	deployments: BaseDeployments,
	id: string,
	params: { accountId: string; projectName: string; force: boolean },
): Promise<{ result: DeleteResult; retryAfter?: number }> {
	try {
		await deployments.delete(
			id,
			{
				account_id: params.accountId,
				project_name: params.projectName,
				force: params.force || undefined,
			},
			// The client queue paces deletes and honors Retry-After itself.
			{ maxRetries: 0 },
		);
		return { result: { id, ok: true } };
	} catch (error) {
		if (error instanceof AuthenticationError) throw new Error(UNAUTHORIZED);
		if (error instanceof RateLimitError) {
			return { result: { id, ok: false, retry: true }, retryAfter: retryAfterSeconds(error) };
		}
		// Already gone counts as deleted.
		if (error instanceof NotFoundError) return { result: { id, ok: true } };
		const message = error instanceof APIError ? apiErrorMessage(error) : errorMessage(error);
		return { result: { id, ok: false, error: message } };
	}
}

export const deleteDeployments = createServerFn({ method: "POST" })
	.middleware([cloudflareAuthMiddleware])
	.validator(
		z.object({
			accountId,
			projectName,
			ids: z.array(deploymentId).min(1).max(DELETE_BATCH_SIZE),
			force: z.boolean(),
		}),
	)
	.handler(async ({ context, data }) => {
		const deployments = cloudflareClient(context.accessToken).pages.projects.deployments;
		const results: Array<DeleteResult> = [];
		const queue = [...data.ids];
		let retryAfter: number | undefined;

		const worker = async () => {
			for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
				// Once rate limited, leave the rest for the client to retry later.
				if (retryAfter !== undefined) {
					results.push({ id, ok: false, retry: true });
					continue;
				}
				const outcome = await deleteDeployment(deployments, id, data);
				results.push(outcome.result);
				retryAfter ??= outcome.retryAfter;
			}
		};

		await Promise.all(
			Array.from({ length: Math.min(DELETE_CONCURRENCY, data.ids.length) }, worker),
		);
		return { results, retryAfter };
	});

export const deleteProject = createServerFn({ method: "POST" })
	.middleware([cloudflareAuthMiddleware])
	.validator(z.object({ accountId, projectName }))
	.handler(async ({ context, data }) => {
		try {
			await cloudflareClient(context.accessToken).pages.projects.delete(data.projectName, {
				account_id: data.accountId,
			});
			return { ok: true };
		} catch (error) {
			rethrow(error);
		}
	});
