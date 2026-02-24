/**
 * P-05 EmojiPanel — 이모지 시그널 화면
 */
import { renderEmojiPicker } from '../components/EmojiPicker.js'
import { showEmojiPopup }    from '../components/EmojiPopup.js'
import { EMOJI_SIGNALS }     from '../data/roles-tb.js'

export class EmojiPanel {
  constructor({ players, myPlayerId, onSend }) {
    this.players    = players
    this.myPlayerId = myPlayerId
    this.onSend     = onSend
    this.el         = null
  }

  mount(container) {
    this.el = document.createElement('div')
    this.el.className = 'emoji-panel-screen'
    this._render()
    container.appendChild(this.el)
  }

  unmount() { this.el?.remove() }

  updatePlayers(players) {
    this.players = players
    this._render()
  }

  /** 이모지 수신 시 팝업 표시 */
  receiveEmoji(fromName, emoji) {
    showEmojiPopup({ fromName, emoji })
  }

  _render() {
    this.el.innerHTML = ''

    const title = document.createElement('div')
    title.innerHTML = `
      <div class="section-label" style="margin-bottom:8px">💬 이모지 시그널 전송</div>
      <div style="font-size:0.68rem;color:var(--text4);margin-bottom:12px">수신자를 선택한 뒤 이모지를 탭하세요</div>
    `
    this.el.appendChild(title)

    this.el.appendChild(renderEmojiPicker(
      this.players,
      EMOJI_SIGNALS,
      (targetId, emoji) => {
        this.onSend && this.onSend(targetId, emoji)
      },
      this.myPlayerId
    ))
  }
}
