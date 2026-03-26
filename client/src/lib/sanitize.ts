import DOMPurify from "dompurify";

/**
 * Sanitize untrusted HTML before rendering with dangerouslySetInnerHTML.
 *
 * MANDATORY: Every `dangerouslySetInnerHTML={{ __html: ... }}` usage in this
 * codebase MUST pipe its value through this function first.
 *
 * Safe tags: standard text-formatting elements, links, and images.
 * Stripped: <script>, event handlers (onerror, onclick, …), javascript: URLs,
 *           data: URIs, and any tag not on the allowlist.
 *
 * NOTE: Returns the raw string unchanged when `window` is not defined (e.g.
 * server-side pre-rendering). If SSR is added in future, integrate a
 * server-side DOMPurify instance (using `jsdom`) to preserve the guarantee.
 */
export function sanitizeHtml(html: string): string {
  if (typeof window === "undefined") {
    return html;
  }

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p", "br",
      "strong", "b", "em", "i", "u", "s", "strike",
      "h1", "h2", "h3", "h4", "h5", "h6",
      "ul", "ol", "li",
      "blockquote", "pre", "code",
      "a", "img",
      "span", "div",
      "hr",
    ],
    ALLOWED_ATTR: [
      "href", "src", "alt", "title", "class",
      "target", "rel", "width", "height",
    ],
    ALLOW_DATA_ATTR: false,
    FORCE_BODY: false,
  });
}
