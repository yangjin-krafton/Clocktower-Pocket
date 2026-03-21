/**
 * NightMessages — 밤 쪽지 템플릿 접근자
 *
 * 템플릿 원본: src/js/data/night-messages-data.js  ← 여기를 수정하세요
 * 인앱 뷰어:  src/scripts/night-messages.md        ← 문서 전용 (게임에 영향 없음)
 */

import { NIGHT_MESSAGES } from './night-messages-data.js'

/** 역할 키로 템플릿 문자열 반환. 없으면 null */
export function getTemplate(key) {
  return NIGHT_MESSAGES[key] ?? null
}

/** 템플릿 내 {변수명} 을 vars 객체로 일괄 치환 */
export function fillTemplate(template, vars) {
  if (!template) return ''
  return Object.entries(vars).reduce(
    (t, [k, v]) => t.replaceAll(`{${k}}`, String(v ?? '?')),
    template
  )
}

/** 하위 호환 — NightAction 생성자에서 호출됨 (이제 아무것도 안 함) */
export function loadNightMessages() {}
