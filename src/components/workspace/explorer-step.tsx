import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import FileSyncStatus, { type FileSyncStatusValue } from "@/components/file-sync-status";
import { CompareIcon, RenameIcon, SaveIcon } from "@/components/icons";
import { STRINGS } from "@/lib/strings";
import { type PostFile, type SyncCompareStatus } from "@/lib/workspace-client";

type ExplorerStepProps = {
  selectedRepo: string;
  selectedBranch: string;
  onChangeBranch: () => void;
  newMarkdownTitle: string;
  onNewMarkdownTitleChange: (value: string) => void;
  onCreateMarkdown: () => void;
  isCreatingMarkdown: boolean;
  postSearchQuery: string;
  onPostSearchChange: (value: string) => void;
  isLoadingPosts: boolean;
  filteredPostFiles: PostFile[];
  selectedPostPath: string;
  onOpenFile: (file: PostFile) => void;
  selectedPostName: string;
  renameFileName: string;
  onRenameFileNameChange: (value: string) => void;
  isRenameEditorOpen: boolean;
  onOpenRenameEditor: () => void;
  onCloseRenameEditor: () => void;
  onRenameMarkdown: () => void;
  isRenameSaveDisabled: boolean;
  isRenamingMarkdown: boolean;
  onCompareMarkdown: () => void;
  isComparingMarkdown: boolean;
  isComparePanelOpen: boolean;
  onCloseComparePanel: () => void;
  compareStatus: SyncCompareStatus | "idle" | "error";
  compareDiff: string;
  compareMessage: string | null;
  targetStatus: FileSyncStatusValue;
  editorView: "edit" | "preview";
  onEditorViewChange: (view: "edit" | "preview") => void;
  onSaveMarkdown: () => void;
  isLoadingMarkdown: boolean;
  isSavingMarkdown: boolean;
  markdownContent: string;
  editorContent: string;
  onEditorContentChange: (value: string) => void;
  frontmatterEntries: Array<[string, unknown]>;
  parsedEditorBody: string;
};

export default function ExplorerStep({
  selectedRepo,
  selectedBranch,
  onChangeBranch,
  newMarkdownTitle,
  onNewMarkdownTitleChange,
  onCreateMarkdown,
  isCreatingMarkdown,
  postSearchQuery,
  onPostSearchChange,
  isLoadingPosts,
  filteredPostFiles,
  selectedPostPath,
  onOpenFile,
  selectedPostName,
  renameFileName,
  onRenameFileNameChange,
  isRenameEditorOpen,
  onOpenRenameEditor,
  onCloseRenameEditor,
  onRenameMarkdown,
  isRenameSaveDisabled,
  isRenamingMarkdown,
  onCompareMarkdown,
  isComparingMarkdown,
  isComparePanelOpen,
  onCloseComparePanel,
  compareStatus,
  compareDiff,
  compareMessage,
  targetStatus,
  editorView,
  onEditorViewChange,
  onSaveMarkdown,
  isLoadingMarkdown,
  isSavingMarkdown,
  markdownContent,
  editorContent,
  onEditorContentChange,
  frontmatterEntries,
  parsedEditorBody,
}: ExplorerStepProps) {
  return (
    <div className="mt-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onChangeBranch}
          className="rounded-md border border-white/15 bg-white/10 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-white/15"
        >
          {STRINGS.workspace.explorerStep.changeBranch}
        </button>
        <p className="text-xs text-zinc-400">
          {STRINGS.workspace.explorerStep.repoAndBranch(selectedRepo, selectedBranch)}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-[300px_1fr]">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-300">
            {STRINGS.workspace.explorerStep.postsHeading}
          </p>
          <div className="mb-3 flex gap-2">
            <input
              type="text"
              value={newMarkdownTitle}
              onChange={(event) => onNewMarkdownTitleChange(event.target.value)}
              placeholder={STRINGS.workspace.explorerStep.newPostPlaceholder}
              className="w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none ring-white/40 placeholder:text-zinc-500 focus:ring-2"
            />
            <button
              type="button"
              onClick={onCreateMarkdown}
              disabled={isCreatingMarkdown || !newMarkdownTitle.trim()}
              className="shrink-0 rounded-xl border border-white/15 bg-white/95 px-3 py-2.5 text-xs font-medium text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCreatingMarkdown
                ? STRINGS.workspace.explorerStep.creating
                : STRINGS.workspace.explorerStep.create}
            </button>
          </div>
          <input
            type="text"
            value={postSearchQuery}
            onChange={(event) => onPostSearchChange(event.target.value)}
            placeholder={STRINGS.workspace.explorerStep.searchPostsPlaceholder}
            className="mb-3 w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none ring-white/40 placeholder:text-zinc-500 focus:ring-2"
          />
          <div className="max-h-[420px] space-y-2 overflow-y-auto rounded-xl border border-white/15 bg-zinc-900/70 p-2">
            {isLoadingPosts ? (
              <p className="px-3 py-2 text-sm text-zinc-300">
                {STRINGS.workspace.explorerStep.loadingPosts}
              </p>
            ) : filteredPostFiles.length === 0 ? (
              <p className="px-3 py-2 text-sm text-zinc-300">
                {STRINGS.workspace.explorerStep.noPostsFound}
              </p>
            ) : (
              filteredPostFiles.map((file) => {
                const isSelected = selectedPostPath === file.path;

                return (
                  <button
                    key={file.path}
                    type="button"
                    onClick={() => onOpenFile(file)}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ${
                      isSelected
                        ? "border-white/45 bg-white/15 text-white"
                        : "border-white/10 bg-zinc-900 text-zinc-200 hover:border-white/30 hover:bg-white/10"
                    }`}
                  >
                    <span className="truncate pr-3">{file.name}</span>
                    <span className="shrink-0 text-[11px] text-zinc-400">
                      {(file.size / 1024).toFixed(1)} KB
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="min-h-[300px] min-w-0 rounded-xl border border-white/15 bg-zinc-900/60">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <p className="text-sm text-zinc-200">
                {selectedPostName || STRINGS.workspace.explorerStep.defaultEditorName}
              </p>
              {selectedPostPath ? <FileSyncStatus status={targetStatus} /> : null}
              <button
                type="button"
                onClick={isRenameEditorOpen ? onCloseRenameEditor : onOpenRenameEditor}
                disabled={!selectedPostPath || isRenamingMarkdown}
                title={
                  isRenameEditorOpen
                    ? STRINGS.workspace.explorerStep.closeRename
                    : STRINGS.workspace.explorerStep.renameFilename
                }
                aria-label={
                  isRenameEditorOpen
                    ? STRINGS.workspace.explorerStep.closeRename
                    : STRINGS.workspace.explorerStep.renameFilename
                }
                className="shrink-0 rounded-md border border-white/15 bg-white/10 px-1.5 py-1 text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RenameIcon className="h-3.5 w-3.5 fill-current" />
              </button>
              <button
                type="button"
                onClick={onCompareMarkdown}
                disabled={!selectedPostPath || isComparingMarkdown}
                title={
                  isComparingMarkdown
                    ? STRINGS.workspace.explorerStep.comparing
                    : STRINGS.workspace.explorerStep.compareWithTarget
                }
                aria-label={
                  isComparingMarkdown
                    ? STRINGS.workspace.explorerStep.comparing
                    : STRINGS.workspace.explorerStep.compareWithTarget
                }
                className="shrink-0 rounded-md border border-white/15 bg-white/10 px-1.5 py-1 text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isComparingMarkdown ? (
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-300 border-t-transparent" />
                ) : (
                  <CompareIcon className="h-3.5 w-3.5 fill-current" />
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={onSaveMarkdown}
              disabled={
                !selectedPostPath ||
                isLoadingMarkdown ||
                isSavingMarkdown ||
                editorContent === markdownContent
              }
              title={
                isSavingMarkdown
                  ? STRINGS.workspace.explorerStep.savingMarkdown
                  : STRINGS.workspace.explorerStep.saveMarkdown
              }
              aria-label={
                isSavingMarkdown
                  ? STRINGS.workspace.explorerStep.savingMarkdown
                  : STRINGS.workspace.explorerStep.saveMarkdown
              }
              className="shrink-0 rounded-lg border border-white/15 bg-white/95 px-2.5 py-1.5 text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSavingMarkdown ? (
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-zinc-700 border-t-transparent" />
              ) : (
                <SaveIcon className="h-3.5 w-3.5 fill-current" />
              )}
            </button>
          </div>

          <div className="border-b border-white/10 px-4 py-2.5">
            <div className="flex items-center justify-between gap-2 overflow-x-auto">
              <div className="rounded-lg border border-white/15 bg-white/10 p-1 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => onEditorViewChange("edit")}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                    editorView === "edit"
                      ? "bg-white text-zinc-900"
                      : "text-zinc-200 hover:bg-white/15"
                  }`}
                >
                  {STRINGS.workspace.explorerStep.edit}
                </button>
                <button
                  type="button"
                  onClick={() => onEditorViewChange("preview")}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                    editorView === "preview"
                      ? "bg-white text-zinc-900"
                      : "text-zinc-200 hover:bg-white/15"
                  }`}
                >
                  {STRINGS.workspace.explorerStep.preview}
                </button>
              </div>
              <span className="shrink-0 text-[11px] text-zinc-500">
                {STRINGS.workspace.explorerStep.editorMode}
              </span>
            </div>
          </div>
          {isRenameEditorOpen ? (
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
              <input
                type="text"
                value={renameFileName}
                onChange={(event) => onRenameFileNameChange(event.target.value)}
                placeholder={STRINGS.workspace.explorerStep.renamePlaceholder}
                disabled={!selectedPostPath || isRenamingMarkdown}
                className="w-full rounded-lg border border-white/15 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-100 outline-none ring-white/40 placeholder:text-zinc-500 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
              />
              <button
                type="button"
                onClick={onRenameMarkdown}
                disabled={isRenameSaveDisabled}
                title={
                  isRenamingMarkdown
                    ? STRINGS.workspace.explorerStep.renaming
                    : STRINGS.workspace.explorerStep.saveFilename
                }
                aria-label={
                  isRenamingMarkdown
                    ? STRINGS.workspace.explorerStep.renaming
                    : STRINGS.workspace.explorerStep.saveFilename
                }
                className="shrink-0 rounded-lg border border-white/15 bg-white/95 px-2.5 py-1.5 text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRenamingMarkdown ? (
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-zinc-700 border-t-transparent" />
                ) : (
                  <SaveIcon className="h-3.5 w-3.5 fill-current" />
                )}
              </button>
              <button
                type="button"
                onClick={onCloseRenameEditor}
                disabled={isRenamingMarkdown}
                className="rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {STRINGS.workspace.explorerStep.cancel}
              </button>
            </div>
          ) : null}
          {isComparePanelOpen ? (
            <div className="border-b border-white/10 px-4 py-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span
                  className={`rounded-md border px-2 py-0.5 text-[11px] uppercase tracking-wide ${
                    compareStatus === "same"
                      ? "border-emerald-300/50 bg-emerald-400/20 text-emerald-200"
                      : compareStatus === "different"
                        ? "border-amber-300/50 bg-amber-400/20 text-amber-200"
                        : compareStatus === "missing_target" ||
                            compareStatus === "missing_source"
                          ? "border-zinc-300/30 bg-zinc-500/20 text-zinc-200"
                          : compareStatus === "error"
                            ? "border-rose-300/50 bg-rose-400/20 text-rose-200"
                            : "border-white/20 bg-white/10 text-zinc-200"
                  }`}
                >
                  {compareStatus === "same"
                    ? STRINGS.workspace.explorerStep.compareSame
                    : compareStatus === "different"
                      ? STRINGS.workspace.explorerStep.compareDifferent
                      : compareStatus === "missing_target"
                        ? STRINGS.workspace.explorerStep.compareMissingTarget
                        : compareStatus === "missing_source"
                          ? STRINGS.workspace.explorerStep.compareMissingSource
                          : compareStatus === "error"
                            ? STRINGS.workspace.explorerStep.compareError
                            : STRINGS.workspace.explorerStep.compareNotCompared}
                </span>
                <button
                  type="button"
                  onClick={onCloseComparePanel}
                  className="rounded-md border border-white/15 bg-white/10 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-white/15"
                >
                  {STRINGS.workspace.explorerStep.hide}
                </button>
              </div>

              {compareMessage ? (
                <p className="mb-2 text-xs text-zinc-300">{compareMessage}</p>
              ) : null}

              {compareDiff ? (
                <div className="max-h-44 overflow-auto rounded-lg border border-white/15 bg-zinc-950/80 p-2 font-mono text-xs">
                  {compareDiff.split("\n").map((line, index) => {
                    const lineClass = line.startsWith("+")
                      ? "bg-emerald-500/10 text-emerald-200"
                      : line.startsWith("-")
                        ? "bg-rose-500/10 text-rose-200"
                        : line.startsWith("@@")
                          ? "bg-amber-500/10 text-amber-200"
                          : "text-zinc-300";

                    return (
                      <p key={`${line}-${index}`} className={`whitespace-pre-wrap px-1 ${lineClass}`}>
                        {line || " "}
                      </p>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="max-h-[420px] min-w-0 overflow-auto px-4 py-3">
            {isLoadingMarkdown ? (
              <p className="text-sm text-zinc-300">Loading file content...</p>
            ) : selectedPostPath && editorView === "edit" ? (
              <textarea
                value={editorContent}
                onChange={(event) => onEditorContentChange(event.target.value)}
                className="min-h-[340px] w-full resize-y rounded-lg border border-white/15 bg-zinc-950 px-3 py-2.5 font-mono text-sm leading-6 text-zinc-100 outline-none ring-white/40 focus:ring-2"
              />
            ) : selectedPostPath && editorView === "preview" ? (
              <div className="markdown-preview min-w-0 text-sm leading-6 text-zinc-100">
                {frontmatterEntries.length > 0 ? (
                  <div className="mb-4 rounded-lg border border-white/15 bg-zinc-950/80 p-3">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-300">
                      Front Matter
                    </p>
                    <div className="space-y-1 text-xs text-zinc-200">
                      {frontmatterEntries.map(([key, value]) => (
                        <p key={key}>
                          <span className="text-zinc-400">{key}:</span>{" "}
                          <span className="font-mono">
                            {typeof value === "string" ? value : JSON.stringify(value)}
                          </span>
                        </p>
                      ))}
                    </div>
                  </div>
                ) : null}

                <ReactMarkdown remarkPlugins={[remarkGfm]}>{parsedEditorBody}</ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm text-zinc-300">
                Select a markdown file to view its content.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
