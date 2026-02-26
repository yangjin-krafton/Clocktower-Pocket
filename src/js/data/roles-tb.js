/**
 * Trouble Brewing 역할 정적 데이터
 */

export const ROLES_TB = [
  // ── Townsfolk (13) ──
  {
    id: 'washerwoman', name: '세탁부', team: 'townsfolk',
    ability: '첫날 밤, 두 플레이어를 제시받고 그 중 한 명이 특정 마을 주민임을 안다.',
    firstNight: true, otherNights: false, icon: 'washerwoman.png', iconEmoji: '👁️',
    nightType: 'info'
  },
  {
    id: 'librarian', name: '사서', team: 'townsfolk',
    ability: '첫날 밤, 두 플레이어를 제시받고 그 중 한 명이 특정 아웃사이더임을 안다. (아웃사이더가 없으면 그렇다고 안다)',
    firstNight: true, otherNights: false, icon: 'librarian.png', iconEmoji: '📚',
    nightType: 'info'
  },
  {
    id: 'investigator', name: '조사관', team: 'townsfolk',
    ability: '첫날 밤, 두 플레이어를 제시받고 그 중 한 명이 특정 미니언임을 안다.',
    firstNight: true, otherNights: false, icon: 'investigator.png', iconEmoji: '🔍',
    nightType: 'info'
  },
  {
    id: 'chef', name: '요리사', team: 'townsfolk',
    ability: '첫날 밤, 서로 이웃한 악 플레이어 쌍의 수를 안다.',
    firstNight: true, otherNights: false, icon: 'chef.png', iconEmoji: '👨‍🍳',
    nightType: 'info'
  },
  {
    id: 'empath', name: '공감인', team: 'townsfolk',
    ability: '매 밤, 양옆 생존 이웃 중 악 플레이어의 수(0/1/2)를 안다.',
    firstNight: true, otherNights: true, icon: 'empath.png', iconEmoji: '🧪',
    nightType: 'info'
  },
  {
    id: 'fortuneteller', name: '점쟁이', team: 'townsfolk',
    ability: '매 밤 2명을 선택해 그 중 데몬이 있는지 안다. 선 플레이어 1명은 항상 데몬처럼 잡힌다.',
    firstNight: true, otherNights: true, icon: 'fortuneteller.png', iconEmoji: '🔮',
    nightType: 'select', maxSelect: 2
  },
  {
    id: 'undertaker', name: '장의사', team: 'townsfolk',
    ability: '매 밤, 전날 처형된 플레이어의 실제 역할을 안다.',
    firstNight: false, otherNights: true, icon: 'undertaker.png', iconEmoji: '⚰️',
    nightType: 'info'
  },
  {
    id: 'monk', name: '수도사', team: 'townsfolk',
    ability: '매 밤(자신 제외) 1명을 보호해 데몬 공격으로부터 지킨다.',
    firstNight: false, otherNights: true, icon: 'monk.png', iconEmoji: '🙏',
    nightType: 'select', maxSelect: 1
  },
  {
    id: 'ravenkeeper', name: '까마귀 사육사', team: 'townsfolk',
    ability: '밤에 죽으면, 그 밤 1명을 선택해 역할을 안다.',
    firstNight: false, otherNights: true, icon: 'ravenkeeper.png', iconEmoji: '🐦‍⬛',
    nightType: 'select', maxSelect: 1
  },
  {
    id: 'virgin', name: '처녀', team: 'townsfolk',
    ability: '처음으로 자신을 지목한 사람이 마을 주민이면 그 지목자가 즉시 처형될 수 있다.',
    firstNight: false, otherNights: false, icon: 'virgin.png', iconEmoji: '👼',
    nightType: null
  },
  {
    id: 'slayer', name: '처단자', team: 'townsfolk',
    ability: '게임 중 1회, 낮에 1명을 지목. 그 대상이 데몬이면 즉시 사망한다.',
    firstNight: false, otherNights: false, icon: 'slayer.png', iconEmoji: '🗡️',
    nightType: null
  },
  {
    id: 'soldier', name: '군인', team: 'townsfolk',
    ability: '데몬 공격으로는 죽지 않는다.',
    firstNight: false, otherNights: false, icon: 'soldier.png', iconEmoji: '🛡️',
    nightType: null
  },
  {
    id: 'mayor', name: '시장', team: 'townsfolk',
    ability: '최종 3인에서 처형 없이 낮이 끝나면 선 팀이 승리할 수 있다. 데몬 공격이 시장을 노리면 튕겨나갈 수 있다.',
    firstNight: false, otherNights: false, icon: 'mayor.png', iconEmoji: '🎩',
    nightType: null
  },

  // ── Outsiders (4) ──
  {
    id: 'butler', name: '집사', team: 'outsider',
    ability: '매 밤, 주인을 1명 선택. 낮 동안 그 주인이 투표하지 않으면 자신도 투표할 수 없다.',
    firstNight: true, otherNights: true, icon: 'butler.png', iconEmoji: '🫅',
    nightType: 'select', maxSelect: 1
  },
  {
    id: 'drunk', name: '주정뱅이', team: 'outsider',
    ability: '본인은 마을 주민이라 믿지만 실제로는 아웃사이더이며 능력이 오작동한다.',
    firstNight: false, otherNights: false, icon: 'drunk.png', iconEmoji: '🍾',
    nightType: null
  },
  {
    id: 'recluse', name: '은둔자', team: 'outsider',
    ability: '선 팀이지만 악 팀 또는 데몬으로 등록될 수 있다.',
    firstNight: false, otherNights: false, icon: 'recluse.png', iconEmoji: '🧎',
    nightType: null
  },
  {
    id: 'saint', name: '성자', team: 'outsider',
    ability: '성자가 처형되면 선 팀이 즉시 패배한다.',
    firstNight: false, otherNights: false, icon: 'saint.png', iconEmoji: '😇',
    nightType: null
  },

  // ── Minions (4) ──
  {
    id: 'poisoner', name: '독약꾼', team: 'minion',
    ability: '매 밤 1명을 중독시킨다. 중독된 플레이어의 능력이 오작동한다.',
    firstNight: true, otherNights: true, icon: 'poisoner.png', iconEmoji: '☠️',
    nightType: 'select', maxSelect: 1
  },
  {
    id: 'spy', name: '스파이', team: 'minion',
    ability: '그리모어 전체 정보를 볼 수 있다. 선 팀으로 등록될 수 있다.',
    firstNight: true, otherNights: true, icon: 'spy.png', iconEmoji: '🕵️',
    nightType: 'info'
  },
  {
    id: 'scarletwoman', name: '진홍의 여인', team: 'minion',
    ability: '생존자 5명 이상일 때 데몬이 죽으면 자신이 새 데몬으로 승계된다.',
    firstNight: false, otherNights: false, icon: 'scarletwoman.png', iconEmoji: '💋',
    nightType: null
  },
  {
    id: 'baron', name: '남작', team: 'minion',
    ability: '게임 시작 시 아웃사이더 수를 2명 더 늘린다.',
    firstNight: true, otherNights: false, icon: 'baron.png', iconEmoji: '🎭',
    nightType: null
  },

  // ── Demon (1) ──
  {
    id: 'imp', name: '임프', team: 'demon',
    ability: '매 밤(첫밤 제외) 1명을 처치한다. 자신을 처치하면 살아있는 미니언이 새 임프가 된다.',
    firstNight: true, otherNights: true, icon: 'imp.png', iconEmoji: '👿',
    nightType: 'select', maxSelect: 1
  },
]

export const ROLES_BY_ID = Object.fromEntries(ROLES_TB.map(r => [r.id, r]))

/** 인원 수별 역할 구성 (바론 없을 때) */
export const PLAYER_COUNTS = {
  5:  { townsfolk: 3, outsider: 0, minion: 1, demon: 1 },
  6:  { townsfolk: 3, outsider: 1, minion: 1, demon: 1 },
  7:  { townsfolk: 5, outsider: 0, minion: 1, demon: 1 },
  8:  { townsfolk: 5, outsider: 1, minion: 1, demon: 1 },
  9:  { townsfolk: 5, outsider: 2, minion: 1, demon: 1 },
  10: { townsfolk: 7, outsider: 0, minion: 2, demon: 1 },
  11: { townsfolk: 7, outsider: 1, minion: 2, demon: 1 },
  12: { townsfolk: 7, outsider: 2, minion: 2, demon: 1 },
  13: { townsfolk: 9, outsider: 0, minion: 3, demon: 1 },
  14: { townsfolk: 9, outsider: 1, minion: 3, demon: 1 },
  15: { townsfolk: 9, outsider: 2, minion: 3, demon: 1 },
  // ── 16-20인 (비공식 확장 구성) ──
  16: { townsfolk: 10, outsider: 2, minion: 3, demon: 1 },
  17: { townsfolk: 11, outsider: 2, minion: 3, demon: 1 },
  18: { townsfolk: 11, outsider: 3, minion: 3, demon: 1 },
  19: { townsfolk: 12, outsider: 3, minion: 3, demon: 1 },
  20: { townsfolk: 13, outsider: 3, minion: 3, demon: 1 },
}

/**
 * 첫 밤 순서 (role id 배열)
 * special: 'minion-info', 'demon-info'
 */
export const NIGHT_ORDER_FIRST = [
  'minion-info',   // 미니언들 서로 공개 + 블러프 전달
  'demon-info',    // 데몬이 미니언 + 블러프 확인
  'poisoner',
  'washerwoman',
  'librarian',
  'investigator',
  'chef',
  'empath',
  'fortuneteller',
  'butler',
  'spy',
]

/**
 * 반복 밤 순서
 */
export const NIGHT_ORDER_OTHER = [
  'poisoner',
  'monk',
  'imp',
  'ravenkeeper',   // 밤에 사망 시에만 활성
  'undertaker',
  'empath',
  'fortuneteller',
  'butler',
  'spy',
]

/** 이모지 시그널 목록 */
export const EMOJI_SIGNALS = [
  { emoji: '👍', label: '동의' },
  { emoji: '🤫', label: '나중에 얘기' },
  { emoji: '👀', label: '저 사람 주목' },
  { emoji: '❓', label: '이해 못함' },
  { emoji: '🔪', label: '데몬 의심' },
  { emoji: '🛡️', label: '선한 것 같아' },
  { emoji: '🤝', label: '우리 편' },
  { emoji: '😱', label: '놀람' },
]
