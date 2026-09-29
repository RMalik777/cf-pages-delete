import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import { errorMessage } from "#/lib/errors";

export function LoadError({
	title,
	error,
	onRetry,
}: {
	title: string;
	error: unknown;
	onRetry?: () => void;
}) {
	return (
		<Alert variant="destructive">
			<AlertTitle>{title}</AlertTitle>
			<AlertDescription>
				<p>{errorMessage(error)}</p>
				{onRetry && (
					<Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
						Try again
					</Button>
				)}
			</AlertDescription>
		</Alert>
	);
}
