import { ExternalLinkIcon, LogOutIcon } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "#/components/ui/avatar";
import { Button } from "#/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { authClient } from "#/lib/auth-client";

interface UserMenuProps {
	user: { name: string; email: string; image: string | null };
}

function initials(name: string) {
	const parts = name.split(/[\s@.]+/).filter(Boolean);
	return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function UserMenu({ user }: UserMenuProps) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="icon" className="rounded-full" aria-label="Account menu">
					<Avatar className="size-8">
						{user.image && <AvatarImage src={user.image} alt="" />}
						<AvatarFallback className="text-xs">{initials(user.name)}</AvatarFallback>
					</Avatar>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-64">
				<DropdownMenuLabel className="flex flex-col gap-0.5">
					<span className="truncate">{user.name}</span>
					<span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem asChild>
						<a
							href="https://dash.cloudflare.com/?to=/profile/access-management/authorization"
							target="_blank"
							rel="noreferrer"
						>
							<ExternalLinkIcon />
							Manage Cloudflare access
						</a>
					</DropdownMenuItem>
					<DropdownMenuItem
						onSelect={async () => {
							await authClient.signOut();
							window.location.assign("/");
						}}
					>
						<LogOutIcon />
						Sign out
					</DropdownMenuItem>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
