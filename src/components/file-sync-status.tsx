import { CheckIcon, DotIcon, PlusIcon, WarningIcon } from "@/components/icons";
import { STRINGS } from "@/lib/strings";

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
        title={STRINGS.fileSyncStatus.checking}
        aria-label={STRINGS.fileSyncStatus.checking}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/20 text-zinc-300"
      >
        <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-zinc-300 border-t-transparent" />
      </span>
    );
  }

  if (status === "exists") {
    return (
      <span
        title={STRINGS.fileSyncStatus.exists}
        aria-label={STRINGS.fileSyncStatus.exists}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-emerald-300/60 bg-emerald-400/20 text-emerald-200"
      >
        <CheckIcon className="h-3 w-3 fill-current" />
      </span>
    );
  }

  if (status === "missing") {
    return (
      <span
        title={STRINGS.fileSyncStatus.missing}
        aria-label={STRINGS.fileSyncStatus.missing}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-blue-300/60 bg-blue-400/15 text-blue-200"
      >
        <PlusIcon className="h-3 w-3 fill-current" />
      </span>
    );
  }

  if (status === "error") {
    return (
      <span
        title={STRINGS.fileSyncStatus.error}
        aria-label={STRINGS.fileSyncStatus.error}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-rose-300/60 bg-rose-400/15 text-rose-200"
      >
        <WarningIcon className="h-3 w-3 fill-current" />
      </span>
    );
  }

  return (
    <span
      title={STRINGS.fileSyncStatus.unavailable}
      aria-label={STRINGS.fileSyncStatus.unavailable}
      className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/20 bg-white/5 text-zinc-400"
    >
      <DotIcon className="h-3 w-3 fill-current" />
    </span>
  );
}
