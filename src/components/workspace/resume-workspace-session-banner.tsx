type ResumeWorkspaceSessionBannerProps = {
  isResuming: boolean;
  onResume: () => void;
  onStartFresh: () => void;
};

export default function ResumeWorkspaceSessionBanner({
  isResuming,
  onResume,
  onStartFresh,
}: ResumeWorkspaceSessionBannerProps) {
  return (
    <div className="mt-4 rounded-xl border border-white/15 bg-white/10 p-4">
      <p className="text-sm text-zinc-100">
        Existing workspace session found. Do you want to resume?
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onResume}
          disabled={isResuming}
          className="rounded-lg border border-white/15 bg-white/95 px-3 py-1.5 text-xs font-medium text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isResuming ? "Resuming..." : "Resume"}
        </button>
        <button
          type="button"
          onClick={onStartFresh}
          disabled={isResuming}
          className="rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-zinc-100 transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Start fresh
        </button>
      </div>
    </div>
  );
}
