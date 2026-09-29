import { useState } from "react";
import { CloudIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "#/components/ui/button";
import { Spinner } from "#/components/ui/spinner";
import { signInWithCloudflare } from "#/lib/auth-client";

export function SignInButton({ size = "lg" }: { size?: "default" | "lg" }) {
	const [pending, setPending] = useState(false);

	return (
		<Button
			size={size}
			disabled={pending}
			onClick={async () => {
				setPending(true);
				const { error } = await signInWithCloudflare();
				if (error) {
					setPending(false);
					toast.error(error.message ?? "Couldn't start Cloudflare sign in.");
				}
			}}
		>
			{pending ? <Spinner data-icon="inline-start" /> : <CloudIcon data-icon="inline-start" />}
			Continue with Cloudflare
		</Button>
	);
}
