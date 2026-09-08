// Common Types & Interfaces for Coffee Strike

export type WeaponType = 'PISTOL' | 'SHOTGUN' | 'SNIPER' | 'MACHINEGUN';

export interface WeaponStats {
  name: string;
  nameKo: string;
  bulletSpeed: number;
  cooldown: number; // 초 단위
  impulse: number; // 넉백 충격량
  maxAmmo: number; // 제한 모드 탄창
  range: number; // 사거리 (px)
  pelletCount: number; // 발사 수 (샷건=4, 그 외=1)
  spreadAngle: number; // 부채꼴 각도 (라디안)
  bulletRadius: number;
  color: string;
}

export const WEAPON_CONFIGS: Record<WeaponType, WeaponStats> = {
  PISTOL: {
    name: 'Balance Pistol',
    nameKo: '밸런스 피스톨',
    bulletSpeed: 600,
    cooldown: 0.35,
    impulse: 160,
    maxAmmo: 12,
    range: 480,
    pelletCount: 1,
    spreadAngle: 0,
    bulletRadius: 4,
    color: '#38bdf8' // sky blue
  },
  SHOTGUN: {
    name: 'Heavy Shotgun',
    nameKo: '헤비 샷건',
    bulletSpeed: 750,
    cooldown: 0.85,
    impulse: 85, // 펠릿당 85 x 4 = 340
    maxAmmo: 4,
    range: 300,
    pelletCount: 4,
    spreadAngle: 0.35, // 약 20도 부채꼴
    bulletRadius: 3.5,
    color: '#f97316' // orange
  },
  SNIPER: {
    name: 'Sniper Rifle',
    nameKo: '저격 스나이퍼',
    bulletSpeed: 1400,
    cooldown: 1.30,
    impulse: 460,
    maxAmmo: 3,
    range: 800,
    pelletCount: 1,
    spreadAngle: 0,
    bulletRadius: 5,
    color: '#ec4899' // pink laser
  },
  MACHINEGUN: {
    name: 'Rapid Machinegun',
    nameKo: '연사 머신건',
    bulletSpeed: 750,
    cooldown: 0.10,
    impulse: 48,
    maxAmmo: 35,
    range: 400,
    pelletCount: 1,
    spreadAngle: 0.08,
    bulletRadius: 3,
    color: '#fbbf24' // amber
  }
};

export type ItemType = 'POWER' | 'SPEED' | 'SHIELD';

export interface ItemStats {
  type: ItemType;
  nameKo: string;
  duration: number; // 초
  color: string;
  icon: string;
}

export const ITEM_CONFIGS: Record<ItemType, ItemStats> = {
  POWER: {
    type: 'POWER',
    nameKo: '파워 업',
    duration: 7.0,
    color: '#ef4444', // Red
    icon: '⚡'
  },
  SPEED: {
    type: 'SPEED',
    nameKo: '스피드 업',
    duration: 7.0,
    color: '#06b6d4', // Cyan/Blue
    icon: '👟'
  },
  SHIELD: {
    type: 'SHIELD',
    nameKo: '헤비 쉴드',
    duration: 7.0,
    color: '#eab308', // Yellow/Gold
    icon: '🛡️'
  }
};

export type Team = 'RED' | 'BLUE' | 'GREEN' | 'YELLOW' | 'NONE';

export const TEAM_COLORS: Record<Team, string> = {
  NONE: '#64748b', // slate for FFA
  RED: '#ef4444',
  BLUE: '#3b82f6',
  GREEN: '#10b981',
  YELLOW: '#f59e0b'
};

export type GameMode = 'FFA' | 'TEAM';
export type AmmoMode = 'UNLIMITED' | 'LIMITED';
export type GameState = 'LOBBY' | 'PLAYING' | 'GAMEOVER';

export interface RoomOptions {
  maxPlayers: number;
  gameMode: GameMode;
  teamCount: number; // 2, 3, 4
  duration: number; // 60, 120, 180초
  timeScale: number; // 1.0, 1.5, 2.0, 3.0
  ammoMode: AmmoMode;
}

export const DEFAULT_ROOM_OPTIONS: RoomOptions = {
  maxPlayers: 10,
  gameMode: 'FFA',
  teamCount: 2,
  duration: 120,
  timeScale: 1.0,
  ammoMode: 'UNLIMITED'
};

export interface JoystickInput {
  active: boolean;
  dx: number; // -1.0 ~ 1.0
  dy: number; // -1.0 ~ 1.0
  originX: number;
  originY: number;
  currentX: number;
  currentY: number;
}

export interface PlayerSnapshot {
  id: string;
  nickname: string;
  team: Team;
  isHost: boolean;
  isBot: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  weapon: WeaponType;
  ammo: number;
  isReloading: boolean;
  isFalling: boolean;
  isDead: boolean;
  fallScale: number;
  fallAlpha: number;
  buffs: {
    power: number;
    speed: number;
    shield: number;
  };
  ringOutRank?: number; // 먼저 떨어진 순위 (1 = 가장 먼저 탈락)
  surviveTime: number; // 생존 시간 (초)
}

export interface BulletSnapshot {
  id: string;
  shooterId: string;
  shooterTeam: Team;
  weapon: WeaponType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
}

export interface ObstacleSnapshot {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ItemSnapshot {
  id: string;
  type: ItemType;
  x: number;
  y: number;
  radius: number;
  lifetime: number;
}

export interface WorldSnapshot {
  timeRemaining: number;
  totalDuration: number;
  timeScale: number;
  isSuddenDeath: boolean;
  players: PlayerSnapshot[];
  bullets: BulletSnapshot[];
  obstacles: ObstacleSnapshot[];
  items: ItemSnapshot[];
}

export interface GameResult {
  winnerId?: string;
  winnerNickname?: string;
  winnerTeam?: Team;
  coffeeBuyer: {
    id: string;
    nickname: string;
    reason: string;
    team: Team;
  };
  rankings: Array<{
    rank: number;
    nickname: string;
    team: Team;
    surviveTime: number;
    isCoffeeBuyer: boolean;
  }>;
}
