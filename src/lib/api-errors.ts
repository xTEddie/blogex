import { NextResponse } from "next/server";

type ApiErrorDefinition = {
  status: number;
  message: string;
};

// Centralized server error catalog.
// Keep all request validation/fallback messages here so wording + status are configured in one place.
export const API_ERRORS = {
  // Auth/session: user has no auth cookie or session is missing.
  UNAUTHORIZED: { status: 401, message: "Unauthorized" },
  // Request body could not be parsed as valid JSON.
  INVALID_JSON_PAYLOAD: { status: 400, message: "Invalid JSON payload." },
  // OAuth cannot start without configured client id.
  MISSING_GITHUB_CLIENT_ID: {
    status: 500,
    message: "Missing GITHUB_CLIENT_ID environment variable.",
  },
  // OAuth callback cannot exchange token without both app credentials.
  MISSING_GITHUB_OAUTH_ENV: {
    status: 500,
    message:
      "Missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET environment variable.",
  },

  // Repository/branch/path validation errors.
  INVALID_REPOSITORY_FORMAT: {
    status: 400,
    message: "Invalid repository format.",
  },
  REPO_QUERY_OWNER_NAME_REQUIRED: {
    status: 400,
    message: "Query param `repo` must be in `owner/name` format.",
  },
  BRANCH_QUERY_REQUIRED: {
    status: 400,
    message: "Query param `branch` is required.",
  },
  PATH_QUERY_POSTS_MARKDOWN_REQUIRED: {
    status: 400,
    message: "Query param `path` must target a markdown file in _posts.",
  },
  REPO_FIELD_OWNER_NAME_REQUIRED: {
    status: 400,
    message: "Field `repo` must be in `owner/name` format.",
  },
  BRANCH_FIELD_REQUIRED: {
    status: 400,
    message: "Field `branch` is required.",
  },
  PATH_FIELD_POSTS_MARKDOWN_REQUIRED: {
    status: 400,
    message: "Field `path` must target a markdown file in _posts.",
  },
  MARKDOWN_FIELD_STRING_REQUIRED: {
    status: 400,
    message: "Field `markdown` must be a string.",
  },
  TITLE_FIELD_INVALID_MARKDOWN_FILENAME: {
    status: 400,
    message: "Field `title` must produce a valid markdown file name.",
  },
  NEXT_NAME_FIELD_INVALID_MARKDOWN_FILENAME: {
    status: 400,
    message: "Field `nextName` must be a valid markdown filename.",
  },
  INVALID_TARGET_MARKDOWN_FILENAME: {
    status: 400,
    message: "Invalid target markdown filename.",
  },
  MARKDOWN_FILE_ALREADY_EXISTS: {
    status: 409,
    message: "A markdown file with this name already exists.",
  },
  MISSING_FILE_SHA: {
    status: 500,
    message: "Missing file sha from GitHub response.",
  },

  // Sync validation errors.
  QUERY_SOURCE_REPO_SOURCE_BRANCH_REQUIRED: {
    status: 400,
    message: "Query params sourceRepo and sourceBranch are required.",
  },
  SOURCE_REPO_OWNER_NAME_REQUIRED: {
    status: 400,
    message: "sourceRepo must be in owner/name format.",
  },
  FIELDS_SOURCE_REPO_SOURCE_BRANCH_SOURCE_PATH_REQUIRED: {
    status: 400,
    message: "Fields sourceRepo, sourceBranch, and sourcePath are required.",
  },
  FIELDS_TARGET_REPO_TARGET_BRANCH_REQUIRED: {
    status: 400,
    message: "Fields targetRepo and targetBranch are required.",
  },
  SOURCE_PATH_MARKDOWN_INSIDE_SOURCE_DIRECTORY_REQUIRED: {
    status: 400,
    message: "sourcePath must be a markdown file inside the source directory.",
  },
  REPOSITORY_FIELDS_OWNER_NAME_REQUIRED: {
    status: 400,
    message: "Repository fields must be in owner/name format.",
  },
  INVALID_SOURCE_FILE_PATH: {
    status: 400,
    message: "Invalid source file path.",
  },
  QUERY_TARGET_REPO_TARGET_BRANCH_SOURCE_PATH_REQUIRED: {
    status: 400,
    message: "Query params targetRepo, targetBranch and sourcePath are required.",
  },
  SOURCE_PATH_MARKDOWN_FILE_REQUIRED: {
    status: 400,
    message: "sourcePath must be a markdown file.",
  },
  TARGET_REPO_OWNER_NAME_REQUIRED: {
    status: 400,
    message: "targetRepo must be in owner/name format.",
  },
  INVALID_SOURCE_PATH: {
    status: 400,
    message: "Invalid sourcePath.",
  },
  QUERY_COMPARE_REQUIRED: {
    status: 400,
    message:
      "Query params sourceRepo, sourceBranch, sourcePath, targetRepo, and targetBranch are required.",
  },
  SOURCE_PATH_MARKDOWN_FILE_PATH_REQUIRED: {
    status: 400,
    message: "sourcePath must be a markdown file path.",
  },
  SOURCE_AND_TARGET_REPO_OWNER_NAME_REQUIRED: {
    status: 400,
    message: "sourceRepo and targetRepo must be in owner/name format.",
  },

  // Config/repository creation validation errors.
  QUERY_REPO_AND_BRANCH_REQUIRED: {
    status: 400,
    message: "Query params repo and branch are required.",
  },
  FIELDS_REPO_AND_BRANCH_REQUIRED: {
    status: 400,
    message: "Fields repo and branch are required.",
  },
  FIELD_CONFIG_REQUIRED: {
    status: 400,
    message: "Field config is required.",
  },
  REPOSITORY_NAME_REQUIRED: {
    status: 400,
    message: "Repository name is required.",
  },
  FAILED_LOAD_DEFAULT_MARKDOWN_TEMPLATE: {
    status: 500,
    message: "Failed to load default markdown template.",
  },

  // GitHub response shape validation.
  UNSUPPORTED_MARKDOWN_FILE_RESPONSE_FORMAT: {
    status: 500,
    message: "Unsupported markdown file response format.",
  },
  UNSUPPORTED_SOURCE_MARKDOWN_FILE_RESPONSE_FORMAT: {
    status: 500,
    message: "Unsupported source markdown file response format.",
  },
  UNSUPPORTED_SOURCE_MARKDOWN_FORMAT: {
    status: 500,
    message: "Unsupported source markdown format.",
  },
  UNSUPPORTED_SOURCE_MARKDOWN_RESPONSE_FORMAT: {
    status: 500,
    message: "Unsupported source markdown response format.",
  },
  UNSUPPORTED_TARGET_MARKDOWN_RESPONSE_FORMAT: {
    status: 500,
    message: "Unsupported target markdown response format.",
  },

  // Generic server-side fallback messages when GitHub does not return a clear reason.
  FAILED_FETCH_BRANCHES: { status: 502, message: "Failed to fetch branches." },
  FAILED_FETCH_REPOSITORIES: {
    status: 502,
    message: "Failed to fetch repositories.",
  },
  FAILED_CREATE_REPOSITORY: { status: 502, message: "Failed to create repository." },
  FAILED_FETCH_POSTS_DIRECTORY: {
    status: 502,
    message: "Failed to fetch _posts directory.",
  },
  FAILED_FETCH_MARKDOWN_CONTENT: {
    status: 502,
    message: "Failed to fetch markdown content.",
  },
  FAILED_FETCH_CURRENT_FILE_METADATA: {
    status: 502,
    message: "Failed to fetch current file metadata.",
  },
  FAILED_UPDATE_MARKDOWN_FILE: {
    status: 502,
    message: "Failed to update markdown file.",
  },
  FAILED_CREATE_MARKDOWN_FILE: {
    status: 502,
    message: "Failed to create markdown file.",
  },
  FAILED_FETCH_SOURCE_FILE_METADATA: {
    status: 502,
    message: "Failed to fetch source file metadata.",
  },
  FAILED_CHECK_DESTINATION_FILENAME: {
    status: 502,
    message: "Failed to check destination filename.",
  },
  FAILED_CREATE_RENAMED_MARKDOWN_FILE: {
    status: 502,
    message: "Failed to create renamed markdown file.",
  },
  FAILED_FETCH_SOURCE_MARKDOWN_FILES: {
    status: 502,
    message: "Failed to fetch source markdown files.",
  },
  FAILED_FETCH_SOURCE_MARKDOWN_CONTENT: {
    status: 502,
    message: "Failed to fetch source markdown content.",
  },
  FAILED_CHECK_TARGET_FILE: { status: 502, message: "Failed to check target file." },
  FAILED_SYNC_MARKDOWN_FILE: {
    status: 502,
    message: "Failed to sync markdown file.",
  },
  FAILED_CHECK_TARGET_MARKDOWN_FILE: {
    status: 502,
    message: "Failed to check target markdown file.",
  },
  FAILED_LOAD_SOURCE_MARKDOWN_FILE: {
    status: 502,
    message: "Failed to load source markdown file.",
  },
  FAILED_LOAD_TARGET_MARKDOWN_FILE: {
    status: 502,
    message: "Failed to load target markdown file.",
  },
  FAILED_LOAD_BLOGEX_CONFIG: {
    status: 502,
    message: "Failed to load blogex config.",
  },
  FAILED_CHECK_EXISTING_CONFIG: {
    status: 502,
    message: "Failed to check existing config.",
  },
  FAILED_SAVE_BLOGEX_CONFIG: {
    status: 502,
    message: "Failed to save blogex config.",
  },
  GITHUB_TOKEN_NO_LONGER_VALID: {
    status: 401,
    message: "GitHub token is no longer valid.",
  },
} as const satisfies Record<string, ApiErrorDefinition>;

export type ApiErrorKey = keyof typeof API_ERRORS;

export function jsonError(key: ApiErrorKey, message?: string, status?: number) {
  const definition = API_ERRORS[key];
  return NextResponse.json(
    { error: message ?? definition.message },
    { status: status ?? definition.status },
  );
}
