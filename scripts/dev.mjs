import { spawn } from 'node:child_process'
import process from 'node:process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const children = []
const nodeArgs = ['--env-file-if-exists=.env']

function start(args, name) {
  const child = spawn(process.execPath, [...nodeArgs, ...args], { cwd: root, stdio: 'inherit', env: process.env })
  children.push(child)
  child.on('exit', (code) => {
    if (code && code !== 0) console.error(`[captivibe] ${name} exited with code ${code}`)
    for (const other of children) if (other !== child && !other.killed) other.kill('SIGTERM')
    process.exit(code ?? 0)
  })
  return child
}

const shutdown = () => {
  for (const child of children) if (!child.killed) child.kill('SIGTERM')
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

start(['server/index.mjs'], 'AI API server')
start(['node_modules/vite/bin/vite.js'], 'Vite')
