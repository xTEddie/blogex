"use client";

import Link from "next/link";
import { HomeIcon } from "@/components/icons";
import BranchStep from "@/components/workspace/branch-step";
import ExplorerStep from "@/components/workspace/explorer-step";
import RepositoryStep from "@/components/workspace/repository-step";
import ResumeWorkspaceSessionBanner from "@/components/workspace/resume-workspace-session-banner";
import { useWorkspaceFlow } from "@/hooks/use-workspace-flow";
import { APP_PATHS } from "@/lib/app-paths";

export default function ConnectRepositoriesPage() {
  const workspace = useWorkspaceFlow();
  const { state, derived, actions } = workspace;

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 sm:px-6">
      <section className="mx-auto w-full max-w-5xl rounded-2xl border border-white/10 bg-white/[0.05] p-5 shadow-2xl shadow-black/30 sm:p-8">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
            Workspace
          </h1>
          <div className="flex items-center gap-2">
            <Link
              href={APP_PATHS.WORKSPACE_SETTINGS}
              className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/15 sm:text-sm"
            >
              Settings
            </Link>
            <Link
              href={APP_PATHS.USER}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/15 sm:text-sm"
            >
              <HomeIcon className="h-3.5 w-3.5 fill-current" />
              Home
            </Link>
          </div>
        </div>

        <p className="mt-2 text-sm text-zinc-300">
          {state.step === "repository"
            ? "Select a repository."
            : state.step === "branch"
              ? "Select a branch."
              : "Browse markdown files in _posts."}
        </p>

        {state.resumeState ? (
          <ResumeWorkspaceSessionBanner
            isResuming={state.isResuming}
            onResume={() => void actions.resumeSession()}
            onStartFresh={actions.startFresh}
          />
        ) : null}

        {state.step === "repository" ? (
          <RepositoryStep
            repoSearchQuery={state.repoSearchQuery}
            onRepoSearchChange={actions.setRepoSearchQuery}
            onRefresh={() => void actions.refreshRepositories()}
            isLoadingRepositories={state.isLoadingRepositories}
            filteredRepositories={derived.filteredRepositories}
            selectedRepo={state.selectedRepo}
            onSelectRepo={actions.setSelectedRepo}
            loadedRepositoryCount={state.repositories.length}
            totalPages={state.totalPages}
            onNext={() => void actions.nextToBranches()}
            isLoadingBranches={state.isLoadingBranches}
          />
        ) : null}

        {state.step === "branch" ? (
          <BranchStep
            selectedRepo={state.selectedRepo}
            branchSearchQuery={state.branchSearchQuery}
            onBranchSearchChange={actions.setBranchSearchQuery}
            isLoadingBranches={state.isLoadingBranches}
            filteredBranches={derived.filteredBranches}
            selectedBranch={state.selectedBranch}
            onSelectBranch={actions.setSelectedBranch}
            onChangeRepo={() => actions.setStep("repository")}
            onConnect={() => void actions.connectToExplorer()}
            isLoadingPosts={state.isLoadingPosts}
          />
        ) : null}

        {state.step === "explorer" ? (
          <ExplorerStep
            selectedRepo={state.selectedRepo}
            selectedBranch={state.selectedBranch}
            onChangeBranch={() => actions.setStep("branch")}
            newMarkdownTitle={state.newMarkdownTitle}
            onNewMarkdownTitleChange={actions.setNewMarkdownTitle}
            onCreateMarkdown={() => void actions.createMarkdown()}
            isCreatingMarkdown={state.isCreatingMarkdown}
            postSearchQuery={state.postSearchQuery}
            onPostSearchChange={actions.setPostSearchQuery}
            isLoadingPosts={state.isLoadingPosts}
            filteredPostFiles={derived.filteredPostFiles}
            selectedPostPath={state.selectedPostPath}
            onOpenFile={(file) => void actions.openFile(file)}
            selectedPostName={state.selectedPostName}
            renameFileName={state.renameFileName}
            onRenameFileNameChange={actions.setRenameFileName}
            isRenameEditorOpen={state.isRenameEditorOpen}
            onOpenRenameEditor={actions.openRenameEditor}
            onCloseRenameEditor={actions.closeRenameEditor}
            onRenameMarkdown={() => void actions.renameMarkdown()}
            isRenameSaveDisabled={derived.isRenameSaveDisabled}
            isRenamingMarkdown={state.isRenamingMarkdown}
            onCompareMarkdown={() => void actions.compareMarkdown()}
            isComparingMarkdown={state.isComparingMarkdown}
            isComparePanelOpen={state.isComparePanelOpen}
            onCloseComparePanel={actions.closeComparePanel}
            compareStatus={state.compareStatus}
            compareDiff={state.compareDiff}
            compareMessage={state.compareMessage}
            targetStatus={state.targetStatus}
            editorView={state.editorView}
            onEditorViewChange={actions.setEditorView}
            onSaveMarkdown={() => void actions.saveMarkdown()}
            isLoadingMarkdown={state.isLoadingMarkdown}
            isSavingMarkdown={state.isSavingMarkdown}
            markdownContent={state.markdownContent}
            editorContent={state.editorContent}
            onEditorContentChange={actions.setEditorContent}
            frontmatterEntries={derived.frontmatterEntries}
            parsedEditorBody={derived.parsedEditorBody}
          />
        ) : null}

        {state.message ? <p className="mt-4 text-sm text-zinc-200">{state.message}</p> : null}
      </section>
    </main>
  );
}
