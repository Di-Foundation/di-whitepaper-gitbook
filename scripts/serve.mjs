import { createReadStream } from "node:fs"
import { stat } from "node:fs/promises"
import { createServer } from "node:http"
import path from "node:path"

import { DIST } from "./content.mjs"

const port = Number(process.env.PORT ?? 4173)
const mime = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
])

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`)
    const decodedPath = decodeURIComponent(url.pathname)
    const candidate = path.resolve(DIST, `.${decodedPath}`)
    if (candidate !== DIST && !candidate.startsWith(`${DIST}${path.sep}`)) {
      response.writeHead(400).end("Bad request")
      return
    }

    let filePath = candidate
    const fileStat = await stat(filePath).catch(() => null)
    if (fileStat?.isDirectory()) filePath = path.join(filePath, "index.html")
    const finalStat = await stat(filePath).catch(() => null)
    if (!finalStat?.isFile()) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("Not found")
      return
    }

    response.writeHead(200, {
      "cache-control": "no-store",
      "content-type": mime.get(path.extname(filePath).toLowerCase()) ?? "application/octet-stream",
    })
    createReadStream(filePath).pipe(response)
  } catch (error) {
    response.writeHead(500, { "content-type": "text/plain; charset=utf-8" }).end("Server error")
    console.error(error)
  }
})

server.listen(port, "127.0.0.1", () => {
  console.log(`DI Whitepaper preview: http://127.0.0.1:${port}`)
})
