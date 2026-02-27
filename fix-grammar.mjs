import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const ROOT = 'd:/Weeks/Clocktower-Pocket/src'
const replacements = [
  // 조사 수정: "임프이" → "임프가" (받침 없는 글자 뒤 조사)
  ['임프이 ', '임프가 '],
  ['임프이면', '임프면'],
  ['임프이나', '임프나'],
  ['임프이라', '임프라'],
  ['임프이든', '임프든'],
  ['임프이고', '임프고'],
  ['임프이 아', '임프가 아'],
  // "임프으로" → "임프로"
  ['임프으로', '임프로'],
  // "임프을" → "임프를"
  ['임프을', '임프를'],
  // "임프과" → "임프와"
  ['임프과', '임프와'],
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
      console.log('Fixed:', full.replace(ROOT + '/', ''))
    }
  }
}

walk(ROOT)
console.log('Done.')
