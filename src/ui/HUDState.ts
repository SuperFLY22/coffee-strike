// HUD View-Model DTO for Coffee Strike
import { AmmoMode, WeaponType } from '../engine/Types';

export interface HUDPlayerState {
  hp: number;
  maxHp: number;
  heatPercent: number;
  weapon: WeaponType;
  ammo: number;
  maxAmmo: number;
  isReloading: boolean;
  reloadTimer: number;
  invincibleRemaining: number;
  powerRemaining: number;
}

export interface HUDState {
  timeRemaining: number;
  totalDuration: number;
  timeScale: number;
  isSuddenDeath: boolean;
  aliveCount: number;
  totalCount: number;
  ammoMode: AmmoMode;
  myPlayer?: HUDPlayerState;
}
