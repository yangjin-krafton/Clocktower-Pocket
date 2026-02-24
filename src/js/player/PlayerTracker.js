/**
 * P-04 PlayerTracker — 플레이어 추적 메모
 * 참가자의 수동 추리 기록 도구 (localStorage 저장)
 */
import { renderPhaseHeader } from '../components/PhaseHeader.js'

export class PlayerTracker {
  constructor({ players, gameState }) {
    this.players   = players
    this.gameState = gameState || { phase: 'day', round: 1, players: [] }
    this.notes     = this._loadNotes()
    this.el        = null
    this.editingId = null
  }

  mount(container) {
    this.el = document.createElement('div')
    this.el.className = 'tracker-screen'
    this._render()
    container.appendChild(this.el)
  }

  unmount() { this.el?.remove() }

  updatePlayers(players) {
    this.players = players
    this._render()
  }

  updateGameState(state) {
    this.gameState = state
    this._render()
  }

  _render() {
    this.el.innerHTML = ''
    this.el.appendChild(renderPhaseHeader({
      ...this.gameState,
      players: this.players,
    }))

    const list = document.createElement('div')
    list.className = 'tracker__list'

    this.players.forEach(p => {
      const note = this.notes[p.id] || {}
      const row  = document.createElement('div')
      row.className = 'tracker__row' + (p.status !== 'alive' ? ' tracker__row--dead' : '')

      row.innerHTML = `
        <div class="tracker__left">
          <span class="tracker__seat">${p.id}</span>
          <div class="tracker__info">
            <span class="tracker__name ${p.status !== 'alive' ? 'tracker__name--dead' : ''}">${p.name}</span>
            <span class="tracker__claim">${note.claim || ''}</span>
          </div>
        </div>
        <div class="tracker__tags">
          ${note.suspicion ? `<span class="badge badge-evil tracker__sus">${note.suspicion}</span>` : ''}
          ${note.trust     ? `<span class="badge badge-good tracker__tru">${note.trust}</span>` : ''}
        </div>
        <button class="tracker__edit-btn">✏️</button>
      `

      row.querySelector('.tracker__edit-btn').addEventListener('click', () => {
        this._openEdit(p.id, p.name)
      })

      list.appendChild(row)
    })

    this.el.appendChild(list)
  }

  _openEdit(playerId, playerName) {
    const note = this.notes[playerId] || {}

    const overlay = document.createElement('div')
    overlay.className = 'popup-overlay'

    const box = document.createElement('div')
    box.className = 'popup-box tracker__edit-box'
    box.innerHTML = `
      <div class="tracker__edit-title">${playerName} 메모</div>

      <div class="section-label" style="margin-top:10px">주장 역할</div>
      <input id="te-claim" class="input" type="text" placeholder="예: Fortune Teller라고 주장" value="${note.claim || ''}">

      <div class="section-label" style="margin-top:10px">의심 메모</div>
      <input id="te-suspicion" class="input" type="text" placeholder="예: Imp 의심" value="${note.suspicion || ''}">

      <div class="section-label" style="margin-top:10px">신뢰 메모</div>
      <input id="te-trust" class="input" type="text" placeholder="예: 선한 것 같음" value="${note.trust || ''}">

      <div class="section-label" style="margin-top:10px">자유 메모</div>
      <textarea id="te-memo" class="textarea" rows="3" style="min-height:60px">${note.memo || ''}</textarea>

      <div style="display:flex;gap:8px;margin-top:12px">
        <button id="te-save" class="btn btn-primary" style="flex:1">저장</button>
        <button id="te-cancel" class="btn" style="flex:1">취소</button>
      </div>
    `

    box.querySelector('#te-save').addEventListener('click', () => {
      this.notes[playerId] = {
        claim:     box.querySelector('#te-claim').value,
        suspicion: box.querySelector('#te-suspicion').value,
        trust:     box.querySelector('#te-trust').value,
        memo:      box.querySelector('#te-memo').value,
      }
      this._saveNotes()
      overlay.remove()
      this._render()
    })

    box.querySelector('#te-cancel').addEventListener('click', () => overlay.remove())
    overlay.appendChild(box)
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove() })
    document.body.appendChild(overlay)
  }

  _loadNotes() {
    try {
      return JSON.parse(localStorage.getItem('ct-tracker-notes') || '{}')
    } catch { return {} }
  }

  _saveNotes() {
    try {
      localStorage.setItem('ct-tracker-notes', JSON.stringify(this.notes))
    } catch {}
  }
}

if (!document.getElementById('tracker-style')) {
  const style = document.createElement('style')
  style.id = 'tracker-style'
  style.textContent = `
.tracker-screen { display: flex; flex-direction: column; gap: 6px; }
.tracker__list { display: flex; flex-direction: column; gap: 4px; }
.tracker__row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--surface);
  border: 1px solid var(--lead2);
}
.tracker__row--dead { opacity: 0.5; }
.tracker__left { display: flex; align-items: center; gap: 7px; flex: 1; min-width: 0; }
.tracker__seat {
  width: 20px; height: 20px;
  border-radius: 50%;
  background: var(--lead2);
  display: flex; align-items: center; justify-content: center;
  font-size: 0.6rem;
  color: var(--text3);
  font-weight: 700;
  flex-shrink: 0;
}
.tracker__info { flex: 1; min-width: 0; }
.tracker__name { display: block; font-size: 0.82rem; color: var(--text); font-weight: 600; }
.tracker__name--dead { text-decoration: line-through; color: var(--text4); }
.tracker__claim { display: block; font-size: 0.62rem; color: var(--text3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tracker__tags { display: flex; gap: 4px; flex-wrap: wrap; flex-shrink: 0; }
.tracker__edit-btn {
  background: none; border: none; cursor: pointer;
  font-size: 0.9rem; padding: 4px; flex-shrink: 0; opacity: 0.6;
}
.tracker__edit-btn:hover { opacity: 1; }
.tracker__edit-title {
  font-family: 'Noto Serif KR', serif;
  font-size: 1rem;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 4px;
}
.tracker__edit-box { max-height: 80vh; overflow-y: auto; }
  `
  document.head.appendChild(style)
}
