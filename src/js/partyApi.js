/**
 * Google Apps Script 웹 앱과 통신하는 API 클라이언트
 */
import { PARTY_API_URL } from './config.js'

/**
 * 기간 내 등록된 일정 목록 조회
 * @param {string} startDate  YYYY-MM-DD
 * @param {string} endDate    YYYY-MM-DD
 * @returns {Promise<Array<{name:string, date:string, role:string}>>}
 */
export async function fetchSchedule(startDate, endDate) {
  if (!PARTY_API_URL) throw new Error('API URL이 설정되지 않았습니다')
  const url = `${PARTY_API_URL}?action=list&start=${startDate}&end=${endDate}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  return (data.entries || []).map(e => ({
    ...e,
    date: normalizeDate(e.date),
  }))
}

/**
 * 일정 등록 (이름 + 날짜 배열)
 * rangeStart/rangeEnd: 해당 범위 내 기존 등록을 모두 삭제 후 재등록
 * dates가 빈 배열이면 해당 범위 내 본인 등록 전체 삭제
 * @param {{name:string, entries:Array<{date:string, role:string}>, rangeStart:string, rangeEnd:string}} params
 * @returns {Promise<{success:boolean}>}
 */
export async function registerDates({ name, entries, rangeStart, rangeEnd }) {
  if (!PARTY_API_URL) throw new Error('API URL이 설정되지 않았습니다')
  const res = await fetch(PARTY_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'register', name, entries, rangeStart, rangeEnd }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/** 다양한 날짜 형식을 YYYY-MM-DD로 정규화 */
function normalizeDate(str) {
  if (!str) return str
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str
  const d = new Date(str)
  if (isNaN(d.getTime())) return str
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}
