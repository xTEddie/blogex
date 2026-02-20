# blogex
GitHub-native CMS for Markdown blogs.

## Features

- GitHub-only OAuth sign-in with secure cookie session.
- User home with repository creation flow.
- Repository bootstrap on create:
  - root `blogex.config.json`
  - default `_posts/hello-world.md`
- Workspace wizard to select repository and branch.
- Client-side repository caching with manual refresh.
- Markdown explorer for `_posts` with search.
- Markdown editor with:
  - edit and preview modes
  - frontmatter-aware preview
  - save-to-commit workflow
- Create markdown files from title (slug + default frontmatter).
- Rename markdown files in `_posts` with commit support.
- Line-ending preservation:
  - keeps CRLF/LF style when editing existing files
  - sync pull preserves source file bytes
- Workspace settings page to manage per-repo `blogex.config.json`.
- Sync tooling:
  - list source markdown files
  - pull one file into current repo
  - target file existence indicator
  - source vs target unified diff compare
- Mobile-friendly workspace UI with reusable icons and consistent custom scrollbars.

## Prerequisites

- Node.js `v20.19.6` (recommended)
- npm `v10+`
- A GitHub OAuth App with callback URL set to:
  - `http://localhost:3000/auth/github/callback` (local development)

## Setup

1. Use the expected Node version:

```bash
nvm use 20.19.6
```

2. Install dependencies:

```bash
npm install
```

3. Create `.env.local` in the project root:

```env
GITHUB_CLIENT_ID=your_github_oauth_client_id
GITHUB_CLIENT_SECRET=your_github_oauth_client_secret
APP_URL=http://localhost:3000
```

## NPM Commands

- `npm run dev`: Start the development server.
- `npm run build`: Build for production.
- `npm run start`: Run the production server.
- `npm run lint`: Run ESLint.

## Run The App

1. Start the app:

```bash
npm run dev
```

2. Open `http://localhost:3000`.

## blogex.config.json

Each blogex repository has its own `blogex.config.json` at the repository root.
This file stores per-repo workspace settings such as `owner`, `targetRepo`, `targetBranch`, and `targetDirectory`.

`targetRepo`, `targetBranch`, and `targetDirectory` are configurable in Workspace Settings (`/workspace/settings`) and are saved back to `blogex.config.json`.

Template (with comments):

```jsonc
{
  // GitHub username or org that owns this blogex repository.
  "owner": "xTEddie",

  // Source/content repository in owner/repo format.
  "targetRepo": "xTEddie/Blog",

  // Branch in targetRepo used for sync and compare.
  "targetBranch": "main",

  // Directory in targetRepo that contains markdown posts.
  "targetDirectory": "_posts"
}
```

## API

All routes are Next.js Route Handlers under `src/app/api` unless noted.
Most routes require an authenticated session cookie: `gh_oauth_token`.

### Auth

#### `GET /api/auth/github`
- Description: Starts GitHub OAuth flow and redirects to GitHub authorize page.
- Query params: none.
- Body: none.

#### `GET /auth/github/callback`
- Description: OAuth callback route. Exchanges `code` for token, sets auth cookie, redirects to `/user`.
- Query params:
  - `code` (required): GitHub OAuth code.
  - `state` (required): CSRF state.
- Body: none.

#### `POST /api/auth/logout`
- Description: Clears auth cookies and redirects to home.
- Query params: none.
- Body: none.

### Repositories

#### `GET /api/github/repositories`
- Description: Lists blogex repositories available to the authenticated user.
- Query params:
  - `page` (optional, default `1`)
  - `per_page` (optional, default `20`, max `100`)
- Body: none.

#### `POST /api/github/repositories`
- Description: Creates a repository, initializes `blogex.config.json` and default `_posts` file.
- Query params: none.
- Body (JSON):
  - `name` (required): repository name.
  - `private` (optional): `true` for private, otherwise public.

#### `GET /api/github/repositories/branches`
- Description: Lists branches for a repository.
- Query params:
  - `repo` (required): `owner/name`.
- Body: none.

### Posts

#### `GET /api/github/repositories/posts`
- Description: Lists markdown files in `_posts` for a repo branch.
- Query params:
  - `repo` (required): `owner/name`.
  - `branch` (required): branch name.
- Body: none.

#### `GET /api/github/repositories/posts/content`
- Description: Fetches markdown content for one file.
- Query params:
  - `repo` (required): `owner/name`.
  - `branch` (required): branch name.
  - `path` (required): markdown path under `_posts`, e.g. `_posts/hello-world.md`.
- Body: none.

#### `PUT /api/github/repositories/posts/content`
- Description: Updates one markdown file and commits to the selected branch.
- Query params: none.
- Body (JSON):
  - `repo` (required): `owner/name`.
  - `branch` (required): branch name.
  - `path` (required): markdown path under `_posts`.
  - `markdown` (required): full markdown file content.
  - `message` (optional): custom commit message.

#### `POST /api/github/repositories/posts/content`
- Description: Creates a new markdown file in `_posts` and commits it.
- Query params: none.
- Body (JSON):
  - `repo` (required): `owner/name`.
  - `branch` (required): branch name.
  - `title` (required): title used to generate slug/file name.
  - `markdown` (optional): custom initial content.
  - `message` (optional): custom commit message.

#### `PATCH /api/github/repositories/posts/content`
- Description: Renames a markdown file in `_posts` and commits the rename.
- Query params: none.
- Body (JSON):
  - `repo` (required): `owner/name`.
  - `branch` (required): branch name.
  - `path` (required): current markdown path under `_posts`.
  - `nextName` (required): new markdown filename (with or without `.md`).
  - `message` (optional): custom commit message for the rename creation step.

### Blogex Config

#### `GET /api/github/repositories/config`
- Description: Reads `blogex.config.json` for a repo branch.
- Query params:
  - `repo` (required): `owner/name`.
  - `branch` (required): branch name.
- Body: none.

#### `PUT /api/github/repositories/config`
- Description: Creates/updates `blogex.config.json` in a repo branch.
- Query params: none.
- Body (JSON):
  - `repo` (required): `owner/name`.
  - `branch` (required): branch name.
  - `config` (required): object stored in `blogex.config.json`.
    - Supports keys like: `owner`, `targetRepo`, `targetBranch`, `targetDirectory`.
  - `message` (optional): custom commit message.

### Sync

#### `GET /api/github/repositories/sync`
- Description: Lists markdown candidates from source repository directory.
- Query params:
  - `sourceRepo` (required): `owner/name`.
  - `sourceBranch` (required): branch name.
  - `sourceDirectory` (optional, default `_posts`): directory to scan.
- Body: none.

#### `POST /api/github/repositories/sync`
- Description: Pulls one markdown file from source repo into target repo `_posts` and commits.
- Query params: none.
- Body (JSON):
  - `sourceRepo` (required): `owner/name`.
  - `sourceBranch` (required): source branch.
  - `sourceDirectory` (optional, default `_posts`): source directory.
  - `sourcePath` (required): full source file path.
  - `targetRepo` (required): `owner/name`.
  - `targetBranch` (required): target branch.
  - `message` (optional): custom commit message.

#### `GET /api/github/repositories/sync/status`
- Description: Checks whether selected markdown already exists in target repo path.
- Query params:
  - `targetRepo` (required): `owner/name`.
  - `targetBranch` (required): branch name.
  - `targetDirectory` (optional, default `_posts`): directory in target repo.
  - `sourcePath` (required): selected source markdown path.
- Body: none.

#### `GET /api/github/repositories/sync/compare`
- Description: Compares selected source markdown with mapped target markdown and returns status + unified diff.
- Query params:
  - `sourceRepo` (required): `owner/name`.
  - `sourceBranch` (required): source branch.
  - `sourcePath` (required): source markdown path.
  - `targetRepo` (required): `owner/name`.
  - `targetBranch` (required): target branch.
  - `targetDirectory` (optional, default `_posts`): target directory used to map filename.
- Body: none.
