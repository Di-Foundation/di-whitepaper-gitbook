import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { access, readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

import { COPY, DIST, LANGUAGES, ROOT, outputFileForRoute, parseSummary, resolveContentHref } from "../scripts/content.mjs"

const summaries = await Promise.all(LANGUAGES.map(parseSummary))

test("both landing pages separate the cover heading from version and introduction", async () => {
  for (const entries of summaries) {
    const html = await readFile(outputFileForRoute(entries[0].route), "utf8")
    assert.match(html, /<div class="landing-heading">[\s\S]*?<\/h1>\s*<\/div>\s*<div class="landing-source">/)
  }
})

test("every page declares the official DI favicon and the fallback serves the same asset", async () => {
  for (const entry of summaries.flat()) {
    const html = await readFile(outputFileForRoute(entry.route), "utf8")
    assert.match(html, /<link rel="icon" type="image\/png" sizes="512x512" href="\/favicon\.png\?v=189fe8a99a2d">/, entry.route)
  }
  const icon = await readFile(path.join(DIST, "favicon.png"))
  assert.equal(createHash("sha256").update(icon).digest("hex"), "189fe8a99a2d39b5a51eea20c3ae4b5b940d5eb423ccd693d57d500a6fff6f49")
  assert.equal(icon.readUInt32BE(16), 512)
  assert.equal(icon.readUInt32BE(20), 512)
})

test("both languages retain the v2 landing page and all 17 chapters", () => {
  assert.equal(summaries[0].length, 18)
  assert.equal(summaries[1].length, 18)
  assert.equal(summaries[0][0].relativeFile, "README.md")
  assert.equal(summaries[1][0].relativeFile, "README.md")
})

test("every summary source and generated route exists", async () => {
  for (const entries of summaries) {
    for (const entry of entries) {
      await access(entry.sourcePath)
      await access(outputFileForRoute(entry.route))
    }
  }
})

test("generated search index includes every source document and both languages", async () => {
  const index = JSON.parse(await readFile(path.join(DIST, "search-index.json"), "utf8"))
  assert.equal(index.length, 36)
  assert.equal(index.filter((entry) => entry.language === "en").length, 18)
  assert.equal(index.filter((entry) => entry.language === "cn").length, 18)
  assert.ok(index.some((entry) => entry.route === "/en/17-risks/"))
  assert.ok(index.some((entry) => entry.route === "/zh/17-risks/"))
})

test("source SUMMARY links reach the matching language chapter grid", () => {
  for (const entries of summaries) {
    assert.equal(resolveContentHref("./SUMMARY.md", entries[0], new Map()), entries[0].route + "#contents")
  }
})

test("the whitepaper excludes personnel biographies and retains partners", async () => {
  const index = JSON.parse(await readFile(path.join(DIST, "search-index.json"), "utf8"))
  const personnel = /Core team|核心团队|governance committee|治理委员会|technical advisor|技术顾问|Rex|MICHILL|Goldchau|Jeff Ren|William Entriken|Xiaofan Liu|刘肖凡/i
  assert.doesNotMatch(JSON.stringify(index), personnel)
  assert.ok(index.every((entry) => !entry.route.includes("16-team")))
  const rootSummary = await readFile(path.join(ROOT, "SUMMARY.md"), "utf8")
  assert.doesNotMatch(rootSummary, /16-team|Team, Governance|团队、治理/)
  assert.match(rootSummary, /en\/16-partners\.md/)
  assert.match(rootSummary, /cn\/16-partners\.md/)
  for (const entries of summaries) {
    assert.ok(entries.every((entry) => entry.relativeFile !== "16-team.md"))
    const partners = entries.find((entry) => entry.relativeFile === "16-partners.md")
    assert.ok(partners)
    const html = await readFile(outputFileForRoute(partners.route), "utf8")
    assert.match(html, /OKX Ventures/)
    assert.doesNotMatch(html, personnel)
  }
})

test("v2 metadata and all new bilingual illustrations reach generated pages", async () => {
  for (const entries of summaries) {
    assert.match(COPY[entries[0].language].version, /2\.0/)
    let illustrations = 0
    for (const entry of entries) {
      const html = await readFile(outputFileForRoute(entry.route), "utf8")
      assert.equal([...html.matchAll(/<h1\b/g)].length, 1, `${entry.route} has one document title`)
      illustrations += [...html.matchAll(/class="document-figure"/g)].length
      assert.ok(html.includes(COPY[entry.language].version))
      if (entry.relativeFile === "README.md") {
        assert.ok(html.includes('id="contents"'))
        assert.ok(html.includes(`href="${entry.route}#contents"`))
      }
    }
    assert.equal(illustrations, 8)
  }
})

test("all generated local href and image targets resolve", async () => {
  const pages = summaries.flat()
  const failures = []
  for (const entry of pages) {
    const html = await readFile(outputFileForRoute(entry.route), "utf8")
    const references = [...html.matchAll(/(?:href|src)="(\/(?!\/)[^"?#]+)(?:[?#][^"]*)?"/g)].map((match) => match[1])
    for (const reference of references) {
      const target = reference.endsWith("/")
        ? path.join(DIST, reference, "index.html")
        : path.join(DIST, reference)
      try {
        await access(target)
      } catch {
        failures.push(`${entry.route} -> ${reference}`)
      }
    }
  }
  assert.deepEqual(failures, [])
})

test("source Markdown remains unchanged by the build", async () => {
  for (const entries of summaries) {
    for (const entry of entries) {
      const relative = path.relative(ROOT, entry.sourcePath)
      assert.match(relative, /^(?:en|cn)[\\/]/)
      assert.ok((await readFile(entry.sourcePath, "utf8")).length > 20)
    }
  }
})
