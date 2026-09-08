import { RoomOptions, Team, WorldSnapshot, GameResult } from '../engine/Types';

export type PacketType =
  | 'C2S_JOIN'
  | 'C2S_INPUT'
  | 'S2C_LOBBY_SYNC'
  | 'S2C_GAME_START'
  | 'S2C_STATE'
  | 'S2C_GAME_OVER';

export interface C2S_JoinPacket {
  type: 'C2S_JOIN';
  id: string;
  nickname: string;
  team: Team;
}

export interface C2S_InputPacket {
  type: 'C2S_INPUT';
  id: string;
  dx: number;
  dy: number;
}

export interface S2C_LobbySyncPacket {
  type: 'S2C_LOBBY_SYNC';
  roomCode: string;
  options: RoomOptions;
  players: Array<{
    id: string;
    nickname: string;
    isHost: boolean;
    team: Team;
  }>;
}

export interface S2C_GameStartPacket {
  type: 'S2C_GAME_START';
  options: RoomOptions;
  assignedWeapon: any;
}

export interface S2C_StatePacket {
  type: 'S2C_STATE';
  snapshot: WorldSnapshot;
}

export interface S2C_GameOverPacket {
  type: 'S2C_GAME_OVER';
  result: GameResult;
}

export type NetworkPacket =
  | C2S_JoinPacket
  | C2S_InputPacket
  | S2C_LobbySyncPacket
  | S2C_GameStartPacket
  | S2C_StatePacket
  | S2C_GameOverPacket;
