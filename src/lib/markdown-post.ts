export function normalizeMarkdownFileName(input: string) {
  const slug = input
    .trim()
    .replace(/\.md$/i, "")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (!slug) {
    return null;
  }

  return `${slug}.md`;
}

export function titleToMarkdownFileName(title: string) {
  return normalizeMarkdownFileName(title);
}

export function buildInitialMarkdownFromTitle(title: string) {
  const cleanedTitle = title.trim();

  return `---\ntitle: ${cleanedTitle}\ndraft: true\n---\n\nWrite your post here.\n`;
}
