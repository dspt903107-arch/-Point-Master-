import { Card, CardTier } from './types';

export const ADMIN_PASSWORD = '123';

export const SELL_VALUES: Record<CardTier, number> = {
  'N': 2,
  'R': 5,
  'SR': 15,
  'SSR': 50
};

export const TIER_WEIGHTS: Record<CardTier, number> = {
  'N': 60,
  'R': 25,
  'SR': 10,
  'SSR': 5
};

export const TIER_ORDER: CardTier[] = ['N', 'R', 'SR', 'SSR'];

export const TIERS: Record<CardTier, string> = {
  'N': 'bg-n-soft border-gray-300 text-gray-600',
  'R': 'bg-r-soft border-purple-300 text-purple-700',
  'SR': 'bg-sr-soft border-sky-300 text-sky-700',
  'SSR': 'bg-ssr-soft border-yellow-400 text-yellow-700'
};

export const CARD_MAP: Record<string, Card> = {
  '財神降臨': { name: '財神降臨', tier: 'SSR', icon: '💰', desc: '【抽到當下強制發動】立刻為自己加 5 點，全班其他同學每人加 2 點！化身全班英雄！' },
  '3C特權': { name: '3C特權', tier: 'SSR', icon: '📱', desc: '上課可自由使用平板/手機 10 分鐘' },
  '免死金牌': { name: '免死金牌', tier: 'SSR', icon: '🛡️', desc: '可無條件抵銷一次扣分或遲到處罰' },
  '買一送一': { name: '買一送一', tier: 'SR', icon: '🎟️', desc: '使用後，下次抽卡時會一次獲得兩張隨機卡片！' },
  '一日特別座位': { name: '一日特別座位', tier: 'SR', icon: '🪑', desc: '可自由選擇當天的專屬上課座位' },
  '免寫作業': { name: '免寫作業', tier: 'R', icon: '❌', desc: '抵免一次老師指定的回家作業' },
  '好友連線': { name: '好友連線', tier: 'R', icon: '🤝', desc: '可指定一位同學，一節課與他併桌/換位子坐在一起' },
  '再來一張': { name: '再來一張', tier: 'N', icon: '🎫', desc: '卡片本身沒特殊功能，使用後換 1 張抽獎券' },
  '作業減半': { name: '作業減半', tier: 'N', icon: '✂️', desc: '指定的一項作業份量直接減半' },
  '老師救救我': { name: '老師救救我', tier: 'N', icon: '🆘', desc: '隨堂測驗時可請老師給予一次提示或是幫忙抄一次聯絡簿' },
  '快速通關': { name: '快速通關', tier: 'N', icon: '🚀', desc: '享有排隊、點餐優先處理權' },
  '愛的鼓勵': { name: '愛的鼓勵', tier: 'N', icon: '👏', desc: '單純的鼓勵！集滿3張可換1張免死金牌' },
  '分數升級': { name: '分數升級', tier: 'N', icon: '📈', desc: '下次小考加 5 分' }
};
