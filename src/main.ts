import './style.css';
import { Game } from './engine/Game';
import { HUD } from './ui/HUD';
import { LobbyUI } from './ui/LobbyUI';
import { NetworkManager } from './net/Network';
import {
  GameMode,
  RoomOptions,
  Team,
  WeaponType,
  GameResult
} from './engine/Types';
import { NetworkPacket, WorldSnapshot } from './net/Protocol';
import { Player } from './objects/Player';
import { ARENA_CONFIG } from './engine/Physics';

class CoffeeStrikeApp {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private game: Game;
  private hud: HUD;
  private lobbyUI: LobbyUI;
  private network: NetworkManager;

  private isMultiplayer: boolean = false;
  private isHost: boolean = false;
  private myNickname: string = '플레이어';
  private myTeam: Team = 'NONE';
  private currentOptions!: RoomOptions;

  // 멀티플레이어 대기실 플레이어 목록
  private lobbyPlayers: Array<{ id: string; nickname: string; isHost: boolean; team: Team }> = [];

  // 호스트 브로드캐스트 / 클라이언트 인풋 전송 인터벌
  private netSyncTimer: number | null = null;

  constructor() {
    this.container = document.getElementById('game-container') as HTMLElement;
    this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

    this.game = new Game(this.canvas, this.container);
    this.hud = new HUD(this.container);

    this.network = new NetworkManager({
      onPacketReceived: this.onPacketReceived.bind(this),
      onPlayerConnected: (peerId) => {
        console.log('[Network] Peer connected:', peerId);
        if (this.isHost) {
          this.broadcastLobbySync();
        }
      },
      onPlayerDisconnected: this.onPlayerDisconnected.bind(this),
      onError: (err) => console.error('[Network Error]', err)
    });

    this.lobbyUI = new LobbyUI(this.container, {
      onStartSinglePlayer: this.startSinglePlayer.bind(this),
      onCreateRoom: this.createMultiplayerRoom.bind(this),
      onJoinRoom: this.joinMultiplayerRoom.bind(this),
      onStartMultiplayerGame: this.startMultiplayerHostGame.bind(this)
    });

    // HUD 이벤트 바인딩
    this.hud.onReplayClick = () => {
      if (this.isMultiplayer) {
        if (this.isHost) {
          this.startMultiplayerHostGame();
        }
      } else {
        this.startSinglePlayer(this.myNickname);
      }
    };

    this.hud.onExitLobbyClick = () => {
      this.exitToMainMenu();
    };

    this.game.gameOverCallback = (result: GameResult) => {
      if (this.isMultiplayer && this.isHost) {
        this.network.broadcast({
          type: 'S2C_GAME_OVER',
          result
        });
      }
      this.hud.showGameOver(result, this.isHost);
    };

    // 초기 상태: 로비 표시, HUD 숨김
    this.hud.hide();
    this.lobbyUI.show();

    // HUD 업데이트 루프
    this.startHUDUpdateLoop();
  }

  private startHUDUpdateLoop(): void {
    const tick = () => {
      if (this.game.isRunning) {
        this.hud.update(this.game);
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /**
   * 로컬 싱글 플레이 (봇 3기)
   */
  private startSinglePlayer(nickname: string): void {
    this.myNickname = nickname;
    this.isMultiplayer = false;
    this.isHost = true;

    this.lobbyUI.hide();
    this.hud.show();
    this.game.initLocalGame(nickname);

    this.game.onCountdownTick = (val) => {
      this.hud.showCountdown(val);
    };
    this.game.onCountdownFinished = () => {
      this.hud.hideCountdown();
    };
    this.game.startCountdown();
  }

  /**
   * 멀티플레이어 호스트: 방 생성
   */
  private async createMultiplayerRoom(nickname: string, options: RoomOptions): Promise<void> {
    this.myNickname = nickname;
    this.currentOptions = options;
    this.isMultiplayer = true;
    this.isHost = true;
    this.myTeam = options.gameMode === 'TEAM' ? 'RED' : 'NONE';

    this.lobbyUI.renderLoading('방 개설 중...', 'WebRTC P2P 무료 시그널링 채널 초기화 중');

    const roomCode = this.network.generateRoomCode();
    try {
      const peerId = await this.network.createRoom(roomCode);
      this.game.myPlayerId = peerId;

      this.lobbyPlayers = [
        { id: peerId, nickname, isHost: true, team: this.myTeam }
      ];

      this.lobbyUI.renderWaitingRoom(roomCode, true, this.lobbyPlayers, options);
    } catch (e: any) {
      alert(`방 생성 실패: ${e.message || e}`);
      this.lobbyUI.renderCreateRoom();
    }
  }

  /**
   * 멀티플레이어 게스트: 방 참가
   */
  private async joinMultiplayerRoom(nickname: string, roomCode: string, team: Team): Promise<void> {
    this.myNickname = nickname;
    this.isMultiplayer = true;
    this.isHost = false;
    this.myTeam = team;

    this.lobbyUI.renderLoading('방 찾는 중...', `[${roomCode}] 호스트와 P2P 핸드셰이크 연결 중`);

    try {
      await this.network.joinRoom(roomCode, nickname, team);
      this.game.myPlayerId = this.network.myPeerId;
      this.lobbyPlayers = [
        { id: this.network.myPeerId, nickname, isHost: false, team }
      ];
      this.currentOptions = {
        maxPlayers: 10,
        gameMode: team === 'NONE' ? 'FFA' : 'TEAM',
        teamCount: 2,
        duration: 120,
        timeScale: 1.0,
        ammoMode: 'UNLIMITED'
      };

      this.lobbyUI.renderWaitingRoom(roomCode, false, this.lobbyPlayers, this.currentOptions);
    } catch (e: any) {
      alert(`접속 실패: ${e.message || e}`);
      this.lobbyUI.renderJoinRoom();
    }
  }

  /**
   * 호스트: 멀티플레이어 게임 시작
   */
  private startMultiplayerHostGame(): void {
    this.lobbyUI.hide();
    this.hud.show();

    this.game.resetState();
    this.game.setOptions(this.currentOptions);
    this.game.isHost = true;
    this.game.isMultiplayer = true;

    const weapons: WeaponType[] = ['PISTOL', 'SHOTGUN', 'SNIPER', 'MACHINEGUN'];
    const totalCount = this.lobbyPlayers.length;

    // 플레이어들을 링 경계로부터 안전한 중심 반경(145px)으로 균등 분산 배치 (즉사 방지)
    const angleStep = (Math.PI * 2) / Math.max(1, totalCount);
    const startAngle = Math.PI / 2; // 호스트 플레이어 6시 하단 배치

    this.lobbyPlayers.forEach((lp, idx) => {
      const angle = startAngle + angleStep * idx;
      const dist = 145;
      const x = ARENA_CONFIG.centerX + Math.cos(angle) * dist;
      const y = ARENA_CONFIG.centerY + Math.sin(angle) * dist;
      const weapon = weapons[Math.floor(Math.random() * weapons.length)];

      const player = new Player(
        lp.id,
        lp.nickname,
        lp.team,
        x,
        y,
        weapon,
        lp.isHost,
        false
      );
      player.fireCooldownTimer = 1.0;
      this.game.players.set(player.id, player);
    });

    this.game.spawnObstacles();

    // 게스트들에게 게임 시작 패킷 및 초기 월드 스냅샷 브로드캐스트 (다중 전송으로 모바일 패킷 유실 방지)
    const initialSnapshot = this.game.createWorldSnapshot();
    const startPacket: NetworkPacket = {
      type: 'S2C_GAME_START',
      options: this.currentOptions,
      assignedWeapon: 'PISTOL',
      initialSnapshot
    };
    this.network.broadcast(startPacket);
    setTimeout(() => this.network.broadcast(startPacket), 100);
    setTimeout(() => this.network.broadcast(startPacket), 300);

    this.game.onCountdownTick = (val) => {
      this.hud.showCountdown(val);
    };
    this.game.onCountdownFinished = () => {
      this.hud.hideCountdown();
    };
    this.game.startCountdown();

    // 30Hz (약 33ms) 월드 스냅샷 브로드캐스트 시작
    if (this.netSyncTimer) clearInterval(this.netSyncTimer);
    this.netSyncTimer = window.setInterval(() => {
      if (this.game.isRunning) {
        this.network.broadcast({
          type: 'S2C_STATE',
          snapshot: this.game.createWorldSnapshot()
        });
      }
    }, 33);
  }

  /**
   * 게스트: 게임 화면 진입 및 30Hz 인풋 송신 루프 시작
   */
  private startGuestGameLoop(initialSnapshot?: WorldSnapshot): void {
    if (this.game.isRunning) return;
    this.lobbyUI.hide();
    this.hud.show();

    this.game.resetState();
    this.game.setOptions(this.currentOptions);
    this.game.isHost = false;
    this.game.isMultiplayer = true;

    if (initialSnapshot) {
      this.game.applyWorldSnapshot(initialSnapshot);
    }

    this.game.onCountdownTick = (val) => {
      this.hud.showCountdown(val);
    };
    this.game.onCountdownFinished = () => {
      this.hud.hideCountdown();
    };
    this.game.startCountdown();

    // 30Hz로 내 조이스틱 입력을 호스트에게 전송
    if (this.netSyncTimer) clearInterval(this.netSyncTimer);
    this.netSyncTimer = window.setInterval(() => {
      if (this.game.isRunning && !this.game.isCountingDown) {
        const input = this.game.joystick.getInput();
        this.network.sendToHost({
          type: 'C2S_INPUT',
          id: this.game.myPlayerId,
          dx: input.dx,
          dy: input.dy
        });
      }
    }, 33);
  }

  /**
   * 네트워크 패킷 수신 처리
   */
  private onPacketReceived(packet: NetworkPacket, senderId: string): void {
    switch (packet.type) {
      case 'C2S_JOIN': {
        if (this.isHost) {
          // 중복 방지
          if (!this.lobbyPlayers.some(p => p.id === packet.id)) {
            this.lobbyPlayers.push({
              id: packet.id,
              nickname: packet.nickname,
              isHost: false,
              team: packet.team
            });
          }
          // 전체 대기실 동기화 패킷 브로드캐스트
          this.broadcastLobbySync();
          this.lobbyUI.renderWaitingRoom(
            this.network.currentRoomCode,
            true,
            this.lobbyPlayers,
            this.currentOptions
          );
        }
        break;
      }

      case 'C2S_INPUT': {
        if (this.isHost && this.game.isRunning) {
          const p = this.game.players.get(packet.id);
          if (p && !p.isDead && !p.isFalling) {
            // 호스트가 물리 연산에 즉시 반영
            p.applyInput(packet.dx, packet.dy, 1 / 30);
          }
        }
        break;
      }

      case 'S2C_LOBBY_SYNC': {
        if (!this.isHost) {
          this.currentOptions = packet.options;
          this.lobbyPlayers = packet.players;
          this.lobbyUI.renderWaitingRoom(
            packet.roomCode,
            false,
            this.lobbyPlayers,
            packet.options
          );
        }
        break;
      }

      case 'S2C_GAME_START': {
        if (!this.isHost) {
          this.currentOptions = packet.options;
          this.startGuestGameLoop(packet.initialSnapshot);
        }
        break;
      }

      case 'S2C_STATE': {
        if (!this.isHost) {
          // 호스트가 게임을 이미 시작했으나 S2C_GAME_START 패킷이 누락되었을 때 자동 자가 복구 (Fail-safe)
          if (!this.game.isRunning) {
            this.startGuestGameLoop(packet.snapshot);
          }
          this.game.applyWorldSnapshot(packet.snapshot);
        }
        break;
      }

      case 'S2C_GAME_OVER': {
        this.game.stop();
        this.hud.showGameOver(packet.result, false);
        break;
      }
    }
  }

  private broadcastLobbySync(): void {
    if (!this.isHost) return;
    this.network.broadcast({
      type: 'S2C_LOBBY_SYNC',
      roomCode: this.network.currentRoomCode,
      options: this.currentOptions,
      players: this.lobbyPlayers
    });
  }

  private onPlayerConnected(peerId: string): void {
    console.log('[Network] Peer connected:', peerId);
  }

  private onPlayerDisconnected(peerId: string): void {
    console.log('[Network] Peer disconnected:', peerId);
    this.lobbyPlayers = this.lobbyPlayers.filter(p => p.id !== peerId);
    if (this.isHost) {
      this.game.players.delete(peerId);
      this.broadcastLobbySync();
      if (!this.game.isRunning) {
        this.lobbyUI.renderWaitingRoom(
          this.network.currentRoomCode,
          true,
          this.lobbyPlayers,
          this.currentOptions
        );
      }
    }
  }

  private exitToMainMenu(): void {
    this.game.stop();
    if (this.netSyncTimer) {
      clearInterval(this.netSyncTimer);
      this.netSyncTimer = null;
    }
    this.network.disconnect();
    this.isMultiplayer = false;
    this.isHost = false;

    this.hud.hide();
    this.lobbyUI.show();
    this.lobbyUI.renderMainMenu();
  }
}

// 애플리케이션 시작
window.addEventListener('DOMContentLoaded', () => {
  new CoffeeStrikeApp();
});
