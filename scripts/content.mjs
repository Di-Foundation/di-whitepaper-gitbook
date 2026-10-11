import { readFile } from "node:fs/promises"
import path from "node:path"

export const ROOT = path.resolve(import.meta.dirname, "..")
export const DIST = path.join(ROOT, "dist")
export const LANGUAGES = ["en", "cn"]

export const COPY = {
  en: {
    htmlLang: "en",
    label: "English",
    alternateLabel: "简体中文",
    documentLabel: "DI / WHITEPAPER",
    chapterLabel: "Chapter",
    contents: "Contents",
    onThisPage: "On this page",
    search: "Search",
    searchPlaceholder: "Search the whitepaper",
    searchEmpty: "No matching sections.",
    searchHint: "Type a concept, product, or chapter title.",
    previous: "Previous",
    next: "Next",
    menu: "Open chapters",
    close: "Close",
    website: "DI.XYZ",
    source: "Source",
    version: "Version 2.0 · October 2026",
    skip: "Skip to document",
    minutes: "min read",
    readChapter: "Read chapter",
  },
  cn: {
    htmlLang: "zh-CN",
    label: "简体中文",
    alternateLabel: "English",
    documentLabel: "DI / 白皮书",
    chapterLabel: "章节",
    contents: "章节目录",
    onThisPage: "本页目录",
    search: "搜索",
    searchPlaceholder: "搜索白皮书",
    searchEmpty: "没有匹配的章节。",
    searchHint: "输入概念、产品或章节标题。",
    previous: "上一篇",
    next: "下一篇",
    menu: "打开章节目录",
    close: "关闭",
    website: "DI.XYZ",
    source: "源文件",
    version: "版本 2.0 · 2026 年 10 月",
    skip: "跳到正文",
    minutes: "分钟阅读",
    readChapter: "阅读本章",
  },
}

export function normalizeSlash(value) {
  return value.replaceAll("\\", "/")
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

export function slugify(value) {
  const slug = value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return slug || "section"
}

export function stripMarkdown(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/[*_~`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

export function routeFor(language, relativeFile) {
  const file = normalizeSlash(relativeFile).replace(/^\.\//, "")
  if (file.toLowerCase() === "readme.md") return language === "en" ? "/" : "/zh/"
  const slug = file.replace(/\.md$/i, "")
  return language === "en" ? `/en/${slug}/` : `/zh/${slug}/`
}

export function outputFileForRoute(route) {
  if (route === "/") return path.join(DIST, "index.html")
  return path.join(DIST, route.replace(/^\//, ""), "index.html")
}

export async function parseSummary(language) {
  const summaryPath = path.join(ROOT, language, "SUMMARY.md")
  const summary = await readFile(summaryPath, "utf8")
  const entries = []

  for (const line of summary.split(/\r?\n/)) {
    const match = line.match(/^\s*\*\s+\[([^\]]+)\]\(([^)]+\.md)\)\s*$/i)
    if (!match) continue
    const [, title, relativeFile] = match
    entries.push({
      language,
      title: title.trim().replace(/^\d+\.\s+/, ""),
      relativeFile: normalizeSlash(relativeFile.trim()),
      sourcePath: path.join(ROOT, language, relativeFile.trim()),
      route: routeFor(language, relativeFile.trim()),
    })
  }

  if (entries.length < 2 || entries[0].relativeFile.toLowerCase() !== "readme.md") {
    throw new Error(`${language}/SUMMARY.md must begin with README.md and include chapters`)
  }

  return entries
}

export function pairedRoute(entry, allEntries) {
  const alternateLanguage = entry.language === "en" ? "cn" : "en"
  const currentEntries = allEntries.filter((candidate) => candidate.language === entry.language)
  const alternateEntries = allEntries.filter((candidate) => candidate.language === alternateLanguage)
  const index = currentEntries.findIndex((candidate) => candidate.route === entry.route)
  return alternateEntries[index]?.route ?? (alternateLanguage === "en" ? "/" : "/zh/")
}

export function resolveContentHref(href, entry, routeBySource) {
  if (!href || href.startsWith("#") || /^(?:[a-z]+:|\/\/)/i.test(href)) return href

  const [pathname, hash = ""] = href.split("#", 2)
  const normalizedSource = normalizeSlash(
    path.relative(ROOT, path.resolve(path.dirname(entry.sourcePath), pathname)),
  )

  if (/\.md$/i.test(pathname)) {
    if (/^(en|cn)\/SUMMARY\.md$/i.test(normalizedSource)) {
      return `${routeFor(normalizedSource.split("/")[0].toLowerCase(), "README.md")}#contents`
    }
    const route = routeBySource.get(normalizedSource)
    if (!route) throw new Error(`Unknown Markdown link ${href} in ${normalizeSlash(path.relative(ROOT, entry.sourcePath))}`)
    return `${route}${hash ? `#${hash}` : ""}`
  }

  if (normalizedSource.startsWith("../") || path.isAbsolute(normalizedSource)) {
    throw new Error(`Content link escapes the repository: ${href}`)
  }

  return `/content/${normalizedSource}${hash ? `#${hash}` : ""}`
}

export function readingMinutes(markdown, language) {
  const plain = stripMarkdown(markdown)
  const units = language === "cn" ? plain.replace(/\s/g, "").length : plain.split(/\s+/).length
  const perMinute = language === "cn" ? 450 : 220
  return Math.max(1, Math.ceil(units / perMinute))
}
