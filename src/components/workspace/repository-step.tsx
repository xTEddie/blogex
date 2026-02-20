import { type Repository } from "@/lib/workspace-client";
import { STRINGS } from "@/lib/strings";

type RepositoryStepProps = {
  repoSearchQuery: string;
  onRepoSearchChange: (value: string) => void;
  onRefresh: () => void;
  isLoadingRepositories: boolean;
  filteredRepositories: Repository[];
  selectedRepo: string;
  onSelectRepo: (fullName: string) => void;
  loadedRepositoryCount: number;
  onNext: () => void;
  isLoadingBranches: boolean;
};

export default function RepositoryStep({
  repoSearchQuery,
  onRepoSearchChange,
  onRefresh,
  isLoadingRepositories,
  filteredRepositories,
  selectedRepo,
  onSelectRepo,
  loadedRepositoryCount,
  onNext,
  isLoadingBranches,
}: RepositoryStepProps) {
  return (
    <div className="mt-6">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-300">
        {STRINGS.workspace.repositoryStep.heading}
      </p>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="text"
          value={repoSearchQuery}
          onChange={(event) => onRepoSearchChange(event.target.value)}
          placeholder={STRINGS.workspace.repositoryStep.searchPlaceholder}
          className="w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none ring-white/40 placeholder:text-zinc-500 focus:ring-2"
        />
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoadingRepositories}
          className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60 sm:shrink-0"
        >
          {isLoadingRepositories
            ? STRINGS.workspace.repositoryStep.refreshing
            : STRINGS.workspace.repositoryStep.refresh}
        </button>
      </div>
      <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-white/15 bg-zinc-900/70 p-2">
        {isLoadingRepositories ? (
          <p className="px-3 py-2 text-sm text-zinc-300">
            {STRINGS.workspace.repositoryStep.loadingRepositories}
          </p>
        ) : filteredRepositories.length === 0 ? (
          <p className="px-3 py-2 text-sm text-zinc-300">
            {STRINGS.workspace.repositoryStep.noRepositoriesMatchSearch}
          </p>
        ) : (
          filteredRepositories.map((repo) => {
            const isSelected = selectedRepo === repo.fullName;

            return (
              <button
                key={repo.id}
                type="button"
                onClick={() => onSelectRepo(repo.fullName)}
                className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ${
                  isSelected
                    ? "border-white/45 bg-white/15 text-white"
                    : "border-white/10 bg-zinc-900 text-zinc-200 hover:border-white/30 hover:bg-white/10"
                }`}
              >
                <span className="truncate pr-3">{repo.fullName}</span>
                <span className="shrink-0 rounded-full border border-white/15 px-2 py-0.5 text-[11px] uppercase tracking-wide text-zinc-300">
                  {repo.private
                    ? STRINGS.workspace.repositoryStep.visibilityPrivate
                    : STRINGS.workspace.repositoryStep.visibilityPublic}
                </span>
              </button>
            );
          })
        )}
      </div>
      <p className="mt-4 text-xs text-zinc-400">
        {STRINGS.workspace.repositoryStep.repositoriesLoaded(loadedRepositoryCount)}
      </p>
      <button
        type="button"
        onClick={onNext}
        disabled={isLoadingRepositories || !selectedRepo || isLoadingBranches}
        className="mt-6 w-full rounded-xl border border-white/15 bg-white/95 px-4 py-3 text-sm font-medium text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isLoadingBranches
          ? STRINGS.workspace.repositoryStep.loadingBranches
          : STRINGS.workspace.repositoryStep.next}
      </button>
    </div>
  );
}
