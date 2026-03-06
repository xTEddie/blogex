import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { PluggableList } from "unified";
import { resolvePreviewUrl } from "@/lib/markdown-preview/url";

export type MarkdownPreviewPlugin = {
  id: string;
  className?: string;
  remarkPlugins?: PluggableList;
  rehypePlugins?: PluggableList;
  components?: Components;
};

function createLinkAndImageRoutingPlugin(previewBaseUrl: string): MarkdownPreviewPlugin {
  return {
    id: "link-and-image-routing",
    components: {
      a: ({ href, ...props }) => (
        <a
          {...props}
          href={typeof href === "string" ? resolvePreviewUrl(href, previewBaseUrl) : href}
        />
      ),
      img: ({ src, alt, ...props }) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          {...props}
          src={typeof src === "string" ? resolvePreviewUrl(src, previewBaseUrl) : src}
          alt={alt ?? ""}
        />
      ),
    },
  };
}

function createAllPlugins(previewBaseUrl: string): MarkdownPreviewPlugin[] {
  return [
    {
      id: "gfm",
      remarkPlugins: [remarkGfm],
    },
    {
      id: "html-support",
      rehypePlugins: [rehypeRaw, rehypeSanitize],
    },
    createLinkAndImageRoutingPlugin(previewBaseUrl),
    {
      id: "typography-style",
      className: "mdp-theme-typography",
    },
    {
      id: "callout-style",
      className: "mdp-plugin-callouts",
    },
  ];
}

export const DEFAULT_MARKDOWN_PREVIEW_PLUGIN_IDS = [
  "gfm",
  "html-support",
  "link-and-image-routing",
  "typography-style",
  "callout-style",
];

export function getMarkdownPreviewPlugins(options: {
  previewBaseUrl: string;
  pluginIds?: string[];
}) {
  const pluginIds = options.pluginIds ?? DEFAULT_MARKDOWN_PREVIEW_PLUGIN_IDS;
  const enabledIds = new Set(pluginIds);
  return createAllPlugins(options.previewBaseUrl).filter((plugin) => enabledIds.has(plugin.id));
}
