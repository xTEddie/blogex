import path from "node:path";

export const REPOSITORY_INIT_TEMPLATE_FILE = "hello-world.md";
export const REPOSITORY_INIT_TARGET_FILE_PATH = `_posts/${REPOSITORY_INIT_TEMPLATE_FILE}`;
export const REPOSITORY_INIT_COMMIT_MESSAGE =
  "chore: add default hello world post";
export const REPOSITORY_CONFIG_FILE_PATH = "blogex.config.json";
export const REPOSITORY_CONFIG_COMMIT_MESSAGE = "chore: add blogex config";

export function getRepositoryInitTemplatePath() {
  return path.join(
    process.cwd(),
    "src",
    "templates",
    REPOSITORY_INIT_TEMPLATE_FILE,
  );
}

export function buildRepositoryConfigContent(owner: string) {
  return `${JSON.stringify({ owner }, null, 2)}\n`;
}
