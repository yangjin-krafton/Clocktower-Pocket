/**
 * 방 코드 인코딩 / 디코딩
 *
 * 비트 레이아웃:
 *   [4 bits]     playerCount - 5   (0=5명, 10=15명)
 *   [5 bits × N] 각 자리 역할 인덱스  (ROLES_TB 순서, 0-21)
 *   [4 bits]     레드헤링 플레이어 ID (1-based 1-15, 0=없음)
 *
 * Base32 인코딩 (혼동 없는 알파벳 — 0/1/I/O 제외):
 *   ALPHABET = ABCDEFGHJKLMNPQRSTUVWXYZ23456789
 *
 * 코드 길이:
 *   5인 →  7자  (4+25+4=33 bits)
 *   7인 →  9자  (4+35+4=43 bits)
 *  10인 → 12자  (4+50+4=58 bits)
 *  15인 → 17자  (4+75+4=83 bits)
 */

import { ROLES_TB } from './data/roles-tb.js'

// 혼동 없는 32자 알파벳
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

// ROLES_TB 순서 고정 인덱스 (22개)
const ROLE_IDS = ROLES_TB.map(r => r.id)

// ─────────────────────────────────────
// 비트 헬퍼
// ─────────────────────────────────────

function writeBits(arr, value, nbits) {
  for (let i = nbits - 1; i >= 0; i--) {
    arr.push((value >> i) & 1)
  }
}

function readBits(bits, pos, nbits) {
  let val = 0
  for (let i = 0; i < nbits; i++) val = (val << 1) | (bits[pos + i] ?? 0)
  return val
}

// ─────────────────────────────────────
// 공개 API
// ─────────────────────────────────────

/**
 * 게임 설정을 방 코드로 인코딩
 * @param {number}   playerCount    5-15
 * @param {string[]} assignedRoles  자리 순서 역할 ID 배열 (길이 = playerCount)
 * @param {number}   redHerringId   점쟁이 레드헤링 플레이어 ID (1-based, 0=없음)
 * @returns {string} 방 코드 (대문자 영숫자)
 */
export function encodeRoomCode(playerCount, assignedRoles, redHerringId = 0) {
  const bits = []

  writeBits(bits, playerCount - 5, 4)

  for (const roleId of assignedRoles) {
    const idx = ROLE_IDS.indexOf(roleId)
    writeBits(bits, idx >= 0 ? idx : 0, 5)
  }

  writeBits(bits, redHerringId & 0xF, 4)

  // bits → base32 문자
  let result = ''
  for (let i = 0; i < bits.length; i += 5) {
    let val = 0
    for (let j = 0; j < 5; j++) val = (val << 1) | (bits[i + j] ?? 0)
    result += ALPHA[val]
  }

  return result
}

/**
 * 방 코드를 게임 설정으로 디코딩
 * @param {string} code
 * @returns {{ playerCount: number, assignedRoles: string[], redHerringId: number } | null}
 */
export function decodeRoomCode(code) {
  const normalized = code.toUpperCase().replace(/[^ABCDEFGHJKLMNPQRSTUVWXYZ23456789]/g, '')

  // base32 → bits
  const bits = []
  for (const ch of normalized) {
    const idx = ALPHA.indexOf(ch)
    if (idx < 0) return null
    for (let i = 4; i >= 0; i--) bits.push((idx >> i) & 1)
  }

  let pos = 0
  const playerCount = readBits(bits, pos, 4) + 5
  pos += 4
  if (playerCount < 5 || playerCount > 15) return null

  const assignedRoles = []
  for (let i = 0; i < playerCount; i++) {
    if (pos + 5 > bits.length) return null
    const idx = readBits(bits, pos, 5)
    pos += 5
    if (idx >= ROLE_IDS.length) return null
    assignedRoles.push(ROLE_IDS[idx])
  }

  const redHerringId = readBits(bits, pos, 4)

  return { playerCount, assignedRoles, redHerringId }
}

/**
 * 코드를 4자 단위 하이픈 포맷으로 표시
 * @param {string} code
 * @returns {string}  예: "ABCD-EFGH-I"
 */
export function formatCode(code) {
  return code.match(/.{1,4}/g)?.join('-') ?? code
}

/**
 * 코드 유효성 검사
 */
export function validateRoomCode(code) {
  return decodeRoomCode(code) !== null
}
