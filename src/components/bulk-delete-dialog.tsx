import { CircleCheckIcon, PauseIcon, PlayIcon, RotateCcwIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { Progress } from "#/components/ui/progress";
import { Spinner } from "#/components/ui/spinner";
import type { BulkDeleteState } from "#/hooks/use-bulk-delete";
import { handleExpiredSession } from "#/lib/auth-client";
import { formatDuration, formatNumber, plural } from "#/lib/format";

interface BulkDeleteDialogProps {
	projectName: string;
	state: BulkDeleteState;
	onPause: () => void;
	onResume: () => void;
	onCancel: () => void;
	onRetryFailed: () => void;
	onClose: () => void;
}

function statusLine(state: BulkDeleteState): string {
	switch (state.status) {
		case "running":
			return state.eta !== null && state.eta > 0
				? `About ${formatDuration(state.eta)} left`
				: "Deleting…";
		case "paused":
			return "Paused";
		case "waiting":
			return `Cloudflare rate limit reached. Resuming in ${state.waitSeconds}s`;
		case "done":
			return state.failed.length > 0
				? "Finished with some failures"
				: "All selected deployments deleted";
		case "cancelled":
			return "Stopped. Deployments already deleted stay deleted.";
		case "error":
			return "Stopped";
		default:
			return "";
	}
}

export function BulkDeleteDialog({
	projectName,
	state,
	onPause,
	onResume,
	onCancel,
	onRetryFailed,
	onClose,
}: BulkDeleteDialogProps) {
	const open = state.status !== "idle";
	const active =
		state.status === "running" || state.status === "paused" || state.status === "waiting";
	const processed = state.deleted + state.failed.length;
	const percent = state.total > 0 ? (processed / state.total) * 100 : 0;

	return (
		<Dialog open={open} onOpenChange={(next) => !next && !active && onClose()}>
			<DialogContent
				showCloseButton={!active}
				onEscapeKeyDown={(event) => active && event.preventDefault()}
				onInteractOutside={(event) => active && event.preventDefault()}
			>
				<DialogHeader>
					<DialogTitle>{active ? "Deleting deployments" : "Deletion finished"}</DialogTitle>
					<DialogDescription>
						{active ? `${projectName}. Keep this tab open while it runs.` : projectName}
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-3 py-2">
					<div className="flex items-baseline gap-2">
						<span className="font-mono text-5xl font-semibold tracking-tighter">
							{formatNumber(state.deleted)}
						</span>
						<span className="text-muted-foreground tabular-nums">
							of {formatNumber(state.total)} deleted
						</span>
					</div>
					<Progress value={percent} aria-label="Deletion progress" />
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						{state.status === "running" && <Spinner />}
						{state.status === "done" && state.failed.length === 0 && (
							<CircleCheckIcon className="size-4" />
						)}
						<span>{statusLine(state)}</span>
					</div>
				</div>

				{state.error && (
					<Alert variant="destructive">
						<AlertTitle>Deleting stopped</AlertTitle>
						<AlertDescription>{state.error}</AlertDescription>
					</Alert>
				)}

				{state.failed.length > 0 && (
					<Alert variant="destructive">
						<AlertTitle>
							{plural(state.failed.length, "deployment")} couldn&apos;t be deleted
						</AlertTitle>
						<AlertDescription>
							<ul className="flex max-h-32 w-full flex-col gap-1 overflow-y-auto">
								{state.failed.slice(0, 20).map((failure) => (
									<li key={failure.id} className="flex gap-2">
										<span className="shrink-0 font-mono text-xs leading-5">
											{failure.id.slice(0, 8)}
										</span>
										<span className="min-w-0 break-words">{failure.error}</span>
									</li>
								))}
							</ul>
						</AlertDescription>
					</Alert>
				)}

				<DialogFooter>
					{active ? (
						<>
							<Button variant="outline" onClick={onCancel}>
								Stop
							</Button>
							{state.status === "paused" ? (
								<Button onClick={onResume}>
									<PlayIcon data-icon="inline-start" />
									Resume
								</Button>
							) : (
								<Button variant="secondary" onClick={onPause} disabled={state.status === "waiting"}>
									<PauseIcon data-icon="inline-start" />
									Pause
								</Button>
							)}
						</>
					) : (
						<>
							{state.expired && (
								<Button variant="outline" onClick={() => void handleExpiredSession()}>
									Sign in again
								</Button>
							)}
							{state.failed.length > 0 && !state.expired && (
								<Button variant="outline" onClick={onRetryFailed}>
									<RotateCcwIcon data-icon="inline-start" />
									Retry {plural(state.failed.length, "failed deployment")}
								</Button>
							)}
							<Button onClick={onClose}>Done</Button>
						</>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
