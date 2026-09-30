export function BusyIndicator({ label }: { label: string }) {
  return (
    <span
      role="status"
      className="inline-flex items-center gap-2 text-xs text-content/65"
    >
      <span
        aria-hidden="true"
        className="inline-block size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none"
      />
      {label}
    </span>
  );
}
