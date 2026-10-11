import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { Marked } from "marked"

import {
  COPY,
  DIST,
  LANGUAGES,
  ROOT,
  escapeHtml,
  normalizeSlash,
  outputFileForRoute,
  pairedRoute,
  parseSummary,
  readingMinutes,
  resolveContentHref,
  slugify,
  stripMarkdown,
} from "./content.mjs"

const expectedDist = path.resolve(ROOT, "dist")
if (path.resolve(DIST) !== expectedDist || !expectedDist.startsWith(`${path.resolve(ROOT)}${path.sep}`)) {
  throw new Error(`Refusing to write outside the repository: ${DIST}`)
}

await rm(DIST, { force: true, recursive: true })
await mkdir(DIST, { recursive: true })

const summaries = await Promise.all(LANGUAGES.map(parseSummary))
const allEntries = summaries.flat()
const routeBySource = new Map(
  allEntries.map((entry) => [normalizeSlash(path.relative(ROOT, entry.sourcePath)), entry.route]),
)

const documents = []
for (const entries of summaries) {
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]
    const markdown = await readFile(entry.sourcePath, "utf8")
    documents.push({
      ...entry,
      index,
      markdown,
      previous: entries[index - 1] ?? null,
      next: entries[index + 1] ?? null,
      alternateRoute: pairedRoute(entry, allEntries),
    })
  }
}

for (const document of documents) {
  const html = renderDocument(document, summaries.find((entries) => entries[0].language === document.language))
  const output = outputFileForRoute(document.route)
  await mkdir(path.dirname(output), { recursive: true })
  await writeFile(output, html, "utf8")
}

await cp(path.join(ROOT, "assets"), path.join(DIST, "content", "assets"), { recursive: true })
await cp(path.join(ROOT, "assets", "favicon.png"), path.join(DIST, "favicon.png"))
for (const language of LANGUAGES) {
  await cp(path.join(ROOT, language, "assets"), path.join(DIST, "content", language, "assets"), { recursive: true })
}
await cp(path.join(ROOT, "src", "site.css"), path.join(DIST, "site.css"))
await cp(path.join(ROOT, "src", "site.js"), path.join(DIST, "site.js"))

const searchIndex = documents.map((document) => ({
  language: document.language,
  route: document.route,
  title: document.title,
  chapter: document.index,
  content: stripMarkdown(document.markdown),
}))
await writeFile(path.join(DIST, "search-index.json"), `${JSON.stringify(searchIndex)}\n`, "utf8")

console.log(`Built ${documents.length} whitepaper pages into ${normalizeSlash(path.relative(ROOT, DIST))}/`)

function renderDocument(document, entries) {
  const copy = COPY[document.language]
  const headings = []
  const slugCounts = new Map()
  const renderer = {
    heading({ tokens, depth }) {
      const label = this.parser.parseInline(tokens)
      const plain = stripMarkdown(tokens.map((token) => token.raw ?? token.text ?? "").join(""))
      const base = slugify(plain)
      const count = slugCounts.get(base) ?? 0
      slugCounts.set(base, count + 1)
      const id = count === 0 ? base : `${base}-${count + 1}`
      if (depth >= 2 && depth <= 3) headings.push({ depth, id, label: plain })
      return `<h${depth} id="${escapeHtml(id)}">${label}<a class="heading-anchor" href="#${escapeHtml(id)}" aria-label="Link to ${escapeHtml(plain)}">#</a></h${depth}>`
    },
    link({ href, title, tokens }) {
      const label = this.parser.parseInline(tokens)
      const resolved = resolveContentHref(href, document, routeBySource)
      const external = /^(?:https?:)?\/\//i.test(resolved)
      const attributes = [
        `href="${escapeHtml(resolved)}"`,
        title ? `title="${escapeHtml(title)}"` : "",
        external ? 'target="_blank" rel="noopener noreferrer"' : "",
      ].filter(Boolean).join(" ")
      return `<a ${attributes}>${label}</a>`
    },
    image({ href, title, text }) {
      const resolved = resolveContentHref(href, document, routeBySource)
      return `<figure class="document-figure"><img src="${escapeHtml(resolved)}" alt="${escapeHtml(text)}" loading="lazy" decoding="async"${title ? ` title="${escapeHtml(title)}"` : ""}><figcaption>${escapeHtml(text)}</figcaption></figure>`
    },
  }

  const marked = new Marked({ gfm: true, renderer })
  let body = marked.parse(document.markdown)
  const isLanding = document.index === 0
  // The reader masthead owns the document title; avoid a second Markdown H1.
  body = body.replace(/^<h1[^>]*>[\s\S]*?<\/h1>\s*/i, "")

  const chapterNumber = document.index === 0 ? "00" : String(document.index).padStart(2, "0")
  const description = stripMarkdown(document.markdown).slice(0, 180)
  const navigation = entries.map((entry, index) => navigationItem(entry, index, document.route)).join("")
  const outline = headings.length
    ? headings.map((heading) => `<a class="outline-link outline-level-${heading.depth}" href="#${escapeHtml(heading.id)}">${escapeHtml(heading.label)}</a>`).join("")
    : `<p class="outline-empty">${escapeHtml(copy.searchHint)}</p>`
  const pageBody = isLanding
    ? landingMarkup(document, body, entries, copy)
    : chapterMarkup(document, body, chapterNumber, copy)

  return `<!doctype html>
<html lang="${copy.htmlLang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#000000">
  <meta name="color-scheme" content="dark">
  <meta name="description" content="${escapeHtml(description)}">
  <title>${escapeHtml(document.title)} · DI Whitepaper</title>
  <link rel="icon" type="image/png" sizes="512x512" href="/favicon.png?v=189fe8a99a2d">
  <link rel="stylesheet" href="/site.css">
  <link rel="alternate" hreflang="${document.language === "en" ? "zh-CN" : "en"}" href="${escapeHtml(document.alternateRoute)}">
</head>
<body data-language="${document.language}">
  <a class="skip-link" href="#document">${escapeHtml(copy.skip)}</a>
  <div class="reading-progress" aria-hidden="true"><span></span></div>
  <div class="ambient ambient-one" aria-hidden="true"></div>
  <div class="ambient ambient-two" aria-hidden="true"></div>
  <canvas class="edge-waves" data-edge-waves aria-hidden="true"></canvas>
  <header class="site-header">
    <a class="brand" href="${document.language === "en" ? "/" : "/zh/"}" aria-label="DI Whitepaper home">
      <img src="/content/assets/di-logo-square.png" alt="" width="38" height="38">
      <span><strong>DI</strong><small>${escapeHtml(copy.documentLabel.replace("DI / ", ""))}</small></span>
    </a>
    <div class="header-actions">
      <button class="search-trigger" type="button" data-search-open aria-label="${escapeHtml(copy.search)}">
        ${searchIcon()}<span>${escapeHtml(copy.search)}</span><kbd>⌘ K</kbd>
      </button>
      <a class="language-switch" href="${escapeHtml(document.alternateRoute)}" hreflang="${document.language === "en" ? "zh-CN" : "en"}">${escapeHtml(copy.alternateLabel)}</a>
      <button class="menu-trigger" type="button" data-menu-toggle aria-controls="chapter-sidebar" aria-expanded="false" aria-label="${escapeHtml(copy.menu)}">${menuIcon()}</button>
    </div>
  </header>

  <div class="reader-shell">
    <aside class="chapter-sidebar" id="chapter-sidebar" aria-label="${escapeHtml(copy.contents)}">
      <div class="sidebar-heading"><span>${escapeHtml(copy.contents)}</span><b>${String(entries.length - 1).padStart(2, "0")}</b></div>
      <nav class="chapter-nav">${navigation}</nav>
      <div class="sidebar-footer"><span>${escapeHtml(copy.version)}</span><i></i></div>
    </aside>
    <button class="sidebar-backdrop" type="button" data-menu-close aria-label="${escapeHtml(copy.close)}"></button>

    <main class="reader-main" id="document">
      ${pageBody}
      ${pagination(document, copy)}
      <footer class="document-footer"><span>© 2026 DI Foundation</span><span>${escapeHtml(copy.version)}</span></footer>
    </main>

    <aside class="page-outline" aria-label="${escapeHtml(copy.onThisPage)}">
      <div class="outline-label">${escapeHtml(copy.onThisPage)}</div>
      <nav>${outline}</nav>
      <div class="outline-signal"><span></span>DI / INTELLIGENCE</div>
    </aside>
  </div>

  <dialog class="search-dialog" data-search-dialog>
    <div class="search-panel">
      <form method="dialog" class="search-header">
        ${searchIcon()}
        <input type="search" autocomplete="off" placeholder="${escapeHtml(copy.searchPlaceholder)}" aria-label="${escapeHtml(copy.searchPlaceholder)}" data-search-input>
        <button type="submit" aria-label="${escapeHtml(copy.close)}">ESC</button>
      </form>
      <p class="search-hint" data-search-hint>${escapeHtml(copy.searchHint)}</p>
      <div class="search-results" data-search-results aria-live="polite"></div>
      <template data-search-empty><p class="search-empty">${escapeHtml(copy.searchEmpty)}</p></template>
    </div>
  </dialog>
  <script src="/site.js" defer></script>
</body>
</html>`
}

function navigationItem(entry, index, activeRoute) {
  const number = String(index).padStart(2, "0")
  const active = entry.route === activeRoute
  return `<a class="chapter-link${active ? " is-active" : ""}" href="${entry.route}"${active ? ' aria-current="page"' : ""}><span>${number}</span><strong>${escapeHtml(entry.title)}</strong></a>`
}

function landingMarkup(document, body, entries, copy) {
  const firstChapter = entries[1]
  return `<article class="paper landing-paper">
    <section class="landing-hero">
      <div class="landing-visual"><img src="/content/assets/di-home-banner.png" alt="" width="1500" height="500"></div>
      <div class="landing-copy">
        <div class="landing-heading">
          <p class="eyebrow"><span></span>${escapeHtml(copy.documentLabel)}</p>
          <h1>${escapeHtml(document.title)}</h1>
        </div>
        <div class="landing-source">${body}</div>
        <a class="primary-action" href="${firstChapter.route}">${escapeHtml(copy.readChapter)} ${arrowIcon()}</a>
      </div>
    </section>
    <section class="chapter-grid" id="contents" aria-label="${escapeHtml(copy.contents)}">
      ${entries.slice(1).map((entry, index) => `<a href="${entry.route}"><span>${String(index + 1).padStart(2, "0")}</span><strong>${escapeHtml(entry.title)}</strong>${arrowIcon()}</a>`).join("")}
    </section>
  </article>`
}

function chapterMarkup(document, body, chapterNumber, copy) {
  return `<article class="paper">
    <header class="document-masthead">
      <p class="eyebrow"><span></span>${escapeHtml(copy.chapterLabel)} ${chapterNumber}</p>
      <h1>${escapeHtml(document.title)}</h1>
      <div class="document-meta"><span>${readingMinutes(document.markdown, document.language)} ${escapeHtml(copy.minutes)}</span><span>${escapeHtml(copy.version)}</span></div>
    </header>
    <div class="document-content">${body}</div>
  </article>`
}

function pagination(document, copy) {
  const previous = document.previous
    ? `<a class="pagination-link previous" href="${document.previous.route}"><span>${escapeHtml(copy.previous)}</span><strong>${escapeHtml(document.previous.title)}</strong></a>`
    : "<span></span>"
  const next = document.next
    ? `<a class="pagination-link next" href="${document.next.route}"><span>${escapeHtml(copy.next)}</span><strong>${escapeHtml(document.next.title)}</strong></a>`
    : "<span></span>"
  return `<nav class="pagination" aria-label="Document pagination">${previous}${next}</nav>`
}

function searchIcon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"></circle><path d="m16 16 4 4"></path></svg>'
}

function menuIcon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"></path></svg>'
}

function arrowIcon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5"></path></svg>'
}
