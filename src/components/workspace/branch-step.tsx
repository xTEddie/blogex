import { type Branch } from "@/lib/workspace-client";

type BranchStepProps = {
  selectedRepo: string;
  branchSearchQuery: string;
  onBranchSearchChange: (value: string) => void;
  isLoadingBranches: boolean;
  filteredBranches: Branch[];
  selectedBranch: string;
  onSelectBranch: (name: string) => void;
  onChangeRepo: () => void;
  onConnect: () => void;
  isLoadingPosts: boolean;
};

export default function BranchStep({
  selectedRepo,
  branchSearchQuery,
  onBranchSearchChange,
  isLoadingBranches,
  filteredBranches,
  selectedBranch,
  onSelectBranch,
  onChangeRepo,
  onConnect,
  isLoadingPosts,
}: BranchStepProps) {
  return (
    <div className="mt-6">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-300">Branch</p>
        <button
          type="button"
          onClick={onChangeRepo}
          className="rounded-md border border-white/15 bg-white/10 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-white/15"
        >
          Change repo
        </button>
      </div>
      <p className="mb-3 text-xs text-zinc-400">Selected: {selectedRepo}</p>
      <input
        type="text"
        value={branchSearchQuery}
        onChange={(event) => onBranchSearchChange(event.target.value)}
        placeholder="Search branches"
        className="mb-3 w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none ring-white/40 placeholder:text-zinc-500 focus:ring-2"
      />
      <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-white/15 bg-zinc-900/70 p-2">
        {isLoadingBranches ? (
          <p className="px-3 py-2 text-sm text-zinc-300">Loading branches...</p>
        ) : filteredBranches.length === 0 ? (
          <p className="px-3 py-2 text-sm text-zinc-300">No branches match your search</p>
        ) : (
          filteredBranches.map((branch) => {
            const isSelected = selectedBranch === branch.name;

            return (
              <button
                key={branch.name}
                type="button"
                onClick={() => onSelectBranch(branch.name)}
                className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ${
                  isSelected
                    ? "border-white/45 bg-white/15 text-white"
                    : "border-white/10 bg-zinc-900 text-zinc-200 hover:border-white/30 hover:bg-white/10"
                }`}
              >
                <span className="truncate pr-3">{branch.name}</span>
              </button>
            );
          })
        )}
      </div>
      <button
        type="button"
        onClick={onConnect}
        disabled={isLoadingBranches || !selectedBranch || isLoadingPosts}
        className="mt-6 w-full rounded-xl border border-white/15 bg-white/95 px-4 py-3 text-sm font-medium text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isLoadingPosts ? "Loading _posts..." : "Connect"}
      </button>
    </div>
  );
}
