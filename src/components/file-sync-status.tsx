export type FileSyncStatusValue =
  | "unavailable"
  | "checking"
  | "exists"
  | "missing"
  | "error";

type FileSyncStatusProps = {
  status: FileSyncStatusValue;
};

export default function FileSyncStatus({ status }: FileSyncStatusProps) {
  if (status === "checking") {
    return (
      <span
        title="Checking target status"
        aria-label="Checking target status"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/20 text-zinc-300"
      >
        <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-zinc-300 border-t-transparent" />
      </span>
    );
  }

  if (status === "exists") {
    return (
      <span
        title="Exists in target repo"
        aria-label="Exists in target repo"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-emerald-300/60 bg-emerald-400/20 text-emerald-200"
      >
        <svg viewBox="0 0 16 16" className="h-3 w-3 fill-current" aria-hidden="true">
          <path d="M6.4 11.2 3.2 8l1.1-1.1 2.1 2.1 5.3-5.3L12.8 4z" />
        </svg>
      </span>
    );
  }

  if (status === "missing") {
    return (
      <span
        title="Not found in target repo"
        aria-label="Not found in target repo"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-blue-300/60 bg-blue-400/15 text-blue-200"
      >
        <svg viewBox="0 0 16 16" className="h-3 w-3 fill-current" aria-hidden="true">
          <path d="M7 3h2v4h4v2H9v4H7V9H3V7h4z" />
        </svg>
      </span>
    );
  }

  if (status === "error") {
    return (
      <span
        title="Failed to check target status"
        aria-label="Failed to check target status"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-rose-300/60 bg-rose-400/15 text-rose-200"
      >
        <svg viewBox="0 0 16 16" className="h-3 w-3 fill-current" aria-hidden="true">
          <path d="M8 1 1 14h14L8 1zm1 10H7V6h2v5zm0 3H7v-2h2v2z" />
        </svg>
      </span>
    );
  }

  return (
    <span
      title="Target status unavailable"
      aria-label="Target status unavailable"
      className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/20 bg-white/5 text-zinc-400"
    >
      <svg viewBox="0 0 16 16" className="h-3 w-3 fill-current" aria-hidden="true">
        <circle cx="8" cy="8" r="3" />
      </svg>
    </span>
  );
}

