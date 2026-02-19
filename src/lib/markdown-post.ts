export function titleToMarkdownFileName(title: string) {
  const slug = title
    .trim()
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

export function buildInitialMarkdownFromTitle(title: string) {
  const cleanedTitle = title.trim();

  return `---\ntitle: ${cleanedTitle}\ndraft: true\n---\n\nWrite your post here.\n`;
}
