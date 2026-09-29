import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "#/components/ui/button";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "#/components/ui/card";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "#/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "#/components/ui/field";
import { Input } from "#/components/ui/input";
import { Spinner } from "#/components/ui/spinner";
import { errorMessage } from "#/lib/errors";
import { plural } from "#/lib/format";
import { deleteProject } from "#/server/cloudflare.functions";

interface DeleteProjectCardProps {
	accountId: string;
	projectName: string;
	/** Deployments still in the project besides the live one. */
	remaining: number;
}

export function DeleteProjectCard({ accountId, projectName, remaining }: DeleteProjectCardProps) {
	const [open, setOpen] = useState(false);
	const [confirmation, setConfirmation] = useState("");
	const queryClient = useQueryClient();
	const navigate = useNavigate();

	const mutation = useMutation({
		mutationFn: () => deleteProject({ data: { accountId, projectName } }),
		onSuccess: async () => {
			toast.success(`Deleted ${projectName}`);
			setOpen(false);
			await queryClient.invalidateQueries({ queryKey: ["projects", accountId] });
			await navigate({ to: "/projects", search: { account: accountId } });
		},
		onError: (error) => toast.error(errorMessage(error)),
	});

	return (
		<Card className="border-destructive/30 shadow-none">
			<CardHeader>
				<CardTitle>Delete project</CardTitle>
				<CardDescription>
					{remaining > 0
						? `Permanently delete ${projectName} and its custom domains. Clear the remaining ${plural(remaining, "deployment")} first if Cloudflare refuses.`
						: `Permanently delete ${projectName}, its live deployment, and its custom domains.`}
				</CardDescription>
				<CardAction>
					<Dialog
						open={open}
						onOpenChange={(next) => {
							if (mutation.isPending) return;
							setOpen(next);
							if (!next) setConfirmation("");
						}}
					>
						<DialogTrigger asChild>
							<Button variant="destructive">Delete project</Button>
						</DialogTrigger>
						<DialogContent>
							<form
								className="flex flex-col gap-4"
								onSubmit={(event) => {
									event.preventDefault();
									if (confirmation === projectName) mutation.mutate();
								}}
							>
								<DialogHeader>
									<DialogTitle>Delete {projectName}?</DialogTitle>
									<DialogDescription>
										This removes the project, every remaining deployment, and its pages.dev address.
										It can&apos;t be undone.
									</DialogDescription>
								</DialogHeader>
								<FieldGroup>
									<Field>
										<FieldLabel htmlFor="confirm-project">
											Type <span className="font-mono">{projectName}</span> to confirm
										</FieldLabel>
										<Input
											id="confirm-project"
											value={confirmation}
											onChange={(event) => setConfirmation(event.target.value)}
											autoComplete="off"
											spellCheck={false}
										/>
									</Field>
								</FieldGroup>
								<DialogFooter>
									<DialogClose asChild>
										<Button type="button" variant="outline" disabled={mutation.isPending}>
											Cancel
										</Button>
									</DialogClose>
									<Button
										type="submit"
										variant="destructive"
										disabled={confirmation !== projectName || mutation.isPending}
									>
										{mutation.isPending && <Spinner data-icon="inline-start" />}
										Delete project
									</Button>
								</DialogFooter>
							</form>
						</DialogContent>
					</Dialog>
				</CardAction>
			</CardHeader>
		</Card>
	);
}
