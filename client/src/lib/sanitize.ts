import DOMPurify from "dompurify";

const SAFE_TAGS = [
  "p", "br", "strong", "b", "em", "i", "u", "s", "strike",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li",
  "blockquote", "pre", "code",
  "a", "img",
  "div", "span",
  "table", "thead", "tbody", "tr", "th", "td",
  "hr",
];

const SAFE_ATTRS = [
  "href", "src", "alt", "title", "class", "id",
  "target", "rel", "width", "height",
  "style",
];

export function sanitizeHtml(html: string): string {
  if (typeof window === "undefined") return html;
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: SAFE_TAGS,
    ALLOWED_ATTR: SAFE_ATTRS,
    ALLOW_DATA_ATTR: false,
    FORCE_BODY: false,
  });
}
