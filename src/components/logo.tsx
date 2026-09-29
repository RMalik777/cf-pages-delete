import { cn } from "#/lib/utils";

/** Three stacked deployment rows, the bottom two struck out. */
export function Logo({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" fill="none" aria-hidden className={cn("size-6", className)}>
			<rect x="3" y="4" width="18" height="4" rx="1.25" fill="currentColor" />
			<rect x="3" y="10" width="18" height="4" rx="1.25" fill="currentColor" opacity="0.35" />
			<rect x="3" y="16" width="18" height="4" rx="1.25" fill="currentColor" opacity="0.15" />
			<path d="M2 12h20" stroke="var(--destructive)" strokeWidth="1.5" strokeLinecap="round" />
		</svg>
	);
}
