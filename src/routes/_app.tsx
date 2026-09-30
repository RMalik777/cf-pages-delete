import { Link, Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { Logo } from "#/components/logo";
import { SiteFooter } from "#/components/site-footer";
import { UserMenu } from "#/components/user-menu";
import { getSessionUser } from "#/server/cloudflare.functions";

export const Route = createFileRoute("/_app")({
	beforeLoad: async () => {
		const user = await getSessionUser();
		if (!user) throw redirect({ to: "/" });
		return { user };
	},
	component: AppLayout,
});

function AppLayout() {
	const { user } = Route.useRouteContext();

	return (
		<div className="flex min-h-svh flex-col">
			<header className="sticky top-0 z-10 border-b bg-background/85 backdrop-blur">
				<div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-2 px-4 sm:px-6">
					<Link
						to="/projects"
						className="flex items-center gap-2 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
					>
						<Logo className="size-5" />
						<span className="text-sm font-semibold tracking-tight">Pages Cleaner</span>
					</Link>
					<div className="ml-auto">
						<UserMenu user={user} />
					</div>
				</div>
			</header>
			<main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-8 sm:px-6">
				<Outlet />
			</main>
			<SiteFooter />
		</div>
	);
}
