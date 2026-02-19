import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import FileSyncStatus, { type FileSyncStatusValue } from "@/components/file-sync-status";
import { type PostFile } from "@/lib/workspace-client";

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
          Change branch
        </button>
        <p className="text-xs text-zinc-400">
          Repo: {selectedRepo} | Branch: {selectedBranch}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-[300px_1fr]">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-300">
            _posts
          </p>
          <div className="mb-3 flex gap-2">
            <input
              type="text"
              value={newMarkdownTitle}
              onChange={(event) => onNewMarkdownTitleChange(event.target.value)}
              placeholder="My New Post"
              className="w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none ring-white/40 placeholder:text-zinc-500 focus:ring-2"
            />
            <button
              type="button"
              onClick={onCreateMarkdown}
              disabled={isCreatingMarkdown || !newMarkdownTitle.trim()}
              className="shrink-0 rounded-xl border border-white/15 bg-white/95 px-3 py-2.5 text-xs font-medium text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCreatingMarkdown ? "Creating..." : "Create"}
            </button>
          </div>
          <input
            type="text"
            value={postSearchQuery}
            onChange={(event) => onPostSearchChange(event.target.value)}
            placeholder="Search markdown files"
            className="mb-3 w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none ring-white/40 placeholder:text-zinc-500 focus:ring-2"
          />
          <div className="max-h-[420px] space-y-2 overflow-y-auto rounded-xl border border-white/15 bg-zinc-900/70 p-2">
            {isLoadingPosts ? (
              <p className="px-3 py-2 text-sm text-zinc-300">Loading markdown files...</p>
            ) : filteredPostFiles.length === 0 ? (
              <p className="px-3 py-2 text-sm text-zinc-300">
                No markdown files found in _posts
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

        <div className="min-h-[300px] rounded-xl border border-white/15 bg-zinc-900/60">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <p className="text-sm text-zinc-200">{selectedPostName || "Markdown editor"}</p>
              {selectedPostPath ? <FileSyncStatus status={targetStatus} /> : null}
            </div>
            <div className="flex items-center gap-2">
              <div className="rounded-lg border border-white/15 bg-white/10 p-1">
                <button
                  type="button"
                  onClick={() => onEditorViewChange("edit")}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                    editorView === "edit"
                      ? "bg-white text-zinc-900"
                      : "text-zinc-200 hover:bg-white/15"
                  }`}
                >
                  Edit
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
                  Preview
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
                className="rounded-lg border border-white/15 bg-white/95 px-3 py-1.5 text-xs font-medium text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingMarkdown ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
          <div className="max-h-[420px] overflow-auto px-4 py-3">
            {isLoadingMarkdown ? (
              <p className="text-sm text-zinc-300">Loading file content...</p>
            ) : selectedPostPath && editorView === "edit" ? (
              <textarea
                value={editorContent}
                onChange={(event) => onEditorContentChange(event.target.value)}
                className="min-h-[340px] w-full resize-y rounded-lg border border-white/15 bg-zinc-950 px-3 py-2.5 font-mono text-sm leading-6 text-zinc-100 outline-none ring-white/40 focus:ring-2"
              />
            ) : selectedPostPath && editorView === "preview" ? (
              <div className="markdown-preview text-sm leading-6 text-zinc-100">
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
