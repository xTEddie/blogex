function withFallback(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

export function createRepositoryConfigCommitMessage() {
  return "chore: add blogex config";
}

export function createRepositoryInitPostCommitMessage() {
  return "chore: add default hello world post";
}

export function createUpdateMarkdownCommitMessage(path?: string) {
  return `chore: update ${withFallback(path, "markdown file")}`;
}

export function createAddMarkdownCommitMessage(fileName?: string | null) {
  return `chore: add ${withFallback(fileName, "new post")}`;
}

export function createSyncMarkdownCommitMessage(fileName: string, sourceRepo: string) {
  return `chore: sync ${fileName} from ${sourceRepo}`;
}

export function createUpdateBlogexConfigCommitMessage() {
  return "chore: update blogex config";
}
