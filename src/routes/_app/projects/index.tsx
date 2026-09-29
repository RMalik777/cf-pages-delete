import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronRightIcon, FolderOpenIcon, SearchIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

import { LoadError } from "#/components/load-error";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "#/components/ui/empty";
import { Input } from "#/components/ui/input";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";
import { Skeleton } from "#/components/ui/skeleton";
import { formatRelative } from "#/lib/format";
import { accountsQuery, projectsQuery } from "#/lib/queries";

export const Route = createFileRoute("/_app/projects/")({
	validateSearch: z.object({ account: z.string().optional() }),
	loader: ({ context }) => context.queryClient.ensureQueryData(accountsQuery),
	pendingComponent: ProjectsSkeleton,
	errorComponent: ({ error }) => (
		<LoadError title="Couldn't load your Cloudflare accounts" error={error} />
	),
	component: ProjectsPage,
});

function ProjectsPage() {
	const { data: accounts } = useSuspenseQuery(accountsQuery);
	const search = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const accountId = accounts.some((a) => a.id === search.account)
		? search.account
		: accounts[0]?.id;
	useEffect(() => {
		console.log("account", accounts);
	}, []);

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
				<div className="flex flex-col gap-1">
					<h1 className="text-2xl font-semibold tracking-tight">Pages projects</h1>
					<p className="text-sm text-muted-foreground">Pick the project you want to clean up.</p>
				</div>
				{accounts.length > 1 && (
					<Select value={accountId} onValueChange={(account) => navigate({ search: { account } })}>
						<SelectTrigger className="w-full sm:w-64" aria-label="Cloudflare account">
							<SelectValue placeholder="Choose an account" />
						</SelectTrigger>
						<SelectContent position="popper" align="end">
							<SelectGroup>
								{accounts.map((account) => (
									<SelectItem key={account.id} value={account.id}>
										{account.name}
									</SelectItem>
								))}
							</SelectGroup>
						</SelectContent>
					</Select>
				)}
			</div>

			{accountId ? (
				<ProjectList accountId={accountId} />
			) : (
				<Empty className="border">
					<EmptyHeader>
						<EmptyTitle>No accounts shared</EmptyTitle>
						<EmptyDescription>
							Sign out, sign in again, and select at least one account on the Cloudflare consent
							screen.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			)}
		</div>
	);
}

function ProjectList({ accountId }: { accountId: string }) {
	const { data: projects, isPending, error, refetch } = useQuery(projectsQuery(accountId));
	const [filter, setFilter] = useState("");

	const visible = useMemo(() => {
		const needle = filter.trim().toLowerCase();
		const sorted = [...(projects ?? [])].sort((a, b) =>
			(b.latestDeployment?.createdOn ?? b.createdOn).localeCompare(
				a.latestDeployment?.createdOn ?? a.createdOn,
			),
		);
		return needle
			? sorted.filter((p) => p.name.includes(needle) || p.subdomain.includes(needle))
			: sorted;
	}, [projects, filter]);

	if (isPending) return <ProjectRowsSkeleton />;
	if (error)
		return <LoadError title="Couldn't load projects" error={error} onRetry={() => refetch()} />;

	if (projects.length === 0) {
		return (
			<Empty className="border">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<FolderOpenIcon />
					</EmptyMedia>
					<EmptyTitle>No Pages projects</EmptyTitle>
					<EmptyDescription>This account has no Cloudflare Pages projects.</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}

	return (
		<div className="flex flex-col gap-3">
			{projects.length > 5 && (
				<div className="relative">
					<SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						value={filter}
						onChange={(event) => setFilter(event.target.value)}
						placeholder="Filter projects"
						aria-label="Filter projects"
						className="pl-9"
					/>
				</div>
			)}
			<ul className="divide-y overflow-hidden rounded-xl border bg-card">
				{visible.map((project) => (
					<li key={project.name}>
						<Link
							to="/projects/$accountId/$projectName"
							params={{ accountId, projectName: project.name }}
							className="group flex items-center gap-4 px-4 py-3.5 outline-none hover:bg-muted/50 focus-visible:bg-muted/50"
						>
							<div className="flex min-w-0 flex-1 flex-col gap-0.5">
								<span className="truncate font-medium">{project.name}</span>
								<span className="truncate text-sm text-muted-foreground">{project.subdomain}</span>
							</div>
							<span className="hidden text-sm text-muted-foreground sm:block">
								{project.latestDeployment
									? `Deployed ${formatRelative(project.latestDeployment.createdOn)}`
									: "No deployments"}
							</span>
							<ChevronRightIcon className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
						</Link>
					</li>
				))}
				{visible.length === 0 && (
					<li className="px-4 py-8 text-center text-sm text-muted-foreground">
						No projects match &ldquo;{filter}&rdquo;.
					</li>
				)}
			</ul>
		</div>
	);
}

function ProjectRowsSkeleton() {
	return (
		<div className="divide-y rounded-xl border bg-card">
			{Array.from({ length: 4 }, (_, i) => (
				<div key={i} className="flex items-center gap-4 px-4 py-4">
					<div className="flex flex-1 flex-col gap-2">
						<Skeleton className="h-4 w-40" />
						<Skeleton className="h-3 w-56" />
					</div>
					<Skeleton className="hidden h-3 w-24 sm:block" />
				</div>
			))}
		</div>
	);
}

function ProjectsSkeleton() {
	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-col gap-2">
				<Skeleton className="h-7 w-48" />
				<Skeleton className="h-4 w-64" />
			</div>
			<ProjectRowsSkeleton />
		</div>
	);
}
