import { useCallback, useEffect, useRef, useState } from "react";

import { isUnauthorized } from "#/lib/errors";
import { DELETE_BATCH_SIZE, deleteDeployments } from "#/server/cloudflare.functions";

/**
 * Cloudflare allows about 1200 API requests per 5 minutes per user.
 * 3.5 deletes per second stays under that with room for page loads.
 */
const DELETES_PER_SECOND = 3.5;
const MAX_NETWORK_RETRIES = 4;

export type BulkDeleteStatus =
	"idle" | "running" | "paused" | "waiting" | "done" | "cancelled" | "error";

export interface BulkDeleteState {
	status: BulkDeleteStatus;
	total: number;
	deleted: number;
	failed: Array<{ id: string; error: string }>;
	/** Seconds until work resumes after a rate limit. */
	waitSeconds: number;
	/** Estimated seconds remaining. */
	eta: number | null;
	error: string | null;
	/** The Cloudflare session expired mid-run; the user must sign in again. */
	expired: boolean;
}

const initialState: BulkDeleteState = {
	status: "idle",
	total: 0,
	deleted: 0,
	failed: [],
	waitSeconds: 0,
	eta: null,
	error: null,
	expired: false,
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface Options {
	accountId: string;
	projectName: string;
	/** Called with IDs as soon as Cloudflare confirms they are gone. */
	onDeleted: (ids: Array<string>) => void;
}

/**
 * Deletes deployments in small batches from the browser, paced to respect
 * Cloudflare's rate limits, with pause, resume, cancel, and retry of failures.
 */
export function useBulkDelete({ accountId, projectName, onDeleted }: Options) {
	const [state, setState] = useState<BulkDeleteState>(initialState);
	const control = useRef({ paused: false, cancelled: false, running: false });
	const onDeletedRef = useRef(onDeleted);

	useEffect(() => {
		onDeletedRef.current = onDeleted;
	}, [onDeleted]);

	// Stop the loop if the page unmounts mid-run.
	useEffect(() => {
		const current = control.current;
		return () => {
			current.cancelled = true;
		};
	}, []);

	const run = useCallback(
		async (ids: Array<string>, force: boolean) => {
			if (control.current.running || ids.length === 0) return;
			control.current = { paused: false, cancelled: false, running: true };

			const queue = [...ids];
			const failed: BulkDeleteState["failed"] = [];
			let deleted = 0;
			let networkRetries = 0;
			const startedAt = Date.now();
			// Read through functions: pause/cancel flip these from outside the loop.
			const isCancelled = () => control.current.cancelled;
			const isPaused = () => control.current.paused;

			const update = (patch: Partial<BulkDeleteState>) => setState((s) => ({ ...s, ...patch }));
			const eta = () => {
				const elapsed = (Date.now() - startedAt) / 1000;
				const measured = deleted > 0 && elapsed > 0 ? deleted / elapsed : DELETES_PER_SECOND;
				return queue.length / Math.min(measured, DELETES_PER_SECOND);
			};

			setState({ ...initialState, status: "running", total: ids.length, eta: eta() });

			while (queue.length > 0) {
				if (isCancelled()) {
					update({ status: "cancelled", eta: null });
					control.current.running = false;
					return;
				}
				if (isPaused()) {
					update({ status: "paused" });
					await sleep(250);
					continue;
				}
				update({ status: "running" });

				const batch = queue.splice(0, DELETE_BATCH_SIZE);
				const batchStartedAt = Date.now();

				try {
					const { results, retryAfter } = await deleteDeployments({
						data: { accountId, projectName, ids: batch, force },
					});
					networkRetries = 0;

					const gone: Array<string> = [];
					const retry: Array<string> = [];
					for (const result of results) {
						if (result.ok) gone.push(result.id);
						else if (result.retry) retry.push(result.id);
						else failed.push({ id: result.id, error: result.error ?? "Unknown error" });
					}
					deleted += gone.length;
					queue.unshift(...retry);
					if (gone.length > 0) onDeletedRef.current(gone);
					update({ deleted, failed: [...failed], eta: eta() });

					if (retryAfter !== undefined) {
						for (let left = retryAfter; left > 0 && !isCancelled(); left--) {
							update({ status: "waiting", waitSeconds: left });
							await sleep(1000);
						}
						update({ waitSeconds: 0 });
						continue;
					}
				} catch (error) {
					if (isUnauthorized(error)) {
						update({
							status: "error",
							error:
								"Your Cloudflare session expired. Sign in again, then select the remaining deployments.",
							expired: true,
							eta: null,
						});
						control.current.running = false;
						return;
					}
					// Network or server hiccup: put the batch back and back off.
					queue.unshift(...batch);
					networkRetries++;
					if (networkRetries > MAX_NETWORK_RETRIES) {
						update({
							status: "error",
							error:
								error instanceof Error ? error.message : "Deleting stopped after repeated errors.",
							eta: null,
						});
						control.current.running = false;
						return;
					}
					await sleep(1000 * 2 ** networkRetries);
					continue;
				}

				// Pace requests to stay under the API rate limit.
				const minDuration = (batch.length / DELETES_PER_SECOND) * 1000;
				await sleep(Math.max(0, minDuration - (Date.now() - batchStartedAt)));
			}

			update({ status: "done", eta: 0 });
			control.current.running = false;
		},
		[accountId, projectName],
	);

	const pause = useCallback(() => {
		control.current.paused = true;
	}, []);

	const resume = useCallback(() => {
		control.current.paused = false;
	}, []);

	const cancel = useCallback(() => {
		control.current.cancelled = true;
		control.current.paused = false;
	}, []);

	const reset = useCallback(() => {
		if (!control.current.running) setState(initialState);
	}, []);

	return { state, run, pause, resume, cancel, reset };
}
