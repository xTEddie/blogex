import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
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
  onMount?: (rootElement: HTMLElement) => void | (() => void);
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
  const sanitizeSchema = {
    ...defaultSchema,
    tagNames: [
      ...(defaultSchema.tagNames ?? []),
      "figure",
      "figcaption",
      "figurecaption",
      "button",
    ],
    attributes: {
      ...defaultSchema.attributes,
      "*": [...(defaultSchema.attributes?.["*"] ?? []), "className", "class"],
    },
  };

  return [
    {
      id: "gfm",
      remarkPlugins: [remarkGfm],
    },
    {
      id: "html-support",
      rehypePlugins: [rehypeRaw, [rehypeSanitize, sanitizeSchema]],
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
    {
      id: "carousel-behavior",
      onMount: (rootElement) => {
        const cleanupHandlers: Array<() => void> = [];
        const carousels = rootElement.querySelectorAll<HTMLElement>(".post-carousel");

        carousels.forEach((carousel) => {
          const track = carousel.querySelector<HTMLElement>(".post-carousel__track");
          if (!track) {
            return;
          }

          const slides = Array.from(
            track.querySelectorAll<HTMLElement>(".post-carousel__slide"),
          );
          if (slides.length <= 1) {
            return;
          }

          const prevButton =
            carousel.querySelector<HTMLButtonElement>(".post-carousel__button--prev");
          const nextButton =
            carousel.querySelector<HTMLButtonElement>(".post-carousel__button--next");

          let dotsContainer = carousel.querySelector<HTMLElement>(".post-carousel__dots");
          const createdDotsContainer = !dotsContainer;
          if (!dotsContainer) {
            dotsContainer = document.createElement("div");
            dotsContainer.className = "post-carousel__dots";
            carousel.appendChild(dotsContainer);
          }

          let currentIndex = 0;
          const dotButtons: HTMLButtonElement[] = [];

          const updateCarouselUi = () => {
            track.style.transform = `translateX(-${currentIndex * 100}%)`;
            if (prevButton) {
              prevButton.disabled = currentIndex === 0;
            }
            if (nextButton) {
              nextButton.disabled = currentIndex === slides.length - 1;
            }
            dotButtons.forEach((dotButton, dotIndex) => {
              dotButton.classList.toggle("is-active", dotIndex === currentIndex);
            });
          };

          const goToSlide = (nextIndex: number) => {
            currentIndex = Math.max(0, Math.min(slides.length - 1, nextIndex));
            updateCarouselUi();
          };

          dotsContainer.innerHTML = "";
          slides.forEach((_, index) => {
            const dotButton = document.createElement("button");
            dotButton.type = "button";
            dotButton.className = "post-carousel__dot";
            dotButton.setAttribute("aria-label", `Go to slide ${index + 1}`);
            const onDotClick = () => goToSlide(index);
            dotButton.addEventListener("click", onDotClick);
            cleanupHandlers.push(() => dotButton.removeEventListener("click", onDotClick));
            dotsContainer?.appendChild(dotButton);
            dotButtons.push(dotButton);
          });

          if (prevButton) {
            const onPrevClick = () => goToSlide(currentIndex - 1);
            prevButton.addEventListener("click", onPrevClick);
            cleanupHandlers.push(() => prevButton.removeEventListener("click", onPrevClick));
          }

          if (nextButton) {
            const onNextClick = () => goToSlide(currentIndex + 1);
            nextButton.addEventListener("click", onNextClick);
            cleanupHandlers.push(() => nextButton.removeEventListener("click", onNextClick));
          }

          updateCarouselUi();

          if (createdDotsContainer) {
            cleanupHandlers.push(() => {
              dotsContainer?.remove();
            });
          }
        });

        return () => {
          cleanupHandlers.forEach((cleanup) => cleanup());
        };
      },
    },
  ];
}

export const DEFAULT_MARKDOWN_PREVIEW_PLUGIN_IDS = [
  "gfm",
  "html-support",
  "link-and-image-routing",
  "typography-style",
  "callout-style",
  "carousel-behavior",
];

export function getMarkdownPreviewPlugins(options: {
  previewBaseUrl: string;
  pluginIds?: string[];
}) {
  const pluginIds = options.pluginIds ?? DEFAULT_MARKDOWN_PREVIEW_PLUGIN_IDS;
  const enabledIds = new Set(pluginIds);
  return createAllPlugins(options.previewBaseUrl).filter((plugin) => enabledIds.has(plugin.id));
}
