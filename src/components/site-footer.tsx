import { Github } from "lucide-react";

import { cn } from "#/lib/utils";

const REPO_URL = "https://github.com/RMalik777/cf-pages-delete";

export function SiteFooter({ className }: { className?: string }) {
	return (
		<footer className={cn("border-t", className)}>
			<div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-start sm:justify-between sm:gap-8 sm:px-6">
				<p className="max-w-[68ch] text-pretty">
					Pages Cleaner is an open-source tool and is not affiliated with Cloudflare. There is no
					database. Your session and Cloudflare token stay in an encrypted cookie in your browser,
					and the server only forwards your requests to the Cloudflare API. It keeps nothing.
				</p>
				<div className="flex shrink-0 items-center gap-4">
					<a
						href={`${REPO_URL}/blob/HEAD/LICENSE`}
						target="_blank"
						rel="noreferrer"
						className="rounded-sm underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
					>
						MIT License
					</a>
					<a
						href={REPO_URL}
						target="_blank"
						rel="noreferrer"
						className="flex items-center gap-1.5 rounded-sm underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
					>
						<Github className="size-4" aria-hidden />
						Source on GitHub
					</a>
				</div>
			</div>
		</footer>
	);
}
