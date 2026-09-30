import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Logo } from "#/components/logo";
import { Badge } from "#/components/ui/badge";
import { SignInButton } from "#/components/sign-in-button";
import { SiteFooter } from "#/components/site-footer";
import { getSessionUser } from "#/server/cloudflare.functions";

export const Route = createFileRoute("/")({
	beforeLoad: async () => {
		const user = await getSessionUser();
		if (user) throw redirect({ to: "/projects" });
	},
	component: Landing,
});

const DEMO_ROWS = [
	{ id: "a41f9c2e", branch: "main", message: "Bump dependencies", age: "2d" },
	{ id: "7be03d11", branch: "preview/nav", message: "Try new navigation", age: "5d" },
	{ id: "c9d25a70", branch: "fix-footer", message: "Fix footer links on mobile", age: "1w" },
	{ id: "0e6b4f93", branch: "main", message: "Add pricing page", age: "2w" },
	{ id: "58aa7c04", branch: "dependabot", message: "Bump vite from 5.1 to 5.2", age: "3w" },
];

const DEMO_TOTAL = 2147;

function Landing() {
	return (
		<div className="flex min-h-svh flex-col">
			<header className="mx-auto flex w-full max-w-5xl items-center gap-2 px-4 py-5 sm:px-6">
				<Logo className="size-5" />
				<span className="text-sm font-semibold tracking-tight">Pages Cleaner</span>
			</header>

			<main className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-12 px-4 pb-16 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
				<section className="flex max-w-xl flex-col gap-6">
					<h1 className="text-4xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-5xl">
						Delete thousands of Pages deployments at once.
					</h1>
					<p className="max-w-[52ch] text-lg text-pretty text-muted-foreground">
						Cloudflare won&apos;t delete a Pages project with too many deployments, and the
						dashboard removes them one by one. Sign in, pick the project, and clear them out in
						bulk.
					</p>
					<div className="flex flex-col items-start gap-3">
						<SignInButton />
						<p className="max-w-[56ch] text-sm text-muted-foreground">
							Asks for Pages read/write and your email only. Your Cloudflare token stays in an
							encrypted cookie. Nothing is stored on a server.
						</p>
					</div>

					<ol className="mt-4 grid gap-4 border-t pt-6 text-sm sm:grid-cols-3">
						{[
							["Sign in", "Authorize with your Cloudflare account."],
							["Pick a project", "Choose an account and a Pages project."],
							["Delete", "Select deployments and watch them go."],
						].map(([title, body], index) => (
							<li key={title} className="flex flex-col gap-1">
								<span className="font-mono text-xs text-muted-foreground">{index + 1}</span>
								<span className="font-medium">{title}</span>
								<span className="text-muted-foreground">{body}</span>
							</li>
						))}
					</ol>
				</section>

				<DemoPanel />
			</main>

			<SiteFooter />
		</div>
	);
}

/** A mock deployment list that clears itself once, showing what the tool does. */
function DemoPanel() {
	const [remaining, setRemaining] = useState(DEMO_TOTAL);

	useEffect(() => {
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
		const start = performance.now() + 500;
		const duration = 2200;
		let frame = 0;
		const tick = (now: number) => {
			const t = Math.min(1, Math.max(0, (now - start) / duration));
			const eased = 1 - Math.pow(1 - t, 3);
			// Everything goes except the live deployment.
			setRemaining(1 + Math.round((DEMO_TOTAL - 1) * (1 - eased)));
			if (t < 1) frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	}, []);

	return (
		<div aria-hidden className="relative hidden rounded-xl border bg-card p-5 shadow-sm sm:block">
			<div className="flex items-baseline justify-between border-b pb-4">
				<div className="flex flex-col">
					<span className="text-sm text-muted-foreground">my-marketing-site</span>
					<span className="font-mono text-3xl font-semibold tracking-tighter">
						{remaining.toLocaleString("en-US")}
					</span>
				</div>
				<span className="text-sm text-muted-foreground">
					{remaining === 1 ? "deployment left" : "deployments left"}
				</span>
			</div>
			<ul className="flex flex-col pt-2">
				<li className="flex items-center gap-3 py-2.5 text-sm">
					<span className="font-mono text-xs">3f1d8e62</span>
					<Badge variant="secondary">Live</Badge>
					<span className="truncate text-muted-foreground">Launch week landing page</span>
					<span className="ml-auto font-mono text-xs text-muted-foreground">1h</span>
				</li>
				{DEMO_ROWS.map((row, index) => (
					<li
						key={row.id}
						className="clear-row relative flex items-center gap-3 border-t py-2.5 text-sm"
						style={{ animationDelay: `${700 + index * 280}ms` }}
					>
						<span className="font-mono text-xs">{row.id}</span>
						<span className="text-xs text-muted-foreground">{row.branch}</span>
						<span className="truncate text-muted-foreground">{row.message}</span>
						<span className="ml-auto font-mono text-xs text-muted-foreground">{row.age}</span>
						<span className="strike pointer-events-none absolute inset-x-0 top-1/2 h-px bg-destructive" />
					</li>
				))}
			</ul>
		</div>
	);
}
