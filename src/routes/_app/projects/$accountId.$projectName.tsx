import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeftIcon, ExternalLinkIcon, RefreshCwIcon, Trash2Icon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { BulkDeleteDialog } from "#/components/bulk-delete-dialog";
import { DeleteProjectCard } from "#/components/delete-project-card";
import { DeploymentsTable } from "#/components/deployments-table";
import { LoadError } from "#/components/load-error";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "#/components/ui/alert-dialog";
import { Button } from "#/components/ui/button";
import { Field, FieldContent, FieldDescription, FieldLabel } from "#/components/ui/field";
import { Input } from "#/components/ui/input";
import { Progress } from "#/components/ui/progress";
import { Skeleton } from "#/components/ui/skeleton";
import { Switch } from "#/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "#/components/ui/toggle-group";
import { useAllDeployments } from "#/hooks/use-all-deployments";
import { useBulkDelete } from "#/hooks/use-bulk-delete";
import { formatNumber, plural } from "#/lib/format";
import { deploymentsKey, projectQuery } from "#/lib/queries";
import type { Deployment } from "#/server/cloudflare.functions";

export const Route = createFileRoute("/_app/projects/$accountId/$projectName")({
	loader: ({ context, params }) =>
		context.queryClient.ensureQueryData(projectQuery(params.accountId, params.projectName)),
	head: ({ params }) => ({ meta: [{ title: `${params.projectName} · Pages Cleaner` }] }),
	pendingComponent: () => (
		<div className="flex flex-col gap-4">
			<Skeleton className="h-4 w-20" />
			<Skeleton className="h-8 w-56" />
			<Skeleton className="h-64 w-full" />
		</div>
	),
	errorComponent: ({ error }) => <LoadError title="Couldn't load this project" error={error} />,
	component: ProjectPage,
});

type EnvFilter = "all" | "production" | "preview";

function ProjectPage() {
	const { accountId, projectName } = Route.useParams();
	const { data: project } = useSuspenseQuery(projectQuery(accountId, projectName));
	const queryClient = useQueryClient();
	const deploymentsQuery = useAllDeployments(accountId, projectName);
	const deployments = deploymentsQuery.data;
	const liveId = project.liveDeploymentId;

	const [envFilter, setEnvFilter] = useState<EnvFilter>("all");
	const [selected, setSelected] = useState<Set<string>>(() => new Set());
	const [keepNewest, setKeepNewest] = useState(5);
	const [force, setForce] = useState(true);
	const [confirmOpen, setConfirmOpen] = useState(false);

	const onDeleted = useCallback(
		(ids: Array<string>) => {
			const gone = new Set(ids);
			queryClient.setQueryData<Array<Deployment>>(deploymentsKey(accountId, projectName), (old) =>
				old?.filter((d) => !gone.has(d.id)),
			);
			setSelected((prev) => {
				const next = new Set(prev);
				for (const id of ids) next.delete(id);
				return next;
			});
		},
		[queryClient, accountId, projectName],
	);

	const bulk = useBulkDelete({ accountId, projectName, onDeleted });

	const counts = useMemo(() => {
		const all = deployments ?? [];
		return {
			total: all.length,
			production: all.filter((d) => d.environment === "production").length,
			preview: all.filter((d) => d.environment === "preview").length,
			deletable: all.filter((d) => d.id !== liveId).length,
		};
	}, [deployments, liveId]);

	const filtered = useMemo(
		() => (deployments ?? []).filter((d) => envFilter === "all" || d.environment === envFilter),
		[deployments, envFilter],
	);

	const toggle = useCallback((ids: Array<string>, checked: boolean) => {
		setSelected((prev) => {
			const next = new Set(prev);
			for (const id of ids) {
				if (checked) next.add(id);
				else next.delete(id);
			}
			return next;
		});
	}, []);

	const selectAllFiltered = () =>
		setSelected(new Set(filtered.filter((d) => d.id !== liveId).map((d) => d.id)));
	const selectAllButNewest = () =>
		setSelected(
			new Set(
				filtered
					.slice(Math.max(0, keepNewest))
					.filter((d) => d.id !== liveId)
					.map((d) => d.id),
			),
		);

	const startDelete = (ids: Array<string>) => {
		setConfirmOpen(false);
		void bulk.run(ids, force);
	};

	return (
		<div className="flex flex-col gap-8 pb-24">
			<div className="flex flex-col gap-3">
				<Link
					to="/projects"
					search={{ account: accountId }}
					className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
				>
					<ArrowLeftIcon className="size-4" />
					Projects
				</Link>
				<div className="flex flex-wrap items-start justify-between gap-4">
					<div className="flex min-w-0 flex-col gap-1">
						<h1 className="truncate text-2xl font-semibold tracking-tight">{project.name}</h1>
						<a
							href={`https://${project.subdomain}`}
							target="_blank"
							rel="noreferrer"
							className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
						>
							{project.subdomain}
							<ExternalLinkIcon className="size-3.5" />
						</a>
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={() => deploymentsQuery.refetch()}
						disabled={deploymentsQuery.isFetching || bulk.state.status === "running"}
					>
						<RefreshCwIcon
							data-icon="inline-start"
							className={deploymentsQuery.isFetching ? "animate-spin" : ""}
						/>
						Refresh
					</Button>
				</div>
			</div>

			{deploymentsQuery.isPending ? (
				<LoadingDeployments
					loaded={deploymentsQuery.progress.loaded}
					total={deploymentsQuery.progress.total}
				/>
			) : deploymentsQuery.error ? (
				<LoadError
					title="Couldn't load deployments"
					error={deploymentsQuery.error}
					onRetry={() => deploymentsQuery.refetch()}
				/>
			) : (
				<section className="flex flex-col gap-4" aria-label="Deployments">
					<dl className="grid grid-cols-3 divide-x rounded-xl border bg-card">
						{[
							["Deployments", counts.total],
							["Production", counts.production],
							["Preview", counts.preview],
						].map(([label, value]) => (
							<div key={label} className="flex flex-col gap-1 px-4 py-3 sm:px-5 sm:py-4">
								<dt className="text-sm text-muted-foreground">{label}</dt>
								<dd className="font-mono text-2xl font-semibold tracking-tighter">
									{formatNumber(value as number)}
								</dd>
							</div>
						))}
					</dl>

					<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
						<ToggleGroup
							type="single"
							variant="outline"
							size="sm"
							value={envFilter}
							onValueChange={(value) => value && setEnvFilter(value as EnvFilter)}
							aria-label="Filter by environment"
						>
							<ToggleGroupItem value="all">All</ToggleGroupItem>
							<ToggleGroupItem value="production">Production</ToggleGroupItem>
							<ToggleGroupItem value="preview">Preview</ToggleGroupItem>
						</ToggleGroup>

						<div className="flex flex-wrap items-center gap-2">
							<div className="flex items-center gap-2">
								<label
									htmlFor="keep-newest"
									className="text-sm whitespace-nowrap text-muted-foreground"
								>
									Keep newest
								</label>
								<Input
									id="keep-newest"
									type="number"
									min={0}
									inputMode="numeric"
									value={keepNewest}
									onChange={(event) => setKeepNewest(Math.max(0, Number(event.target.value) || 0))}
									className="h-8 w-16 font-mono"
								/>
								<Button variant="outline" size="sm" onClick={selectAllButNewest}>
									Select the rest
								</Button>
							</div>
							<Button variant="outline" size="sm" onClick={selectAllFiltered}>
								Select all
							</Button>
							{selected.size > 0 && (
								<Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
									Clear
								</Button>
							)}
						</div>
					</div>

					<DeploymentsTable
						deployments={filtered}
						liveDeploymentId={liveId}
						selected={selected}
						onToggle={toggle}
					/>

					<Field orientation="horizontal" className="rounded-xl border bg-card p-4">
						<FieldContent>
							<FieldLabel htmlFor="force">Include previews with branch aliases</FieldLabel>
							<FieldDescription>
								Preview deployments still serving a branch URL (like{" "}
								<span className="font-mono">main.{project.subdomain}</span>) need a forced delete.
								Turn off to skip them.
							</FieldDescription>
						</FieldContent>
						<Switch id="force" checked={force} onCheckedChange={setForce} />
					</Field>
				</section>
			)}

			<DeleteProjectCard
				accountId={accountId}
				projectName={projectName}
				remaining={counts.deletable}
			/>

			{selected.size > 0 && bulk.state.status === "idle" && (
				<div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/90 backdrop-blur">
					<div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
						<span className="text-sm">
							<span className="font-mono font-semibold">{formatNumber(selected.size)}</span>{" "}
							<span className="text-muted-foreground">selected</span>
						</span>
						<Button variant="destructive" onClick={() => setConfirmOpen(true)}>
							<Trash2Icon data-icon="inline-start" />
							Delete {plural(selected.size, "deployment")}
						</Button>
					</div>
				</div>
			)}

			<AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete {plural(selected.size, "deployment")}?</AlertDialogTitle>
						<AlertDialogDescription>
							They&apos;ll be permanently removed from {projectName}. The live production deployment
							is never deleted. This can&apos;t be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction variant="destructive" onClick={() => startDelete([...selected])}>
							Delete {plural(selected.size, "deployment")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<BulkDeleteDialog
				projectName={projectName}
				state={bulk.state}
				onPause={bulk.pause}
				onResume={bulk.resume}
				onCancel={bulk.cancel}
				onRetryFailed={() => {
					const ids = bulk.state.failed.map((f) => f.id);
					bulk.reset();
					void bulk.run(ids, force);
				}}
				onClose={bulk.reset}
			/>
		</div>
	);
}

function LoadingDeployments({ loaded, total }: { loaded: number; total: number | null }) {
	return (
		<div className="flex flex-col gap-3 rounded-xl border bg-card p-6">
			<div className="flex items-baseline justify-between gap-4">
				<span className="text-sm font-medium">Loading deployments</span>
				<span className="font-mono text-xs text-muted-foreground">
					{total === null ? "Counting…" : `${formatNumber(loaded)} of ${formatNumber(total)}`}
				</span>
			</div>
			<Progress value={total ? (loaded / total) * 100 : 0} aria-label="Loading deployments" />
		</div>
	);
}
