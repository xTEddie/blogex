import path from "node:path";

export const REPOSITORY_INIT_TEMPLATE_FILE = "hello-world.md";
export const REPOSITORY_INIT_TARGET_FILE_PATH = `_posts/${REPOSITORY_INIT_TEMPLATE_FILE}`;
export const REPOSITORY_INIT_COMMIT_MESSAGE =
  "chore: add default hello world post";

export function getRepositoryInitTemplatePath() {
  return path.join(
    process.cwd(),
    "src",
    "templates",
    REPOSITORY_INIT_TEMPLATE_FILE,
  );
}
