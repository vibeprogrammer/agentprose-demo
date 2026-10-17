#!/usr/bin/env node

// src/cli/index.ts
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, relative, sep, dirname } from "node:path";
import { DOMParser as LinkeDOMParser } from "linkedom";

// src/core/util.ts
function abs(u, base) {
  if (!u) return void 0;
  try {
    return new URL(u.trim(), base).href;
  } catch {
    return void 0;
  }
}
function norm(u) {
  try {
    const x = new URL(u);
    x.hash = "";
    x.search = "";
    return (x.origin + x.pathname.replace(/\/index\.html?$/, "/").replace(/\/+$/, "")).toLowerCase();
  } catch {
    return u.toLowerCase();
  }
}
function slugOf(u) {
  try {
    const parts = new URL(u).pathname.replace(/\/index\.html?$/, "").replace(/\.html?$/, "").split("/").filter(Boolean);
    return decodeURIComponent(parts[parts.length - 1] || "");
  } catch {
    return "";
  }
}
function clean(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}
function iso(d) {
  if (!d) return void 0;
  const t = Date.parse(d);
  return isNaN(t) ? void 0 : new Date(t).toISOString();
}
function uniq(a) {
  return [...new Set(a.filter(Boolean))];
}
function words(s) {
  const m = s.match(/\S+/g);
  return m ? m.length : 0;
}
function readingMinutes(text) {
  return Math.max(1, Math.round(words(text) / 230));
}
function stripHtml(h) {
  return clean(h.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'"));
}
function parseHtml(h) {
  return new DOMParser().parseFromString(h, "text/html");
}
function sameOrigin(u, base) {
  try {
    return new URL(u, base).origin === new URL(base).origin;
  } catch {
    return false;
  }
}
async function fetchText(url, signal) {
  try {
    const r = await fetch(url, { signal, credentials: "same-origin", headers: { Accept: "*/*" } });
    if (!r.ok) return null;
    return await r.text();
  } catch {
    return null;
  }
}

// src/core/markdown.ts
var NOISE = 'script,style,noscript,template,iframe,object,embed,canvas,svg,form,button,input,select,textarea,nav,aside,footer,dialog,body>header,.site-header,[role=banner],[role=navigation],[role=complementary],[role=contentinfo],[hidden],[aria-hidden="true"],.sr-only,.visually-hidden,[data-agent-ignore],.share,.sharing,.social,.related,.comments,#comments,.advert,.ads,.ad,.adsbygoogle,.newsletter,.subscribe,.cookie,.breadcrumbs,.post-nav,.pagination,.toc,.table-of-contents';
var BLOCK = /^(P|DIV|SECTION|ARTICLE|MAIN|HEADER|FIGURE|FIGCAPTION|UL|OL|LI|BLOCKQUOTE|PRE|TABLE|H[1-6]|HR|DL|DT|DD|DETAILS|SUMMARY)$/;
function esc(s) {
  return s.replace(/([\\`*_[\]])/g, "\\$1");
}
function toMarkdown(root, base) {
  const out = inner(root, base, 0).replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n");
  return out.trim();
}
function inner(el, base, depth) {
  let s = "";
  el.childNodes.forEach((n) => s += node(n, base, depth));
  return s;
}
function node(n, base, depth) {
  if (n.nodeType === 3) {
    const t = (n.textContent || "").replace(/\s+/g, " ");
    return esc(t);
  }
  if (n.nodeType !== 1) return "";
  const e = n;
  const tag = e.tagName.toUpperCase();
  const kids2 = () => inner(e, base, depth);
  switch (tag) {
    case "H1":
    case "H2":
    case "H3":
    case "H4":
    case "H5":
    case "H6": {
      const t = clean(kids2());
      return t ? `

${"#".repeat(+tag[1])} ${t}

` : "";
    }
    case "P":
    case "SECTION":
    case "ARTICLE":
    case "MAIN":
    case "HEADER":
    case "FIGURE":
    case "DETAILS":
    case "DL":
      return `

${kids2().trim()}

`;
    case "DIV":
    case "SPAN":
    case "TIME":
    case "ABBR":
    case "SMALL":
    case "MARK":
    case "CITE":
    case "U":
    case "SUP":
    case "SUB":
    case "LABEL":
      return BLOCK.test(tag) ? `
${kids2()}
` : kids2();
    case "FIGCAPTION":
    case "SUMMARY":
    case "DT":
      return `

*${clean(kids2())}*

`;
    case "DD":
      return `
: ${clean(kids2())}
`;
    case "BR":
      return "  \n";
    case "HR":
      return "\n\n---\n\n";
    case "STRONG":
    case "B": {
      const t = kids2().trim();
      return t ? `**${t}**` : "";
    }
    case "EM":
    case "I": {
      const t = kids2().trim();
      return t ? `*${t}*` : "";
    }
    case "DEL":
    case "S":
      return `~~${kids2().trim()}~~`;
    case "CODE": {
      const t = e.textContent || "";
      const f = t.includes("`") ? "``" : "`";
      return `${f}${t}${f}`;
    }
    case "PRE": {
      const code = e.querySelector("code") || e;
      const m = ((code.getAttribute("class") || "") + " " + (e.getAttribute("class") || "")).match(/(?:language|lang)-([\w+#-]+)/) || [];
      const lang = m[1] || e.getAttribute("data-lang") || "";
      return `

\`\`\`${lang}
${(code.textContent || "").replace(/\n$/, "")}
\`\`\`

`;
    }
    case "A": {
      const t = clean(kids2());
      const href = e.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("javascript:")) return t;
      const u = abs(href, base);
      return t ? `[${t}](${u})` : "";
    }
    case "IMG": {
      const src = e.getAttribute("src") || e.getAttribute("data-src") || "";
      if (!src || src.startsWith("data:")) return "";
      return `![${clean(e.getAttribute("alt"))}](${abs(src, base)})`;
    }
    case "PICTURE": {
      const img = e.querySelector("img");
      return img ? node(img, base, depth) : "";
    }
    case "VIDEO":
    case "AUDIO": {
      const src = e.getAttribute("src") || e.querySelector("source")?.getAttribute("src");
      return src ? `[${tag.toLowerCase()}](${abs(src, base)})` : "";
    }
    case "BLOCKQUOTE":
      return "\n\n" + kids2().trim().replace(/\n{3,}/g, "\n\n").split("\n").map((l) => l.trim() ? "> " + l : ">").join("\n") + "\n\n";
    case "UL":
    case "OL": {
      let i = 0;
      const pad = "  ".repeat(depth);
      let s = "\n";
      e.childNodes.forEach((c) => {
        if (c.nodeType !== 1 || c.tagName.toUpperCase() !== "LI") return;
        i++;
        const body = inner(c, base, depth + 1).trim().replace(/\n{2,}/g, "\n");
        s += `${pad}${tag === "OL" ? i + "." : "-"} ${body}
`;
      });
      return depth ? s : s + "\n";
    }
    case "LI":
      return `
- ${clean(kids2())}
`;
    case "TABLE":
      return table(e, base, depth);
    default:
      return kids2();
  }
}
function table(t, base, depth) {
  const rows = [...t.querySelectorAll("tr")];
  if (!rows.length) return "";
  const cells = rows.map((r) => [...r.children].map((c) => clean(inner(c, base, depth)).replace(/\|/g, "\\|")));
  const n = Math.max(...cells.map((r) => r.length));
  const line = (r) => "| " + Array.from({ length: n }, (_, i) => r[i] || "").join(" | ") + " |";
  return "\n\n" + [line(cells[0]), line(Array(n).fill("---")), ...cells.slice(1).map(line)].join("\n") + "\n\n";
}

// src/core/extract.ts
var ARTICLE_TYPES = /^(Article|BlogPosting|NewsArticle|TechArticle|Report|ScholarlyArticle|SocialMediaPosting|LiveBlogPosting|HowTo|Recipe|Review|AnalysisNewsArticle|OpinionNewsArticle)$/;
var BODY_SELECTORS = [
  "[data-agent-content]",
  '[itemprop="articleBody"]',
  ".e-content",
  ".entry-content",
  ".post-content",
  ".article-content",
  ".article-body",
  ".post-body",
  ".gh-content",
  ".prose",
  ".markdown-body",
  ".content-body",
  "#content article"
];
function types(o) {
  const t = o["@type"];
  return Array.isArray(t) ? t : t ? [t] : [];
}
function jsonLd(doc) {
  const out = [];
  const walk2 = (x) => {
    if (!x || typeof x !== "object") return;
    if (Array.isArray(x)) return x.forEach(walk2);
    out.push(x);
    if (x["@graph"]) walk2(x["@graph"]);
  };
  doc.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
    try {
      walk2(JSON.parse(s.textContent || ""));
    } catch {
    }
  });
  return out;
}
function ldName(x) {
  if (!x) return void 0;
  if (typeof x === "string") return x;
  if (Array.isArray(x)) return ldName(x[0]);
  return x.name || x.headline || void 0;
}
function ldNames(x) {
  if (!x) return [];
  return (Array.isArray(x) ? x : [x]).map(ldName).filter(Boolean);
}
function ldImage(x) {
  if (!x) return void 0;
  if (typeof x === "string") return x;
  if (Array.isArray(x)) return ldImage(x[0]);
  return x.url || x.contentUrl;
}
function meta(doc, key) {
  const el = doc.querySelector(`meta[property="${key}"],meta[name="${key}"],meta[itemprop="${key}"]`);
  return clean(el?.getAttribute("content")) || void 0;
}
function metas(doc, key) {
  return [...doc.querySelectorAll(`meta[property="${key}"],meta[name="${key}"]`)].map((m) => clean(m.getAttribute("content"))).filter(Boolean);
}
function splitList(s) {
  return s ? s.split(/\s*,\s*/).map(clean).filter(Boolean) : [];
}
function findBody(doc, selector) {
  if (selector) {
    const el = doc.querySelector(selector);
    if (el) return el;
  }
  for (const s of BODY_SELECTORS) {
    const el = doc.querySelector(s);
    if (el && textLen(el) > 200) return el;
  }
  const arts = [...doc.querySelectorAll("article")].filter((a) => !a.parentElement?.closest("article"));
  if (arts.length === 1) return arts[0];
  if (arts.length > 1) {
    const best2 = arts.reduce((a, b) => textLen(b) > textLen(a) ? b : a);
    if (textLen(best2) > 0.6 * arts.reduce((n, a) => n + textLen(a), 0)) return best2;
  }
  const main2 = doc.querySelector('main,[role="main"]');
  if (main2) return main2;
  let best = null;
  let score = 0;
  doc.querySelectorAll("p").forEach((p) => {
    const parent = p.parentElement;
    if (!parent) return;
    const sc = [...parent.children].filter((c) => c.tagName === "P").reduce((n, c) => n + textLen(c), 0);
    if (sc > score) {
      score = sc;
      best = parent;
    }
  });
  return best || doc.body;
}
function textLen(el) {
  return (el.textContent || "").replace(/\s+/g, " ").length;
}
function cleanBody(doc, opts = {}) {
  const body = findBody(doc, opts.selector);
  if (!body) return null;
  const copy = body.cloneNode(true);
  const sel = [NOISE, ...opts.ignore || []].join(",");
  try {
    copy.querySelectorAll(sel).forEach((n) => n.remove());
  } catch {
    copy.querySelectorAll(NOISE).forEach((n) => n.remove());
  }
  return copy;
}
function extractPage(doc, url, opts = {}) {
  const lds = jsonLd(doc);
  const art = lds.find((o) => types(o).some((t) => ARTICLE_TYPES.test(t))) || {};
  const page = lds.find((o) => types(o).some((t) => /WebPage$/.test(t))) || {};
  const canonical = abs(doc.querySelector('link[rel="canonical"]')?.getAttribute("href"), url) || abs(meta(doc, "og:url"), url) || url.split("#")[0];
  const ogType = meta(doc, "og:type");
  const bodyEl = cleanBody(doc, opts);
  const h1 = bodyEl?.querySelector("h1") || doc.querySelector("h1");
  const title = clean(art.headline || art.name) || meta(doc, "og:title") || clean(h1?.textContent) || clean(doc.title);
  if (bodyEl) {
    const first = bodyEl.querySelector("h1");
    if (first && clean(first.textContent) === title) first.remove();
  }
  const markdown = bodyEl ? toMarkdown(bodyEl, canonical) : "";
  const timeEl = doc.querySelector('article time[datetime],time[datetime][itemprop="datePublished"],time.published,time[datetime]');
  const tags = uniq([
    ...splitList(Array.isArray(art.keywords) ? art.keywords.join(",") : art.keywords),
    ...metas(doc, "article:tag"),
    ...[...doc.querySelectorAll('a[rel~="tag"]')].map((a) => clean(a.textContent))
  ]);
  const categories = uniq([
    ...Array.isArray(art.articleSection) ? art.articleSection : [art.articleSection],
    ...metas(doc, "article:section"),
    ...[...doc.querySelectorAll('a[rel~="category"]')].map((a) => clean(a.textContent))
  ]);
  const authors = uniq([
    ...ldNames(art.author),
    ...metas(doc, "article:author").filter((a) => !/^https?:/.test(a)),
    meta(doc, "author"),
    clean(doc.querySelector('[rel="author"],.p-author,.author-name,[itemprop="author"] [itemprop="name"]')?.textContent)
  ]).slice(0, 5);
  const cards = doc.querySelectorAll("article").length;
  const isArticle = !!art["@type"] || ogType === "article" || cards === 1 && markdown.length > 1200 && !!timeEl;
  return {
    url: canonical,
    slug: slugOf(canonical),
    title,
    summary: clean(art.description) || meta(doc, "description") || meta(doc, "og:description"),
    description: meta(doc, "description"),
    published: iso(art.datePublished || meta(doc, "article:published_time") || timeEl?.getAttribute("datetime")),
    updated: iso(art.dateModified || meta(doc, "article:modified_time") || meta(doc, "og:updated_time")),
    authors: authors.length ? authors : void 0,
    tags: tags.length ? tags : void 0,
    categories: categories.length ? categories : void 0,
    image: abs(ldImage(art.image) || meta(doc, "og:image") || ldImage(page.primaryImageOfPage), canonical),
    lang: doc.documentElement.getAttribute("lang") || art.inLanguage || void 0,
    readingMinutes: markdown ? readingMinutes(markdown) : void 0,
    markdown,
    isArticle,
    source: "page"
  };
}
function extractSite(doc, url) {
  const lds = jsonLd(doc);
  const site = lds.find((o) => types(o).includes("WebSite")) || {};
  const org = lds.find((o) => types(o).some((t) => t === "Organization" || t === "Person")) || {};
  const feeds = [...doc.querySelectorAll('link[rel="alternate"]')].filter((l) => /(rss|atom|feed)\+(xml|json)|application\/json/.test(l.getAttribute("type") || "")).map((l) => abs(l.getAttribute("href"), url)).filter(Boolean);
  const origin = new URL(url).origin;
  return {
    name: clean(site.name) || meta(doc, "og:site_name") || meta(doc, "application-name") || clean(org.name) || void 0,
    description: clean(site.description) || void 0,
    url: abs(site.url, url) || origin + "/",
    lang: doc.documentElement.getAttribute("lang") || void 0,
    logo: abs(ldImage(org.logo) || doc.querySelector('link[rel~="icon"]')?.getAttribute("href"), url),
    feeds: uniq(feeds),
    generator: meta(doc, "generator")
  };
}

// src/core/feeds.ts
function txt(el) {
  return clean(el?.textContent);
}
function kids(el, name, out = []) {
  for (const c of el.children) {
    const n = (c.localName || c.tagName).toLowerCase();
    if (n === name.toLowerCase() || n.endsWith(":" + name.toLowerCase())) out.push(c);
    kids(c, name, out);
  }
  return out;
}
function kid(el, name) {
  const n = name.toLowerCase();
  for (const c of el.children) {
    const t = (c.localName || c.tagName).toLowerCase();
    if (t === n || t.endsWith(":" + n)) return c;
  }
  return void 0;
}
function summarize(html) {
  if (!html) return void 0;
  const t = stripHtml(html);
  return t.length > 300 ? t.slice(0, 297).replace(/\s+\S*$/, "") + "\u2026" : t || void 0;
}
function parseFeed(text, base) {
  const t = text.trimStart();
  if (t.startsWith("{")) {
    try {
      const j = JSON.parse(t);
      if (!Array.isArray(j.items)) return null;
      return j.items.map((i) => {
        const url = abs(i.url || i.external_url || i.id, base);
        if (!url) return null;
        const html = i.content_html;
        return {
          url,
          id: i.id ? String(i.id) : void 0,
          slug: slugOf(url),
          title: clean(i.title) || summarize(html || i.content_text)?.slice(0, 80) || url,
          summary: clean(i.summary) || summarize(html || i.content_text),
          published: iso(i.date_published),
          updated: iso(i.date_modified),
          authors: (i.authors || (i.author ? [i.author] : [])).map((a) => clean(a.name)).filter(Boolean),
          tags: Array.isArray(i.tags) ? i.tags.map(clean) : void 0,
          image: abs(i.image || i.banner_image, base),
          html,
          readingMinutes: html || i.content_text ? readingMinutes(stripHtml(html || i.content_text)) : void 0,
          source: "jsonfeed"
        };
      }).filter(Boolean);
    } catch {
      return null;
    }
  }
  if (!t.startsWith("<")) return null;
  const doc = new DOMParser().parseFromString(t, "text/xml");
  const root = doc.documentElement;
  if (!root || kids(root, "parsererror").length || /parsererror/i.test(root.localName || "")) return null;
  const name = (root.localName || root.tagName).toLowerCase().replace(/^.*:/, "");
  if (name === "feed") {
    return kids(root, "entry").map((e) => {
      const links = kids(e, "link");
      const link = links.find((l) => (l.getAttribute("rel") || "alternate") === "alternate") || links[0];
      const url = abs(link?.getAttribute("href"), base) || txt(kid(e, "id"));
      const content = kid(e, "content");
      const html = content ? content.textContent || void 0 : void 0;
      const sum = kid(e, "summary");
      return {
        url,
        id: txt(kid(e, "id")) || void 0,
        slug: slugOf(url),
        title: stripHtml(kid(e, "title")?.textContent || "") || url,
        summary: summarize(sum?.textContent || html),
        published: iso(txt(kid(e, "published")) || txt(kid(e, "updated"))),
        updated: iso(txt(kid(e, "updated"))),
        authors: kids(e, "author").map((a) => txt(kid(a, "name"))).filter(Boolean),
        tags: kids(e, "category").map((c) => clean(c.getAttribute("label") || c.getAttribute("term"))).filter(Boolean),
        html,
        readingMinutes: html ? readingMinutes(stripHtml(html)) : void 0,
        source: "atom"
      };
    });
  }
  if (name === "rss" || name === "rdf") {
    return kids(root, "item").map((i) => {
      const url = abs(txt(kid(i, "link")) || txt(kid(i, "guid")), base) || "";
      const encoded = kid(i, "encoded");
      const desc = kid(i, "description")?.textContent || void 0;
      const html = encoded?.textContent || void 0;
      const media = kids(i, "content").find((m) => /image/.test(m.getAttribute("medium") || m.getAttribute("type") || "")) || kid(i, "enclosure");
      return {
        url,
        id: txt(kid(i, "guid")) || void 0,
        slug: slugOf(url),
        title: stripHtml(kid(i, "title")?.textContent || "") || url,
        summary: summarize(desc || html),
        published: iso(txt(kid(i, "pubDate")) || txt(kid(i, "date"))),
        authors: [...kids(i, "creator"), ...kids(i, "author")].map(txt).filter(Boolean),
        tags: kids(i, "category").map(txt).filter(Boolean),
        image: media && /image/.test(media.getAttribute("type") || media.getAttribute("medium") || "image") ? abs(media.getAttribute("url"), base) : void 0,
        html: html || (desc && desc.length > 600 ? desc : void 0),
        readingMinutes: html ? readingMinutes(stripHtml(html)) : void 0,
        source: "rss"
      };
    }).filter((p) => p.url);
  }
  return null;
}
function parseSitemap(text, base) {
  const doc = new DOMParser().parseFromString(text, "text/xml");
  const root = doc.documentElement;
  const out = { urls: [], sitemaps: [] };
  if (!root) return out;
  const isIndex = (root.localName || root.tagName).toLowerCase() === "sitemapindex";
  for (const n of kids(root, isIndex ? "sitemap" : "url")) {
    const loc = abs(txt(kid(n, "loc")), base);
    if (!loc) continue;
    if (isIndex) out.sitemaps.push(loc);
    else out.urls.push({ url: loc, updated: iso(txt(kid(n, "lastmod"))) });
  }
  return out;
}
function parseLlmsTxt(text, base) {
  const name = text.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const description = text.match(/^>\s+(.+)$/m)?.[1]?.trim();
  const links = [];
  let section = "";
  for (const line of text.split("\n")) {
    const h = line.match(/^##\s+(.+)/);
    if (h) section = h[1].trim();
    const m = line.match(/^\s*[-*]\s*\[([^\]]+)\]\(([^)\s]+)\)\s*:?\s*(.*)$/);
    if (m) {
      const url = abs(m[2], base);
      if (url) links.push({ url, slug: slugOf(url), title: m[1].trim(), summary: m[3].trim() || void 0, source: "llms.txt", ...section ? { group: section } : {} });
    }
  }
  return { name, description, links };
}
function titleFromSlug(url) {
  const s = slugOf(url).replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/[-_]+/g, " ").trim();
  return s ? s[0].toUpperCase() + s.slice(1) : url;
}

// src/core/source.ts
var FEED_PATHS = ["feed.json", "index.xml", "feed.xml", "atom.xml", "rss.xml", "feed/", "rss/"];
var NOT_POST = /\/(tags?|categor(y|ies)|topics?|authors?|page|search|archives?|feed|wp-content|assets|static|static\/.*|cdn-cgi)(\/|$)|\.(xml|json|txt|pdf|png|jpe?g|gif|svg|webp|css|js)$/i;
function merge(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (v === void 0 || v === "" || Array.isArray(v) && !v.length) continue;
    const cur = out[k];
    if (cur === void 0 || cur === "" || Array.isArray(cur) && !cur.length || k === "title" && a.source === "sitemap") out[k] = v;
  }
  if (a.source === "sitemap" && b.source) out.source = b.source;
  return out;
}
function autoSource(cfg, doc = document, loc = location.href) {
  const base = cfg.baseUrl || new URL(loc).origin + "/";
  const baseDir = base.replace(/\/?$/, "/");
  let pending;
  const cacheKey = "agentprose:" + baseDir;
  async function build2() {
    const ttl = cfg.cacheTtl ?? 600;
    if (ttl > 0) {
      try {
        const c = JSON.parse(sessionStorage.getItem(cacheKey) || "null");
        if (c && Date.now() - c.t < ttl * 1e3) return c.v;
      } catch {
      }
    }
    const byUrl = /* @__PURE__ */ new Map();
    const sources = [];
    const site = {};
    const add = (p) => {
      if (!p.url || !sameOrigin(p.url, base)) return;
      const k = norm(p.url);
      const cur = byUrl.get(k);
      byUrl.set(k, cur ? merge(cur, p) : p);
    };
    const max = cfg.maxPosts ?? 2e3;
    const indexUrl = cfg.index ?? (doc.querySelector('link[rel="agentprose-index"]')?.getAttribute("href") || baseDir + "agentprose.json");
    if (indexUrl) {
      const t = await fetchText(new URL(indexUrl, base).href);
      try {
        const j = t && JSON.parse(t);
        if (j && Array.isArray(j.posts)) {
          j.posts.slice(0, max).forEach((p) => add({ ...p, url: new URL(p.url, base).href, source: p.source || "index" }));
          Object.assign(site, j.site || {});
          sources.push("index");
        }
      } catch {
      }
    }
    if (!sources.length) {
      const declared = cfg.feeds?.length ? cfg.feeds : extractSite(doc, loc).feeds || [];
      const candidates = declared.length ? declared : FEED_PATHS.map((p) => baseDir + p);
      for (const f of candidates) {
        const t = await fetchText(new URL(f, base).href);
        const posts = t ? parseFeed(t, base) : null;
        if (posts) {
          posts.slice(0, max).forEach(add);
          sources.push("feed");
          site.feeds = [new URL(f, base).href];
          if (!cfg.feeds || cfg.feeds.length < 2) break;
        }
      }
      if (cfg.sitemap !== false) {
        const queue = [cfg.sitemap || baseDir + "sitemap.xml"];
        let n = 0;
        while (queue.length && n < (cfg.maxSitemaps ?? 5) && byUrl.size < max) {
          const sm = queue.shift();
          n++;
          const t = await fetchText(new URL(sm, base).href);
          if (!t || !t.includes("<")) continue;
          const r = parseSitemap(t, base);
          queue.push(...r.sitemaps.sort((a, b) => +/post/.test(b) - +/post/.test(a)));
          for (const u of r.urls) {
            const path = new URL(u.url).pathname;
            if (path === new URL(baseDir).pathname || NOT_POST.test(path)) continue;
            if (byUrl.size >= max) break;
            add({ url: u.url, slug: slugOf(u.url), title: titleFromSlug(u.url), updated: u.updated, source: "sitemap" });
          }
          if (r.urls.length) site.sitemap = new URL(sm, base).href;
        }
        if (site.sitemap) sources.push("sitemap");
      }
    }
    if (cfg.llmsTxt !== false) {
      const u = typeof cfg.llmsTxt === "string" ? cfg.llmsTxt : baseDir + "llms.txt";
      const t = await fetchText(new URL(u, base).href);
      if (t && /^#\s/m.test(t) && !/^\s*</.test(t)) {
        const l = parseLlmsTxt(t, base);
        site.llmsTxt = new URL(u, base).href;
        site.name || (site.name = l.name);
        site.description || (site.description = l.description);
        l.links.forEach((p) => {
          const k = norm(p.url);
          const cur = byUrl.get(k);
          if (cur) byUrl.set(k, merge(cur.source === "sitemap" ? { ...cur, title: p.title, source: "llms.txt" } : cur, p));
          else if (sameOrigin(p.url, base) && !NOT_POST.test(new URL(p.url).pathname)) add(p);
        });
        sources.push("llms.txt");
      }
    }
    const v = { posts: [...byUrl.values()], site, sources };
    if (ttl > 0) {
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify({ t: Date.now(), v: { ...v, posts: v.posts.map(({ html, markdown, ...p }) => p) } }));
      } catch {
      }
    }
    return v;
  }
  const corpus = () => {
    if (!pending) {
      pending = build2().then((c) => {
        const here = extractPage(doc, loc, { selector: cfg.contentSelector, ignore: cfg.ignoreSelectors });
        if (here.isArticle) {
          const k = norm(here.url);
          const i = c.posts.findIndex((p) => norm(p.url) === k);
          const { isArticle, description, ...post } = here;
          if (i >= 0) c.posts[i] = merge(post, c.posts[i]);
          else c.posts.unshift(post);
        }
        return c;
      });
      pending.catch(() => pending = void 0);
    }
    return pending;
  };
  const find = (posts, ref) => {
    if (ref.url) {
      const k = norm(new URL(ref.url, base).href);
      const p = posts.find((x) => norm(x.url) === k);
      if (p) return p;
    }
    if (ref.id) {
      const p = posts.find((x) => x.id === ref.id);
      if (p) return p;
    }
    const slug = (ref.slug || (ref.url ? slugOf(new URL(ref.url, base).href) : "")).toLowerCase();
    return slug ? posts.find((x) => (x.slug || slugOf(x.url)).toLowerCase() === slug) : void 0;
  };
  const pagefind = cfg.pagefind === false ? void 0 : cfg.pagefind || (doc.querySelector('[data-pagefind-body],script[src*="pagefind"],link[href*="pagefind"]') ? baseDir + "pagefind/pagefind.js" : void 0);
  let pf;
  return {
    name: "auto",
    corpus,
    search: pagefind ? async (q, o = {}) => {
      pf || (pf = import(
        /* @vite-ignore */
        new URL(pagefind, base).href
      ).then(async (m) => (await m.init?.(), m)));
      const r = await (await pf).search(q);
      const data = await Promise.all((r?.results || []).slice(0, o.limit || 10).map((x) => x.data()));
      return {
        items: data.map((d) => ({ url: abs(d.url, base), title: d.meta?.title || d.url, summary: stripHtml(d.excerpt || ""), image: d.meta?.image, source: "pagefind" }))
      };
    } : void 0,
    async list(opts = {}) {
      const { posts } = await corpus();
      return filterPosts(posts, opts);
    },
    async get(ref) {
      const { posts } = await corpus();
      const hit = find(posts, ref);
      const url = hit?.url || (ref.url ? new URL(ref.url, base).href : void 0);
      if (hit?.markdown) return hit;
      const md = hit?.md;
      if (md) {
        const t2 = await fetchText(new URL(md, base).href);
        if (t2) return { ...hit, markdown: t2 };
      }
      if (hit?.html) {
        const md2 = toMarkdown(parseHtml(hit.html).body, hit.url);
        if (md2.length > 400 || !url) return { ...hit, markdown: md2 };
      }
      if (!url || !sameOrigin(url, base)) return hit || null;
      if (norm(url) === norm(loc)) {
        const { isArticle: isArticle2, description: description2, ...p2 } = extractPage(doc, loc, { selector: cfg.contentSelector, ignore: cfg.ignoreSelectors });
        return hit ? merge(p2, hit) : p2;
      }
      const t = await fetchText(url);
      if (!t) return hit || null;
      const { isArticle, description, ...p } = extractPage(parseHtml(t), url, { selector: cfg.contentSelector, ignore: cfg.ignoreSelectors });
      const full = hit ? merge(p, hit) : p;
      if (hit) Object.assign(hit, { markdown: full.markdown, title: hit.source === "sitemap" ? p.title : hit.title });
      return full;
    },
    async taxonomies() {
      const { posts } = await corpus();
      return aggregate(posts);
    },
    async site() {
      return (await corpus()).site;
    }
  };
}
function aggregate(posts) {
  const count = (key) => {
    const m = /* @__PURE__ */ new Map();
    posts.forEach(
      (p) => (p[key] || []).forEach((name) => {
        const k = name.toLowerCase();
        const t = m.get(k) || { name, count: 0 };
        t.count++;
        m.set(k, t);
      })
    );
    return [...m.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  };
  return { tags: count("tags"), categories: count("categories"), authors: count("authors") };
}
var has = (list, v) => !!list?.some((x) => x.toLowerCase() === v.toLowerCase());
function filterPosts(posts, o = {}) {
  const since = o.since ? Date.parse(o.since) : NaN;
  const until = o.until ? Date.parse(o.until) : NaN;
  const time = (p) => Date.parse(p.published || p.updated || "") || 0;
  let r = posts.filter(
    (p) => (!o.tag || has(p.tags, o.tag)) && (!o.category || has(p.categories, o.category)) && (!o.author || has(p.authors, o.author)) && (isNaN(since) || time(p) >= since) && (isNaN(until) || time(p) <= until)
  );
  if (o.sort !== "relevance") r = [...r].sort((a, b) => o.sort === "oldest" ? time(a) - time(b) : time(b) - time(a));
  const off = o.offset || 0;
  return { items: r.slice(off, off + (o.limit ?? r.length)), total: r.length };
}

// src/cli/index.ts
globalThis.DOMParser || (globalThis.DOMParser = LinkeDOMParser);
var VERSION = true ? "0.1.0" : "dev";
var HELP = `agentprose ${VERSION} \u2014 make a site's content readable by AI agents through WebMCP

Usage:
  agentprose build <dir> --base-url <url> [options]   Index a static site's HTML output
  agentprose inspect <url>                            Show what agents can read on a live page
  agentprose --version | --help

build options:
  --base-url <url>    Public URL of the site root (required), e.g. https://example.com/
  --out <dir>         Where to write agentprose.json and agentprose/ (default: <dir>)
  --include <regex>   Only index pages whose path matches (e.g. "^/(posts|blog)/")
  --exclude <regex>   Skip pages whose path matches
  --all               Index every page, not only article-like ones
  --inline            Put full markdown inside agentprose.json (small sites) instead of one .md per post
  --llms              Also write llms.txt (skipped if one exists)
  --content <sel>     CSS selector of the article body, if auto-detection picks the wrong element

Works with the output folder of Hugo (public/), Jekyll (_site/), Astro (dist/), Eleventy (_site/),
Next.js static export (out/), Gatsby (public/), Docusaurus (build/) and any other generator.`;
function args(argv) {
  const o = {};
  const pos = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const k = a.slice(2);
      const v = argv[i + 1];
      if (v !== void 0 && !v.startsWith("--") && !["all", "inline", "llms", "help", "version", "json"].includes(k)) {
        o[k] = v;
        i++;
      } else o[k] = true;
    } else pos.push(a);
  }
  return { o, pos };
}
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name.startsWith(".") || name === "node_modules") continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (/\.html?$/i.test(name)) out.push(p);
  }
  return out;
}
var SKIP = /(^|\/)(404|500)\.html?$|\/(tags?|categor(y|ies)|topics?|authors?|page|search|archives?)(\/|$)/i;
async function build(dir, o) {
  const base = String(o["base-url"] || "").replace(/\/?$/, "/");
  if (!/^https?:\/\//.test(base)) throw new Error("--base-url is required, e.g. --base-url https://example.com/");
  const outDir = String(o.out || dir);
  const inc = o.include ? new RegExp(String(o.include)) : void 0;
  const exc = o.exclude ? new RegExp(String(o.exclude)) : void 0;
  const files = walk(dir);
  const posts = [];
  let site = {};
  for (const file of files) {
    const rel = "/" + relative(dir, file).split(sep).join("/");
    const path = rel.replace(/index\.html?$/i, "").replace(/\.html?$/i, "");
    const url = new URL(path.replace(/^\//, ""), base).href;
    const html = readFileSync(file, "utf8");
    const doc = new DOMParser().parseFromString(html, "text/html");
    if (rel === "/index.html") site = extractSite(doc, url);
    if (SKIP.test(rel) || inc && !inc.test(path) || exc && exc.test(path)) continue;
    if (doc.querySelector('meta[http-equiv="refresh"]')) continue;
    const p = extractPage(doc, url, { selector: o.content ? String(o.content) : void 0 });
    if (!o.all && !p.isArticle) continue;
    const { isArticle, description, markdown, source, ...meta2 } = p;
    const rec = { ...meta2, text: stripHtml(markdown || "").slice(0, 1500) };
    if (o.inline) rec.markdown = markdown;
    else {
      const slug = (path.replace(/^\/|\/$/g, "") || "index").replace(/[^\w\-/.]+/g, "-");
      const mdPath = `agentprose/posts/${slug}.md`;
      mkdirSync(dirname(join(outDir, mdPath)), { recursive: true });
      writeFileSync(join(outDir, mdPath), `# ${p.title}

${markdown}
`);
      rec.md = new URL(mdPath, base).pathname;
    }
    posts.push(rec);
  }
  posts.sort((a, b) => (b.published || "").localeCompare(a.published || ""));
  const index = { version: 1, generator: `agentprose ${VERSION}`, generated: (/* @__PURE__ */ new Date()).toISOString(), site: { ...site, url: base }, posts };
  mkdirSync(outDir, { recursive: true });
  const json = JSON.stringify(index);
  writeFileSync(join(outDir, "agentprose.json"), json);
  if (o.llms && !existsSync(join(outDir, "llms.txt"))) {
    const lines = [`# ${site.name || new URL(base).host}`, "", site.description ? `> ${site.description}
` : "", "## Posts", "", ...posts.map((p) => `- [${p.title}](${p.url})${p.summary ? ": " + p.summary : ""}`)];
    writeFileSync(join(outDir, "llms.txt"), lines.filter((l, i) => l || lines[i - 1]).join("\n") + "\n");
  }
  return { pages: files.length, posts: posts.length, bytes: json.length };
}
async function inspect(url) {
  const r = await fetch(url, { headers: { "User-Agent": `agentprose-inspect/${VERSION}` } });
  const html = await r.text();
  const doc = new DOMParser().parseFromString(html, "text/html");
  const page = extractPage(doc, r.url || url);
  const site = extractSite(doc, r.url || url);
  const src = autoSource({ cacheTtl: 0, pagefind: false }, doc, r.url || url);
  const corpus = await src.corpus();
  const words2 = (page.markdown || "").split(/\s+/).filter(Boolean).length;
  const ld = [...doc.querySelectorAll('script[type="application/ld+json"]')].length;
  const checks = [
    ["Article detected", page.isArticle, page.isArticle ? `"${page.title}" (${words2} words)` : "no Article JSON-LD, og:type=article or long <article>"],
    ["Structured data (JSON-LD)", ld > 0, `${ld} block(s)`],
    ["Published date", !!page.published, page.published || "missing"],
    ["Author", !!page.authors?.length, page.authors?.join(", ") || "missing"],
    ["Feed", corpus.sources.includes("feed") || corpus.sources.includes("index"), site.feeds?.join(", ") || corpus.site.feeds?.join(", ") || "none found"],
    ["Sitemap", corpus.sources.includes("sitemap"), corpus.site.sitemap || "none found"],
    ["llms.txt", corpus.sources.includes("llms.txt"), corpus.site.llmsTxt || "none found"],
    ["WebMCP tools on page", /modelContext|agentprose/.test(html), /agentprose/.test(html) ? "agentprose installed" : "none (add the agentprose script tag)"]
  ];
  return { url: r.url || url, status: r.status, title: page.title, posts: corpus.posts.length, sources: corpus.sources, checks, score: Math.round(checks.filter((c) => c[1]).length / checks.length * 100) };
}
async function main() {
  const { o, pos } = args(process.argv.slice(2));
  if (o.version) return console.log(VERSION);
  const [cmd, target] = pos;
  if (!cmd || o.help) return console.log(HELP);
  if (cmd === "build") {
    if (!target) throw new Error("build needs a directory, e.g. agentprose build public --base-url https://example.com/");
    const t0 = Date.now();
    const r = await build(target, o);
    console.log(`agentprose: indexed ${r.posts} posts from ${r.pages} HTML pages \u2192 ${join(String(o.out || target), "agentprose.json")} (${(r.bytes / 1024).toFixed(1)} KB) in ${Date.now() - t0} ms`);
    return;
  }
  if (cmd === "inspect") {
    if (!target) throw new Error("inspect needs a URL");
    const r = await inspect(target);
    if (o.json) return console.log(JSON.stringify(r, null, 2));
    console.log(`
${r.title}
${r.url} (HTTP ${r.status})
`);
    for (const [name, ok, detail] of r.checks) console.log(`${ok ? "\u2714" : "\u2718"} ${name.padEnd(28)} ${detail}`);
    console.log(`
Posts discoverable: ${r.posts} (via ${r.sources.join(", ") || "page only"})
Agent-readiness: ${r.score}/100
`);
    return;
  }
  throw new Error(`unknown command "${cmd}". Try --help.`);
}
var isMain = process.argv[1] && /cli(\.js|\.ts)?$|agentprose$/.test(process.argv[1]);
if (isMain) main().catch((e) => {
  console.error("agentprose:", e.message);
  process.exit(1);
});
export {
  build,
  inspect
};
