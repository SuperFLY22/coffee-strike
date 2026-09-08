import { Peer, DataConnection } from 'peerjs';
import { NetworkPacket, S2C_LobbySyncPacket } from './Protocol';
import { RoomOptions, Team } from '../engine/Types';

export interface NetworkCallbacks {
  onPacketReceived: (packet: NetworkPacket, senderId: string) => void;
  onPlayerConnected?: (peerId: string) => void;
  onPlayerDisconnected?: (peerId: string) => void;
  onError?: (err: any) => void;
}

export class NetworkManager {
  private peer: Peer | null = null;
  private hostConnection: DataConnection | null = null;
  private guestConnections: Map<string, DataConnection> = new Map();

  public isHost: boolean = false;
  public myPeerId: string = '';
  public currentRoomCode: string = '';

  constructor(private callbacks: NetworkCallbacks) {}

  public generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * 호스트로 방 생성
   */
  public async createRoom(roomCode: string): Promise<string> {
    this.isHost = true;
    this.currentRoomCode = roomCode;
    const peerId = `coffee-${roomCode.toLowerCase()}`;

    return new Promise((resolve, reject) => {
      try {
        this.peer = new Peer(peerId, {
          debug: 1,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' }
            ]
          }
        });

        this.peer.on('open', (id) => {
          this.myPeerId = id;
          resolve(id);
        });

        this.peer.on('connection', (conn) => {
          this.setupGuestConnection(conn);
        });

        this.peer.on('error', (err) => {
          if (this.callbacks.onError) this.callbacks.onError(err);
          reject(err);
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  private setupGuestConnection(conn: DataConnection): void {
    conn.on('open', () => {
      if (this.guestConnections.size >= 9) {
        conn.close();
        return;
      }
      this.guestConnections.set(conn.peer, conn);
      if (this.callbacks.onPlayerConnected) {
        this.callbacks.onPlayerConnected(conn.peer);
      }
    });

    conn.on('data', (data) => {
      this.callbacks.onPacketReceived(data as NetworkPacket, conn.peer);
    });

    conn.on('close', () => {
      this.guestConnections.delete(conn.peer);
      if (this.callbacks.onPlayerDisconnected) {
        this.callbacks.onPlayerDisconnected(conn.peer);
      }
    });

    conn.on('error', (err) => {
      this.guestConnections.delete(conn.peer);
      if (this.callbacks.onError) this.callbacks.onError(err);
    });
  }

  /**
   * 게스트로 방 참가
   */
  public async joinRoom(roomCode: string, nickname: string, team: Team): Promise<void> {
    this.isHost = false;
    this.currentRoomCode = roomCode;
    const hostPeerId = `coffee-${roomCode.toLowerCase()}`;

    return new Promise((resolve, reject) => {
      try {
        this.peer = new Peer({
          debug: 1,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' }
            ]
          }
        });

        this.peer.on('open', (id) => {
          this.myPeerId = id;
          const conn = this.peer!.connect(hostPeerId, { reliable: false });
          this.hostConnection = conn;

          conn.on('open', () => {
            // 접속 완료 시 즉시 C2S_JOIN 전송
            this.sendToHost({
              type: 'C2S_JOIN',
              id: this.myPeerId,
              nickname,
              team
            });
            resolve();
          });

          conn.on('data', (data) => {
            this.callbacks.onPacketReceived(data as NetworkPacket, hostPeerId);
          });

          conn.on('close', () => {
            if (this.callbacks.onPlayerDisconnected) {
              this.callbacks.onPlayerDisconnected(hostPeerId);
            }
          });

          conn.on('error', (err) => {
            if (this.callbacks.onError) this.callbacks.onError(err);
            reject(err);
          });
        });

        this.peer.on('error', (err) => {
          if (this.callbacks.onError) this.callbacks.onError(err);
          reject(err);
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  /**
   * 호스트: 모든 게스트에게 브로드캐스트
   */
  public broadcast(packet: NetworkPacket): void {
    if (!this.isHost) return;
    for (const conn of this.guestConnections.values()) {
      if (conn.open) {
        conn.send(packet);
      }
    }
  }

  /**
   * 게스트: 호스트에게 단일 전송
   */
  public sendToHost(packet: NetworkPacket): void {
    if (this.hostConnection && this.hostConnection.open) {
      this.hostConnection.send(packet);
    }
  }

  public disconnect(): void {
    if (this.hostConnection) {
      this.hostConnection.close();
      this.hostConnection = null;
    }
    for (const conn of this.guestConnections.values()) {
      conn.close();
    }
    this.guestConnections.clear();
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
  }
}
