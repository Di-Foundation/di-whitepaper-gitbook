const body = document.body
const header = document.querySelector(".site-header")
const progress = document.querySelector(".reading-progress span")
const menuButton = document.querySelector("[data-menu-toggle]")
const menuClose = document.querySelector("[data-menu-close]")
const searchDialog = document.querySelector("[data-search-dialog]")
const searchInput = document.querySelector("[data-search-input]")
const searchResults = document.querySelector("[data-search-results]")
const searchHint = document.querySelector("[data-search-hint]")
const searchEmpty = document.querySelector("[data-search-empty]")
const edgeWaves = document.querySelector("[data-edge-waves]")

let searchIndex = null

function mountEdgeWaves(canvas) {
  if (!(canvas instanceof HTMLCanvasElement)) return
  const context = canvas.getContext("2d", { alpha: true })
  if (!context) return

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
  let width = 0
  let height = 0
  let pixelRatio = 1
  let frame = 0
  let lastFrame = 0

  function resize() {
    width = window.innerWidth
    height = window.innerHeight
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(width * pixelRatio)
    canvas.height = Math.round(height * pixelRatio)
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  }

  function particle(x, y, alpha, radius) {
    context.fillStyle = `rgba(255, 199, 0, ${alpha})`
    context.beginPath()
    context.arc(x, y, radius, 0, Math.PI * 2)
    context.fill()
  }

  function horizontalWave(side, time) {
    const edgeDepth = Math.min(150, Math.max(82, height * 0.15))
    const direction = side === "top" ? 1 : -1
    const anchor = side === "top" ? 0 : height
    const gap = Math.max(9, Math.min(14, width / 120))

    for (let lane = 0; lane < 8; lane += 1) {
      for (let x = -gap; x <= width + gap; x += gap) {
        const progress = x / Math.max(width, 1)
        const swell = Math.sin(progress * Math.PI * 2.15 + time * 0.22 + lane * 0.34)
        const ripple = Math.sin(progress * Math.PI * 5.2 - time * 0.15 + lane * 0.58)
        const centerFade = 0.2 + Math.pow(Math.abs(progress - 0.5) * 2, 1.45) * 0.8
        const depth = 14 + lane * 7 + (swell * 0.23 + ripple * 0.08 + 0.34) * edgeDepth * centerFade
        const alpha = (0.08 + lane * 0.012) * (0.55 + centerFade * 0.65)
        particle(x, anchor + direction * depth, alpha, lane % 3 === 0 ? 1.15 : 0.85)
      }
    }
  }

  function verticalWave(side, time) {
    const edgeDepth = Math.min(132, Math.max(72, width * 0.085))
    const direction = side === "left" ? 1 : -1
    const anchor = side === "left" ? 0 : width
    const gap = Math.max(9, Math.min(14, height / 82))

    for (let lane = 0; lane < 8; lane += 1) {
      for (let y = -gap; y <= height + gap; y += gap) {
        const progress = y / Math.max(height, 1)
        const swell = Math.sin(progress * Math.PI * 2.35 - time * 0.2 + lane * 0.31)
        const ripple = Math.sin(progress * Math.PI * 5.7 + time * 0.16 + lane * 0.61)
        const centerFade = 0.18 + Math.pow(Math.abs(progress - 0.5) * 2, 1.35) * 0.82
        const depth = 12 + lane * 6 + (swell * 0.22 + ripple * 0.08 + 0.32) * edgeDepth * centerFade
        const alpha = (0.075 + lane * 0.011) * (0.52 + centerFade * 0.66)
        particle(anchor + direction * depth, y, alpha, lane % 3 === 1 ? 1.1 : 0.82)
      }
    }
  }

  function draw(time = 0) {
    context.clearRect(0, 0, width, height)
    context.save()
    context.globalCompositeOperation = "lighter"
    horizontalWave("top", time)
    horizontalWave("bottom", time + 2.4)
    verticalWave("left", time + 1.1)
    verticalWave("right", time + 3.7)
    context.restore()
  }

  function animate(timestamp) {
    if (timestamp - lastFrame >= 32) {
      draw(timestamp / 1000)
      lastFrame = timestamp
    }
    frame = window.requestAnimationFrame(animate)
  }

  function syncMotion() {
    window.cancelAnimationFrame(frame)
    draw(7)
    if (!reducedMotion.matches && !document.hidden) frame = window.requestAnimationFrame(animate)
  }

  resize()
  syncMotion()
  window.addEventListener("resize", () => {
    resize()
    draw(7)
  }, { passive: true })
  document.addEventListener("visibilitychange", syncMotion)
  reducedMotion.addEventListener?.("change", syncMotion)
}

mountEdgeWaves(edgeWaves)

function updateScrollState() {
  const scrollTop = window.scrollY
  const available = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
  header?.classList.toggle("is-scrolled", scrollTop > 12)
  if (progress) progress.style.width = `${Math.min(100, (scrollTop / available) * 100)}%`
}

function setMenu(open) {
  body.classList.toggle("menu-open", open)
  menuButton?.setAttribute("aria-expanded", String(open))
}

async function loadSearchIndex() {
  if (searchIndex) return searchIndex
  const response = await fetch("/search-index.json")
  if (!response.ok) throw new Error(`Search index returned ${response.status}`)
  searchIndex = await response.json()
  return searchIndex
}

async function openSearch() {
  if (!(searchDialog instanceof HTMLDialogElement)) return
  if (!searchDialog.open) searchDialog.showModal()
  searchInput?.focus()
  try {
    await loadSearchIndex()
  } catch {
    if (searchHint) searchHint.textContent = "Search is temporarily unavailable."
  }
}

function normalize(value) {
  return value.toLocaleLowerCase().normalize("NFKC")
}

function scoreDocument(documentEntry, tokens) {
  const title = normalize(documentEntry.title)
  const content = normalize(documentEntry.content)
  let score = 0
  for (const token of tokens) {
    if (title === token) score += 18
    else if (title.includes(token)) score += 9
    if (content.includes(token)) score += 2
  }
  return score
}

function excerptFor(documentEntry, query) {
  const content = documentEntry.content
  const offset = normalize(content).indexOf(normalize(query))
  const start = Math.max(0, offset >= 0 ? offset - 54 : 0)
  const end = Math.min(content.length, start + 170)
  return `${start > 0 ? "…" : ""}${content.slice(start, end)}${end < content.length ? "…" : ""}`
}

function renderSearch(query) {
  if (!searchResults || !searchHint || !searchEmpty || !searchIndex) return
  searchResults.replaceChildren()
  const tokens = normalize(query).split(/\s+/).filter(Boolean)
  searchHint.hidden = tokens.length > 0
  if (!tokens.length) return

  const matches = searchIndex
    .filter((entry) => entry.language === body.dataset.language)
    .map((entry) => ({ entry, score: scoreDocument(entry, tokens) }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.entry.chapter - right.entry.chapter)
    .slice(0, 10)

  if (!matches.length) {
    searchResults.append(searchEmpty.content.cloneNode(true))
    return
  }

  for (const { entry } of matches) {
    const link = document.createElement("a")
    link.className = "search-result"
    link.href = entry.route

    const number = document.createElement("span")
    number.textContent = String(entry.chapter).padStart(2, "0")
    const details = document.createElement("div")
    const title = document.createElement("strong")
    title.textContent = entry.title
    const excerpt = document.createElement("small")
    excerpt.textContent = excerptFor(entry, query)
    details.append(title, excerpt)
    link.append(number, details)
    searchResults.append(link)
  }
}

window.addEventListener("scroll", updateScrollState, { passive: true })
window.addEventListener("resize", updateScrollState, { passive: true })
updateScrollState()

menuButton?.addEventListener("click", () => setMenu(!body.classList.contains("menu-open")))
menuClose?.addEventListener("click", () => setMenu(false))
document.querySelectorAll(".chapter-sidebar a").forEach((link) => link.addEventListener("click", () => setMenu(false)))

document.querySelectorAll("[data-search-open]").forEach((button) => button.addEventListener("click", openSearch))
searchInput?.addEventListener("input", (event) => renderSearch(event.currentTarget.value.trim()))
searchDialog?.addEventListener("close", () => {
  if (searchInput) searchInput.value = ""
  if (searchResults) searchResults.replaceChildren()
  if (searchHint) searchHint.hidden = false
})

document.addEventListener("keydown", (event) => {
  const element = event.target
  const isTyping = element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element?.isContentEditable
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault()
    void openSearch()
  } else if (event.key === "/" && !isTyping && !searchDialog?.open) {
    event.preventDefault()
    void openSearch()
  } else if (event.key === "Escape" && searchDialog?.open) {
    event.preventDefault()
    searchDialog.close()
  } else if (event.key === "Escape" && body.classList.contains("menu-open")) {
    setMenu(false)
    menuButton?.focus()
  }
})

const outlineLinks = new Map(
  [...document.querySelectorAll(".outline-link")].map((link) => [decodeURIComponent(link.hash.slice(1)), link]),
)
if (outlineLinks.size) {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      outlineLinks.forEach((link) => link.classList.remove("is-active"))
      outlineLinks.get(entry.target.id)?.classList.add("is-active")
    }
  }, { rootMargin: "-18% 0px -68%", threshold: 0 })
  document.querySelectorAll(".document-content h2[id], .document-content h3[id]").forEach((heading) => observer.observe(heading))
}
