/**
 * P2P 연결 관리 모듈 (Trystero 기반)
 * WebRTC를 사용하여 서버 없이 직접 피어 간 통신
 */

// Trystero를 CDN에서 로드 (MQTT 전략 - Quest-Net 검증됨, 안정적)
import { joinRoom } from 'https://esm.run/trystero/mqtt'

class P2PManager {
    constructor() {
        this.room = null
        this.peers = new Map() // peerId -> peerInfo
        this.messageHandlers = new Map() // messageType -> handler
        this.isHost = false
        this.roomCode = null
        this.myPeerId = null
        this.pendingPlayerName = null // Player 참가 시 임시 저장

        // 메시지 타입 매핑 (긴 이름 → 짧은 이름, 12바이트 제한)
        this.messageTypeMap = {
            'JOIN_REQUEST':  'JOIN_REQ',
            'JOIN_RESPONSE': 'JOINED',
            'PHASE_CHANGE':  'PHASE',
            'PLAYER_DIED':   'DIED',
            'VOTE_RESULT':   'VOTE_RESULT',
            'ROLE_ASSIGN':   'ROLE_ASSIGN',
            'NIGHT_RESULT':  'NIGHT_RESULT',
            'NIGHT_CALL':    'NIGHT_CALL',
            'NIGHT_ACTION':  'NIGHT_ACT',
            'VOTE':          'VOTE',
            'CHAT_MESSAGE':  'CHAT',
            'PLAYER_LIST':   'PLAYERS',
            'PING':          'PING',
            'PONG':          'PONG',
            // 게임 전용 타입
            'GAME_START':    'GAME_ST',
            'NIGHT_INFO':    'NIGHT_INF',
            'VOTE_UPDATE':   'VOTE_UPD',
            'GAME_END':      'GAME_END',
            'EMOJI':         'EMOJI',
        }

        // 역방향 매핑 (짧은 이름 → 긴 이름)
        this.reverseTypeMap = {}
        for (const [long, short] of Object.entries(this.messageTypeMap)) {
            this.reverseTypeMap[short] = long
        }

        // 연결 상태 콜백
        this.onPeerJoined = null
        this.onPeerLeft = null
        this.onRoomCreated = null
        this.onRoomJoined = null
        this.onConnectionError = null
    }

    /**
     * 방 생성 (Host용)
     * @param {string} roomCode - 6자리 방 코드
     * @returns {Promise<void>}
     */
    async createRoom(roomCode) {
        try {
            this.roomCode = roomCode
            this.isHost = true

            console.log(`[P2P] Creating room: ${roomCode}`)

            // Trystero 룸 생성 (MQTT - 기본 브로커 사용)
            this.room = joinRoom({ appId: 'clocktower-pocket' }, roomCode)

            // 내 피어 ID 저장 (Trystero는 getPeers()로 확인 가능)
            this.myPeerId = 'host-' + Math.random().toString(36).substr(2, 9)
            console.log(`[P2P] My Peer ID: ${this.myPeerId}`)

            // 피어 연결/해제 이벤트 처리
            this.room.onPeerJoin(peerId => this._handlePeerJoin(peerId))
            this.room.onPeerLeave(peerId => this._handlePeerLeave(peerId))

            // 메시지 수신 설정
            this._setupMessageHandlers()

            if (this.onRoomCreated) {
                this.onRoomCreated(roomCode)
            }

            console.log(`[P2P] Room created successfully: ${roomCode}`)
        } catch (error) {
            console.error('[P2P] Failed to create room:', error)
            if (this.onConnectionError) {
                this.onConnectionError(error)
            }
            throw error
        }
    }

    /**
     * 방 참가 (Player용)
     * @param {string} roomCode - 6자리 방 코드
     * @param {string} playerName - 플레이어 닉네임
     * @returns {Promise<void>}
     */
    async joinRoom(roomCode, playerName) {
        try {
            this.roomCode = roomCode
            this.isHost = false

            console.log(`[P2P] Joining room: ${roomCode} as ${playerName}`)

            // Trystero 룸 참가 (MQTT - 기본 브로커 사용)
            this.room = joinRoom({ appId: 'clocktower-pocket' }, roomCode)

            // 내 피어 ID 저장
            this.myPeerId = 'player-' + Math.random().toString(36).substr(2, 9)
            console.log(`[P2P] My Peer ID: ${this.myPeerId}`)

            // 피어 연결/해제 이벤트 처리
            this.room.onPeerJoin(peerId => this._handlePeerJoin(peerId))
            this.room.onPeerLeave(peerId => this._handlePeerLeave(peerId))

            // 메시지 수신 설정
            this._setupMessageHandlers()

            // playerName 저장 (피어 연결 시 JOIN_REQUEST 전송)
            this.pendingPlayerName = playerName

            // JOIN_RESPONSE 받으면 pendingPlayerName 초기화
            this.on('JOIN_RESPONSE', (data) => {
                if (data.ok) {
                    this.pendingPlayerName = null
                    console.log(`[P2P] Successfully joined as ${data.playerName}`)
                }
            })

            if (this.onRoomJoined) {
                this.onRoomJoined(roomCode)
            }

            console.log(`[P2P] Room joined successfully: ${roomCode}`)
        } catch (error) {
            console.error('[P2P] Failed to join room:', error)
            if (this.onConnectionError) {
                this.onConnectionError(error)
            }
            throw error
        }
    }

    /**
     * 메시지 수신 핸들러 설정
     */
    _setupMessageHandlers() {
        // 짧은 메시지 타입 사용 (12바이트 제한)
        const shortTypes = Object.values(this.messageTypeMap)

        shortTypes.forEach(shortType => {
            const [sendMessage, receiveMessage] = this.room.makeAction(shortType)

            // 수신 핸들러 등록
            receiveMessage((data, peerId) => {
                // 짧은 타입을 긴 타입으로 변환
                const longType = this.reverseTypeMap[shortType] || shortType
                console.log(`[P2P] Received ${longType} from ${peerId}:`, data)
                this._handleMessage(longType, data, peerId)
            })

            // 발신 함수 저장 (짧은 이름으로)
            this[`_send${shortType}`] = sendMessage
        })
    }

    /**
     * 메시지 처리
     */
    _handleMessage(type, data, peerId) {
        const handler = this.messageHandlers.get(type)
        if (handler) {
            handler(data, peerId)
        } else {
            console.warn(`[P2P] No handler registered for message type: ${type}`)
        }
    }

    /**
     * 메시지 핸들러 등록
     * @param {string} messageType - 메시지 타입
     * @param {Function} handler - 핸들러 함수 (data, peerId) => void
     */
    on(messageType, handler) {
        this.messageHandlers.set(messageType, handler)
    }

    /**
     * 특정 피어에게 메시지 전송
     * @param {string} peerId - 대상 피어 ID
     * @param {string} messageType - 메시지 타입 (긴 이름)
     * @param {Object} data - 메시지 데이터
     */
    sendToPeer(peerId, messageType, data) {
        // 긴 타입을 짧은 타입으로 변환
        const shortType = this.messageTypeMap[messageType] || messageType
        const sendFunc = this[`_send${shortType}`]

        if (sendFunc) {
            sendFunc(data, peerId)
            console.log(`[P2P] Sent ${messageType} to ${peerId}:`, data)
        } else {
            console.error(`[P2P] Unknown message type: ${messageType}`)
        }
    }

    /**
     * Host에게 메시지 전송
     * @param {string} messageType - 메시지 타입 (긴 이름)
     * @param {Object} data - 메시지 데이터
     */
    sendToHost(messageType, data) {
        // Host는 첫 번째로 연결된 피어라고 가정
        const hostPeerId = Array.from(this.peers.keys())[0]
        if (hostPeerId) {
            this.sendToPeer(hostPeerId, messageType, data)
        } else {
            console.warn('[P2P] No host peer found')
        }
    }

    /**
     * 모든 피어에게 브로드캐스트
     * @param {string} messageType - 메시지 타입 (긴 이름)
     * @param {Object} data - 메시지 데이터
     */
    broadcast(messageType, data) {
        // 긴 타입을 짧은 타입으로 변환
        const shortType = this.messageTypeMap[messageType] || messageType
        const sendFunc = this[`_send${shortType}`]

        if (sendFunc) {
            sendFunc(data) // peerId 없이 호출하면 브로드캐스트
            console.log(`[P2P] Broadcast ${messageType}:`, data)
        } else {
            console.error(`[P2P] Unknown message type: ${messageType}`)
        }
    }

    /**
     * 피어 연결 처리
     */
    _handlePeerJoin(peerId) {
        console.log(`[P2P] Peer joined: ${peerId}`)

        this.peers.set(peerId, {
            id: peerId,
            connectedAt: Date.now()
        })

        // Player가 피어에 연결되면 JOIN_REQUEST 전송 (모든 피어에게 브로드캐스트)
        // Host만 JOIN_REQUEST를 처리하고, 다른 Player는 무시함
        if (!this.isHost && this.pendingPlayerName) {
            console.log(`[P2P] Sending JOIN_REQUEST for: ${this.pendingPlayerName}`)
            this.sendToPeer(peerId, 'JOIN_REQUEST', { playerName: this.pendingPlayerName })
            // pendingPlayerName을 유지하여 모든 피어에게 전송
        }

        if (this.onPeerJoined) {
            this.onPeerJoined(peerId)
        }
    }

    /**
     * 피어 연결 해제 처리
     */
    _handlePeerLeave(peerId) {
        console.log(`[P2P] Peer left: ${peerId}`)

        this.peers.delete(peerId)

        if (this.onPeerLeft) {
            this.onPeerLeft(peerId)
        }
    }

    /**
     * MQTT 브로커 목록 (선택사항)
     * MQTT 전략은 Trystero 기본 브로커 사용
     * 커스텀 브로커 사용 시 relayUrls에 전달
     */
    // static MQTT_BROKERS = [
    //     'wss://test.mosquitto.org:8081',
    // ]

    /**
     * 방 코드 생성 (6자리 영숫자)
     */
    static generateRoomCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
        let code = ''
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length))
        }
        return code
    }

    /**
     * 연결된 피어 목록 가져오기
     */
    getPeers() {
        return Array.from(this.peers.values())
    }

    /**
     * 연결 종료
     */
    disconnect() {
        if (this.room) {
            this.room.leave()
            this.room = null
        }
        this.peers.clear()
        this.messageHandlers.clear()
        console.log('[P2P] Disconnected')
    }
}

// ES 모듈 export
export { P2PManager }

// 전역으로도 내보내기 (디버깅용)
window.P2PManager = P2PManager
