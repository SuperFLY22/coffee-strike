import { Peer, DataConnection } from 'peerjs';
import { NetworkPacket } from './Protocol';
import { Team } from '../engine/Types';

export interface NetworkCallbacks {
  onPacketReceived: (packet: NetworkPacket, senderId: string) => void;
  onPlayerConnected?: (peerId: string) => void;
  onPlayerDisconnected?: (peerId: string) => void;
  onError?: (err: any) => void;
}

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' }
];

export class NetworkManager {
  private peer: Peer | null = null;
  private hostConnection: DataConnection | null = null;
  private guestConnections: Map<string, DataConnection> = new Map();

  public isHost: boolean = false;
  public myPeerId: string = '';
  public currentRoomCode: string = '';

  constructor(private callbacks: NetworkCallbacks) {}

  public generateRoomCode(): string {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // 헷갈리는 0, 1, I, O 제외
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
    this.disconnect();
    this.isHost = true;
    this.currentRoomCode = roomCode.trim().toUpperCase();
    const peerId = `coffee-${this.currentRoomCode.toLowerCase()}`;

    return new Promise((resolve, reject) => {
      let isResolved = false;

      try {
        this.peer = new Peer(peerId, {
          debug: 1,
          config: { iceServers: ICE_SERVERS }
        });

        // 10초 타임아웃
        const timeout = setTimeout(() => {
          if (!isResolved) {
            reject(new Error('시그널링 서버 연결 시간 초과. 네트워크 상태를 확인하세요.'));
          }
        }, 10000);

        this.peer.on('open', (id) => {
          isResolved = true;
          clearTimeout(timeout);
          this.myPeerId = id;
          resolve(id);
        });

        this.peer.on('connection', (conn) => {
          this.setupGuestConnection(conn);
        });

        this.peer.on('error', (err: any) => {
          console.error('[Host Peer Error]', err);
          if (err.type === 'unavailable-id') {
            reject(new Error(`룸 코드(${this.currentRoomCode})가 이미 사용 중입니다. 다시 시도해주세요.`));
          } else {
            if (this.callbacks.onError) this.callbacks.onError(err);
            if (!isResolved) reject(err);
          }
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  private setupGuestConnection(conn: DataConnection): void {
    const registerGuest = () => {
      const existing = this.guestConnections.get(conn.peer);
      if (existing && existing !== conn) {
        try { existing.close(); } catch {}
      }
      if (this.guestConnections.size >= 9) {
        conn.close();
        return;
      }
      this.guestConnections.set(conn.peer, conn);
      if (this.callbacks.onPlayerConnected) {
        this.callbacks.onPlayerConnected(conn.peer);
      }
    };

    if (conn.open) {
      registerGuest();
    } else {
      conn.on('open', registerGuest);
    }

    conn.on('data', (data) => {
      if (!this.guestConnections.has(conn.peer)) {
        this.guestConnections.set(conn.peer, conn);
      }
      this.callbacks.onPacketReceived(data as NetworkPacket, conn.peer);
    });

    conn.on('close', () => {
      this.guestConnections.delete(conn.peer);
      if (this.callbacks.onPlayerDisconnected) {
        this.callbacks.onPlayerDisconnected(conn.peer);
      }
    });

    conn.on('error', (err) => {
      console.warn('[Guest Connection Error]', conn.peer, err);
      if (this.callbacks.onError) this.callbacks.onError(err);
    });
  }

  /**
   * 게스트로 방 참가
   */
  public async joinRoom(roomCode: string, nickname: string, team: Team): Promise<void> {
    this.disconnect();
    this.isHost = false;
    this.currentRoomCode = roomCode.trim().toUpperCase();
    const hostPeerId = `coffee-${this.currentRoomCode.toLowerCase()}`;

    return new Promise((resolve, reject) => {
      let isResolved = false;

      try {
        this.peer = new Peer({
          debug: 1,
          config: { iceServers: ICE_SERVERS }
        });

        const connectionTimeout = setTimeout(() => {
          if (!isResolved) {
            this.disconnect();
            reject(new Error(`방(${this.currentRoomCode}) 연결 시간 초과. 통신망 상태를 확인하고 다시 시도하세요.`));
          }
        }, 20000);

        this.peer.on('open', (id) => {
          this.myPeerId = id;

          // 표준 SCTP 기반 안정적 데이터 채널 오픈
          const conn = this.peer!.connect(hostPeerId, {
            serialization: 'json'
          });
          this.hostConnection = conn;

          conn.on('open', () => {
            isResolved = true;
            clearTimeout(connectionTimeout);

            // 접속 성공 시 C2S_JOIN 전송 (신뢰성을 위해 0.4초 간격으로 2회 연속 보장)
            const joinPacket = {
              type: 'C2S_JOIN' as const,
              id: this.myPeerId,
              nickname,
              team
            };
            conn.send(joinPacket);
            setTimeout(() => {
              if (conn.open) conn.send(joinPacket);
            }, 400);

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
            console.error('[Host Conn Error]', err);
            if (!isResolved) {
              clearTimeout(connectionTimeout);
              reject(new Error(`호스트 연결 실패: ${err.message || '네트워크 오류'}`));
            }
          });
        });

        this.peer.on('error', (err: any) => {
          console.error('[Guest Peer Error]', err);
          if (!isResolved) {
            clearTimeout(connectionTimeout);
            if (err.type === 'peer-unavailable') {
              reject(new Error(`방 코드 "${this.currentRoomCode}"에 해당하는 호스트를 찾을 수 없습니다.`));
            } else {
              reject(err);
            }
          }
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
      if (conn.open || (conn.dataChannel && conn.dataChannel.readyState === 'open')) {
        try {
          conn.send(packet);
        } catch (e) {
          console.warn('[Broadcast send failed]', conn.peer, e);
        }
      }
    }
  }

  /**
   * 호스트: 특정 게스트에게 단일 전송 (재시작 패킷 보장용)
   */
  public sendToPeer(peerId: string, packet: NetworkPacket): void {
    const conn = this.guestConnections.get(peerId);
    if (conn && (conn.open || (conn.dataChannel && conn.dataChannel.readyState === 'open'))) {
      try {
        conn.send(packet);
      } catch (e) {
        console.warn('[sendToPeer failed]', peerId, e);
      }
    }
  }

  /**
   * 게스트: 호스트에게 단일 전송
   */
  public sendToHost(packet: NetworkPacket): void {
    if (this.hostConnection && (this.hostConnection.open || (this.hostConnection.dataChannel && this.hostConnection.dataChannel.readyState === 'open'))) {
      try {
        this.hostConnection.send(packet);
      } catch (e) {
        console.warn('[sendToHost failed]', e);
      }
    }
  }

  public disconnect(): void {
    if (this.hostConnection) {
      try { this.hostConnection.close(); } catch {}
      this.hostConnection = null;
    }
    for (const conn of this.guestConnections.values()) {
      try { conn.close(); } catch {}
    }
    this.guestConnections.clear();
    if (this.peer) {
      try { this.peer.destroy(); } catch {}
      this.peer = null;
    }
    this.isHost = false;
    this.myPeerId = '';
  }
}
