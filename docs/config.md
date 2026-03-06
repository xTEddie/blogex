# Configuration Reference

## `blogex.config.json`

Each blogex repository has its own `blogex.config.json` at the repository root.
This file stores per-repo workspace settings.

`blogUrl`, `targetRepo`, `targetBranch`, and `targetDirectory` can be configured in Workspace Settings (`/workspace/settings`) and are saved back to `blogex.config.json`.

Template (with comments):

```jsonc
{
  // GitHub username or org that owns this blogex repository.
  "owner": "xTEddie",

  // Public URL of the blog site for this workspace.
  "blogUrl": "https://example.com",

  // Source/content repository in owner/repo format.
  "targetRepo": "xTEddie/Blog",

  // Branch in targetRepo used for sync and compare.
  "targetBranch": "main",

  // Directory in targetRepo that contains markdown posts.
  "targetDirectory": "_posts"
}
```

Valid JSON example:

```json
{
  "owner": "xTEddie",
  "blogUrl": "https://example.com",
  "targetRepo": "xTEddie/Blog",
  "targetBranch": "main",
  "targetDirectory": "_posts"
}
```
