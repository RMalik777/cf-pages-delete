import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";

import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Checkbox } from "#/components/ui/checkbox";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "#/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "#/components/ui/tooltip";
import { formatDate, formatNumber, formatRelative } from "#/lib/format";
import type { Deployment } from "#/server/cloudflare.functions";

const PAGE_SIZE = 50;

interface DeploymentsTableProps {
	deployments: Array<Deployment>;
	liveDeploymentId: string | null;
	selected: ReadonlySet<string>;
	onToggle: (ids: Array<string>, checked: boolean) => void;
}

export function DeploymentsTable({
	deployments,
	liveDeploymentId,
	selected,
	onToggle,
}: DeploymentsTableProps) {
	const [page, setPage] = useState(0);
	const pageCount = Math.max(1, Math.ceil(deployments.length / PAGE_SIZE));
	const currentPage = Math.min(page, pageCount - 1);
	const rows = deployments.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

	const selectableOnPage = rows.filter((d) => d.id !== liveDeploymentId).map((d) => d.id);
	const selectedOnPage = selectableOnPage.filter((id) => selected.has(id)).length;
	const headerState =
		selectedOnPage === 0
			? false
			: selectedOnPage === selectableOnPage.length
				? true
				: ("indeterminate" as const);

	return (
		<div className="flex flex-col">
			<div className="overflow-hidden rounded-xl border bg-card">
				<Table>
					<TableHeader>
						<TableRow className="hover:bg-transparent">
							<TableHead className="w-10 pl-4">
								<Checkbox
									checked={headerState}
									disabled={selectableOnPage.length === 0}
									onCheckedChange={(checked) => onToggle(selectableOnPage, checked === true)}
									aria-label="Select deployments on this page"
								/>
							</TableHead>
							<TableHead>Deployment</TableHead>
							<TableHead className="hidden md:table-cell">Source</TableHead>
							<TableHead className="pr-4 text-right">Created</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows.map((deployment) => {
							const isLive = deployment.id === liveDeploymentId;
							const isSelected = selected.has(deployment.id);
							return (
								<TableRow key={deployment.id} data-state={isSelected ? "selected" : undefined}>
									<TableCell className="pl-4">
										{isLive ? (
											<Tooltip>
												<TooltipTrigger asChild>
													<span>
														<Checkbox disabled aria-label="Live deployment can't be deleted" />
													</span>
												</TooltipTrigger>
												<TooltipContent>
													The live production deployment can&apos;t be deleted. Deleting the project
													removes it.
												</TooltipContent>
											</Tooltip>
										) : (
											<Checkbox
												checked={isSelected}
												onCheckedChange={(checked) => onToggle([deployment.id], checked === true)}
												aria-label={`Select deployment ${deployment.shortId}`}
											/>
										)}
									</TableCell>
									<TableCell>
										<div className="flex items-center gap-2">
											<a
												href={deployment.url}
												target="_blank"
												rel="noreferrer"
												className="font-mono text-xs underline-offset-4 hover:underline"
											>
												{deployment.shortId}
											</a>
											{isLive ? (
												<Badge>Live</Badge>
											) : (
												<Badge
													variant={
														deployment.environment === "production" ? "secondary" : "outline"
													}
												>
													{deployment.environment === "production" ? "Production" : "Preview"}
												</Badge>
											)}
										</div>
									</TableCell>
									<TableCell className="hidden max-w-0 md:table-cell">
										<div className="flex min-w-0 flex-col">
											<span className="truncate" title={deployment.commitMessage ?? undefined}>
												{deployment.commitMessage ?? "Direct upload"}
											</span>
											<span className="truncate text-xs text-muted-foreground">
												{deployment.branch ?? "No branch"}
												{deployment.commitHash && (
													<span className="font-mono"> {deployment.commitHash.slice(0, 7)}</span>
												)}
											</span>
										</div>
									</TableCell>
									<TableCell className="pr-4 text-right text-muted-foreground">
										<time dateTime={deployment.createdOn} title={formatDate(deployment.createdOn)}>
											{formatRelative(deployment.createdOn)}
										</time>
									</TableCell>
								</TableRow>
							);
						})}
						{rows.length === 0 && (
							<TableRow className="hover:bg-transparent">
								<TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
									No deployments match this filter.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>

			{pageCount > 1 && (
				<div className="flex items-center justify-between gap-4 pt-3 text-sm text-muted-foreground">
					<span className="font-mono text-xs">
						{formatNumber(currentPage * PAGE_SIZE + 1)}–
						{formatNumber(Math.min((currentPage + 1) * PAGE_SIZE, deployments.length))} of{" "}
						{formatNumber(deployments.length)}
					</span>
					<div className="flex items-center gap-1">
						<Button
							variant="outline"
							size="icon-sm"
							disabled={currentPage === 0}
							onClick={() => setPage(currentPage - 1)}
							aria-label="Previous page"
						>
							<ChevronLeftIcon />
						</Button>
						<Button
							variant="outline"
							size="icon-sm"
							disabled={currentPage >= pageCount - 1}
							onClick={() => setPage(currentPage + 1)}
							aria-label="Next page"
						>
							<ChevronRightIcon />
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}
