"use client";

import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import {
  DEFAULT_MARKDOWN_PREVIEW_PLUGIN_IDS,
  getMarkdownPreviewPlugins,
} from "@/lib/markdown-preview/preview-plugins";

type MarkdownPreviewProps = {
  markdown: string;
  previewBaseUrl?: string;
  pluginIds?: string[];
  className?: string;
};

export default function MarkdownPreview({
  markdown,
  previewBaseUrl = "",
  pluginIds = DEFAULT_MARKDOWN_PREVIEW_PLUGIN_IDS,
  className,
}: MarkdownPreviewProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const plugins = getMarkdownPreviewPlugins({ previewBaseUrl, pluginIds });

  const remarkPlugins = plugins.flatMap((plugin) => plugin.remarkPlugins ?? []);
  const rehypePlugins = plugins.flatMap((plugin) => plugin.rehypePlugins ?? []);
  const components = Object.assign({}, ...plugins.map((plugin) => plugin.components ?? {}));
  const pluginClassNames = plugins
    .map((plugin) => plugin.className)
    .filter((value): value is string => Boolean(value));

  const wrapperClassName = ["markdown-preview", ...pluginClassNames, className]
    .filter(Boolean)
    .join(" ");

  useEffect(() => {
    const rootElement = rootRef.current;
    if (!rootElement) {
      return;
    }

    const cleanups = plugins
      .map((plugin) => plugin.onMount?.(rootElement))
      .filter((cleanup): cleanup is () => void => typeof cleanup === "function");

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [markdown, plugins]);

  return (
    <div ref={rootRef} className={wrapperClassName}>
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={components}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
