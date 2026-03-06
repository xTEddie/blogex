export function resolvePreviewUrl(rawUrl: string, previewBaseUrl: string) {
  if (!rawUrl || !previewBaseUrl) {
    return rawUrl;
  }

  const trimmedUrl = rawUrl.trim();
  if (!trimmedUrl) {
    return rawUrl;
  }

  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmedUrl) || trimmedUrl.startsWith("//")) {
    return rawUrl;
  }

  try {
    return new URL(trimmedUrl, previewBaseUrl).toString();
  } catch {
    return rawUrl;
  }
}
