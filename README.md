# blogex
GitHub-native CMS for Markdown blogs.

## Features

- GitHub OAuth authentication with secure cookie-based session.
- Repository bootstrap for blogex-managed repos (`blogex.config.json` + starter `_posts` file).
- Guided workspace flow for selecting repository and branch.
- Markdown authoring workflow with explorer, edit/preview, create, rename, and commit.
- Per-repo workspace settings for target repo/branch/directory.
- Sync and compare tools between source and target markdown files.
- Client-side caching for repository/session UX with manual refresh.
- Mobile-friendly UI with consistent styling and reusable components.

## Getting Started

### Prerequisites

- Node.js `v20.19.6` (recommended)
- npm `v10+`
- A GitHub OAuth App with callback URL set to:
  - `http://localhost:3000/auth/github/callback` (local development)

### Setup

1. Use the expected Node version:

```bash
nvm use 20.19.6
```

2. Install dependencies:

```bash
npm install
```

3. Create a GitHub OAuth App:
   1. Open GitHub and go to `Settings` -> `Developer settings` -> `OAuth Apps`.
   2. Click `New OAuth App`.
   3. Set `Application name` (example: `blogex-local`).
   4. Set `Homepage URL` to `http://localhost:3000`.
   5. Set `Authorization callback URL` to `http://localhost:3000/auth/github/callback`.
   6. Click `Register application`.
   7. Copy the `Client ID`.
   8. Click `Generate a new client secret`, then copy the generated secret.

4. Create `.env.local` in the project root:

```env
GITHUB_CLIENT_ID=your_github_oauth_client_id
GITHUB_CLIENT_SECRET=your_github_oauth_client_secret
APP_URL=http://localhost:3000
```

5. Run the app:

```bash
npm run dev
```

6. Open `http://localhost:3000`.

## NPM Commands

- `npm run dev`: Start the development server.
- `npm run build`: Build for production.
- `npm run start`: Run the production server.
- `npm run lint`: Run ESLint.

## Usage

1. Login: Authenticate with GitHub
   - Open the app and click `Login with GitHub`.
   - Complete OAuth consent on GitHub.
   - You will be redirected to the user page after successful login.

2. Create Repository: Set up a blogex markdown manager repository
   - On the user page, enter a repository name and visibility.
   - Submit the create form.
   - blogex initializes the repository with:
     - `blogex.config.json` at root
     - `_posts/hello-world.md` as starter content

3. Open Workspace: Select repository and branch
   - Click `Open Workspace`.
   - Step 1: Select a repository.
   - Step 2: Select a branch.
   - Step 3: Open the explorer to browse `_posts`.

4. Write And Edit Markdown
   - Select a markdown file from the explorer.
   - Edit in `Edit` mode or preview rendered output in `Preview` mode.
   - Save changes to create a commit on the selected branch.

5. Create Or Rename Markdown Files
   - Create a new file by entering a title.
   - blogex generates a slug filename and default frontmatter.
   - Rename existing files directly from the explorer action bar.

6. Configure Workspace Settings
   - Open `/workspace/settings`.
   - Load or save `blogex.config.json` for the selected repo/branch.
   - Configure `targetRepo`, `targetBranch`, and `targetDirectory` for sync features.

7. Sync From Target Repository
   - In Workspace Settings, use `Sync markdowns` to list source files from target repo.
   - Select one file and sync it into the current repo.
   - In workspace explorer, use file status and compare to verify source vs target.

8. Logout
   - Use `Log out` on the user page to clear the session cookie and return home.

## Configuration

blogex uses a per-repository `blogex.config.json` file for workspace target settings.
Full configuration details and examples are available in [`docs/config.md`](docs/config.md).

## API Reference

Full API documentation is available in [`docs/api.md`](docs/api.md).
