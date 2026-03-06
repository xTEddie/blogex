# Markdown Preview Plugins

The workspace markdown preview is extensible through a small plugin registry.

## Main files

- `src/components/workspace/markdown-preview.tsx`
  - Renderer boundary for preview.
  - Composes enabled plugins into `remarkPlugins`, `rehypePlugins`, markdown `components`, and wrapper class names.
- `src/lib/markdown-preview/preview-plugins.tsx`
  - Plugin definitions and default plugin list.
- `src/styles/markdown-preview/`
  - `base.css`: shared preview layout rules.
  - `plugins/*.css`: plugin-scoped style packs.

## Add a CSS-style plugin

1. Create `src/styles/markdown-preview/plugins/<name>.css`.
2. Scope styles with `.markdown-preview.<your-class>`.
3. Import it from `src/app/globals.css`.
4. Add a plugin in `preview-plugins.tsx` with a matching `className`.

Example plugin object:

```ts
{
  id: "my-style",
  className: "mdp-plugin-my-style",
}
```

## Add behavior plugins

Use `remarkPlugins`, `rehypePlugins`, or `components` in a plugin object.
For DOM-level interactions (for example a preview-only carousel), use `onMount`.

Example:

```ts
{
  id: "my-behavior",
  rehypePlugins: [myRehypePlugin],
}
```

Interactive example:

```ts
{
  id: "my-interaction",
  onMount: (rootElement) => {
    const button = rootElement.querySelector("button.my-toggle");
    if (!button) return;
    const onClick = () => {
      // preview-only interaction
    };
    button.addEventListener("click", onClick);
    return () => button.removeEventListener("click", onClick);
  },
}
```

Notes:
- Inline JS from markdown (`onclick`, `<script>`) does not run in preview by design.
- Keep preview interactions in plugins for safety and code review.

## Defaults

Default plugin IDs live in `DEFAULT_MARKDOWN_PREVIEW_PLUGIN_IDS`.

To experiment with custom stacks, pass `pluginIds` to `MarkdownPreview`.
