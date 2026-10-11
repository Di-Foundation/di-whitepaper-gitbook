import { spawn } from "node:child_process"
import { watch } from "node:fs"
import path from "node:path"

import { ROOT } from "./content.mjs"

let building = false
let queued = false
let timer = null

async function build() {
  if (building) {
    queued = true
    return
  }
  building = true
  const child = spawn(process.execPath, [path.join(ROOT, "scripts", "build.mjs")], { stdio: "inherit" })
  await new Promise((resolve) => child.once("exit", resolve))
  building = false
  if (queued) {
    queued = false
    await build()
  }
}

await build()
const server = spawn(process.execPath, [path.join(ROOT, "scripts", "serve.mjs")], { stdio: "inherit" })

for (const target of ["en", "cn", "assets", "src", "SUMMARY.md", "docs.yaml"]) {
  watch(path.join(ROOT, target), { recursive: true }, () => {
    clearTimeout(timer)
    timer = setTimeout(() => void build(), 120)
  })
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.kill(signal)
    process.exit(0)
  })
}
