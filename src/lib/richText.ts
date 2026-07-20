const ALLOWED_TAGS = new Set([
  "h1",
  "p",
  "div",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "ul",
  "ol",
  "li",
  "h2",
  "h3",
  "blockquote",
  "a",
]);

const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);
const HTML_TAG_PATTERN = /<[a-z][\s\S]*>/i;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatInlineText(value: string) {
  return escapeHtml(value).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function convertPlainTextToHtml(value: string) {
  const lines = value.split(/\r?\n/);
  const parts: string[] = [];
  let paragraphLines: string[] = [];
  let listItems: string[] = [];
  let listType: "ul" | "ol" | null = null;

  const flushParagraph = () => {
    if (paragraphLines.length === 0) {
      return;
    }

    parts.push(`<p>${paragraphLines.map(formatInlineText).join("<br>")}</p>`);
    paragraphLines = [];
  };

  const flushList = () => {
    if (!listType || listItems.length === 0) {
      listType = null;
      listItems = [];
      return;
    }

    parts.push(
      `<${listType}>${listItems
        .map((item) => `<li>${formatInlineText(item)}</li>`)
        .join("")}</${listType}>`
    );
    listType = null;
    listItems = [];
  };

  lines.forEach((rawLine) => {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushList();
      return;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();

      const level = Math.min(headingMatch[1].length, 3);
      parts.push(`<h${level}>${formatInlineText(headingMatch[2])}</h${level}>`);
      return;
    }

    const orderedMatch = line.match(/^\d+\.\s+(.+)$/);
    if (orderedMatch) {
      flushParagraph();
      if (listType && listType !== "ol") {
        flushList();
      }
      listType = "ol";
      listItems.push(orderedMatch[1]);
      return;
    }

    const unorderedMatch = line.match(/^-\s+(.+)$/);
    if (unorderedMatch) {
      flushParagraph();
      if (listType && listType !== "ul") {
        flushList();
      }
      listType = "ul";
      listItems.push(unorderedMatch[1]);
      return;
    }

    flushList();
    paragraphLines.push(line);
  });

  flushParagraph();
  flushList();

  return parts.join("");
}

function isSafeHref(href: string) {
  try {
    const parsedUrl = new URL(href, window.location.origin);
    return ALLOWED_PROTOCOLS.has(parsedUrl.protocol);
  } catch {
    return false;
  }
}

function sanitizeNode(node: Node, doc: Document) {
  const children = Array.from(node.childNodes);

  children.forEach((child) => {
    if (child.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    const element = child as HTMLElement;
    sanitizeNode(element, doc);

    const tagName = element.tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tagName)) {
      const fragment = doc.createDocumentFragment();
      while (element.firstChild) {
        fragment.appendChild(element.firstChild);
      }
      element.replaceWith(fragment);
      return;
    }

    Array.from(element.attributes).forEach((attribute) => {
      if (tagName === "a" && attribute.name === "href") {
        return;
      }
      element.removeAttribute(attribute.name);
    });

    if (tagName === "a") {
      const href = element.getAttribute("href");
      if (!href || !isSafeHref(href)) {
        const fragment = doc.createDocumentFragment();
        while (element.firstChild) {
          fragment.appendChild(element.firstChild);
        }
        element.replaceWith(fragment);
        return;
      }

      element.setAttribute("href", href);
      element.setAttribute("target", "_blank");
      element.setAttribute("rel", "noopener noreferrer");
    }
  });
}

export function sanitizeRichText(value: string) {
  if (!value?.trim()) {
    return "";
  }

  if (typeof window === "undefined") {
    return value;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${value}</div>`, "text/html");
  const container = doc.body.firstElementChild;

  if (!container) {
    return "";
  }

  sanitizeNode(container, doc);
  return container.innerHTML.trim();
}

export function getPlainTextFromHtml(value: string) {
  if (!value?.trim()) {
    return "";
  }

  if (typeof window === "undefined") {
    return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${value}</div>`, "text/html");
  return doc.body.textContent?.replace(/\s+/g, " ").trim() || "";
}

export function normalizeRichTextValue(value: string) {
  if (!value?.trim()) {
    return "";
  }

  if (HTML_TAG_PATTERN.test(value)) {
    return sanitizeRichText(value);
  }

  return convertPlainTextToHtml(value);
}
