import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const ROOT = 'd:/Weeks/Clocktower-Pocket/src'
const replacements = [
  ['스토리텔러', '이야기꾼'],
  ['데몬', '임프'],
]

function walk(dir) {
  const entries = readdirSync(dir)
  for (const name of entries) {
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) { walk(full); continue }
    if (!name.endsWith('.js') && !name.endsWith('.md')) continue
    let content = readFileSync(full, 'utf8')
    let changed = false
    for (const [from, to] of replacements) {
      if (content.includes(from)) {
        content = content.replaceAll(from, to)
        changed = true
      }
    }
    if (changed) {
      writeFileSync(full, content, 'utf8')
      console.log('Updated:', full.replace(ROOT + '/', ''))
    }
  }
}

walk(ROOT)
console.log('Done.')
