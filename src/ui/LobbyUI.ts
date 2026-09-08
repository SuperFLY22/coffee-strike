import { GameMode, RoomOptions, Team, DEFAULT_ROOM_OPTIONS } from '../engine/Types';

export interface LobbyCallbacks {
  onStartSinglePlayer: (nickname: string) => void;
  onCreateRoom: (nickname: string, options: RoomOptions) => void;
  onJoinRoom: (nickname: string, roomCode: string, team: Team) => void;
  onStartMultiplayerGame: () => void;
}

export class LobbyUI {
  private container: HTMLElement;
  private rootEl!: HTMLElement;
  private callbacks: LobbyCallbacks;

  public currentRoomCode: string | null = null;
  public isHost: boolean = false;

  constructor(container: HTMLElement, callbacks: LobbyCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.init();
  }

  private init(): void {
    this.rootEl = document.createElement('div');
    this.rootEl.className = 'lobby-container';
    this.container.appendChild(this.rootEl);
    this.renderMainMenu();

    // URL 쿼리 파라미터에 ?room=xxxxxx 가 있는지 확인하여 자동 입력
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
      const codeInput = this.rootEl.querySelector('#join-code-input') as HTMLInputElement;
      if (codeInput) codeInput.value = roomParam.toUpperCase();
    }
  }

  public renderMainMenu(): void {
    const randomNick = '요원_' + Math.floor(100 + Math.random() * 900);

    this.rootEl.innerHTML = `
      <div class="lobby-card">
        <div class="lobby-header">
          <div class="brand-logo">☕💥</div>
          <h1 class="game-title">COFFEE STRIKE</h1>
          <p class="game-subtitle">10인 실시간 넉아웃 슈터: 오늘 커피 쏠 사람은?</p>
        </div>

        <div class="form-group">
          <label class="form-label" for="user-nick">닉네임</label>
          <input type="text" id="user-nick" class="form-input" value="${randomNick}" maxlength="10" placeholder="닉네임 입력">
        </div>

        <div class="lobby-actions">
          <button id="btn-play-single" class="btn btn-emerald">
            🤖 싱글 플레이 (봇 3기와 즉시 테스트)
          </button>

          <div class="divider"><span>또는 멀티플레이어</span></div>

          <div class="multi-btn-row">
            <button id="btn-open-create" class="btn btn-primary">
              👑 방 만들기 (호스트)
            </button>
            <button id="btn-open-join" class="btn btn-secondary">
              🔗 방 참가하기
            </button>
          </div>
        </div>
      </div>
    `;

    // 이벤트 리스너
    this.rootEl.querySelector('#btn-play-single')?.addEventListener('click', () => {
      const nick = (this.rootEl.querySelector('#user-nick') as HTMLInputElement).value.trim() || '요원';
      this.callbacks.onStartSinglePlayer(nick);
    });

    this.rootEl.querySelector('#btn-open-create')?.addEventListener('click', () => {
      this.renderCreateRoom();
    });

    this.rootEl.querySelector('#btn-open-join')?.addEventListener('click', () => {
      this.renderJoinRoom();
    });
  }

  public renderCreateRoom(): void {
    const nick = (this.rootEl.querySelector('#user-nick') as HTMLInputElement)?.value.trim() || '방장';

    this.rootEl.innerHTML = `
      <div class="lobby-card">
        <div class="lobby-header">
          <h2 class="section-title">👑 멀티플레이어 방 만들기</h2>
          <p class="game-subtitle">방장이 물리 연산과 동기화를 주도합니다</p>
        </div>

        <div class="options-grid">
          <div class="option-item">
            <label class="form-label">게임 모드</label>
            <select id="opt-mode" class="form-select">
              <option value="FFA">개인전 (FFA)</option>
              <option value="TEAM">팀전 (Team Battle)</option>
            </select>
          </div>

          <div class="option-item" id="opt-team-count-box" style="display:none;">
            <label class="form-label">팀 수</label>
            <select id="opt-teams" class="form-select">
              <option value="2">2팀 (청 / 홍)</option>
              <option value="3">3팀 (청 / 홍 / 녹)</option>
              <option value="4">4팀 (청 / 홍 / 녹 / 황)</option>
            </select>
          </div>

          <div class="option-item">
            <label class="form-label">경기 시간</label>
            <select id="opt-duration" class="form-select">
              <option value="60">60초 (빠른 한 판)</option>
              <option value="120" selected>120초 (정식 룰)</option>
              <option value="180">180초 (롱게임)</option>
            </select>
          </div>

          <div class="option-item">
            <label class="form-label">게임 배속</label>
            <select id="opt-scale" class="form-select">
              <option value="1.0" selected>1.0x (표준)</option>
              <option value="1.5">1.5x (스피디)</option>
              <option value="2.0">2.0x (하드코어)</option>
              <option value="3.0">3.0x (광란의 난타)</option>
            </select>
          </div>

          <div class="option-item">
            <label class="form-label">탄약 모드</label>
            <select id="opt-ammo" class="form-select">
              <option value="UNLIMITED" selected>무제한 난사</option>
              <option value="LIMITED">탄약 제한 (1.2s 재장전)</option>
            </select>
          </div>
        </div>

        <div class="btn-group-row">
          <button id="btn-back-menu" class="btn btn-secondary">뒤로가기</button>
          <button id="btn-confirm-create" class="btn btn-primary">룸 개설 및 대기실 입장</button>
        </div>
      </div>
    `;

    const modeSelect = this.rootEl.querySelector('#opt-mode') as HTMLSelectElement;
    const teamCountBox = this.rootEl.querySelector('#opt-team-count-box') as HTMLElement;

    modeSelect?.addEventListener('change', () => {
      teamCountBox.style.display = modeSelect.value === 'TEAM' ? 'block' : 'none';
    });

    this.rootEl.querySelector('#btn-back-menu')?.addEventListener('click', () => {
      this.renderMainMenu();
    });

    this.rootEl.querySelector('#btn-confirm-create')?.addEventListener('click', () => {
      const mode = modeSelect.value as GameMode;
      const teamCount = parseInt((this.rootEl.querySelector('#opt-teams') as HTMLSelectElement).value, 10);
      const duration = parseInt((this.rootEl.querySelector('#opt-duration') as HTMLSelectElement).value, 10);
      const timeScale = parseFloat((this.rootEl.querySelector('#opt-scale') as HTMLSelectElement).value);
      const ammoMode = (this.rootEl.querySelector('#opt-ammo') as HTMLSelectElement).value as any;

      const options: RoomOptions = {
        maxPlayers: 10,
        gameMode: mode,
        teamCount,
        duration,
        timeScale,
        ammoMode
      };

      this.callbacks.onCreateRoom(nick, options);
    });
  }

  public renderJoinRoom(): void {
    const nick = (this.rootEl.querySelector('#user-nick') as HTMLInputElement)?.value.trim() || '참가자';

    this.rootEl.innerHTML = `
      <div class="lobby-card">
        <div class="lobby-header">
          <h2 class="section-title">🔗 룸 참가하기</h2>
          <p class="game-subtitle">호스트의 룸 코드를 입력하거나 공유 링크로 접속하세요</p>
        </div>

        <div class="form-group">
          <label class="form-label" for="join-code-input">룸 코드 (6자리)</label>
          <input type="text" id="join-code-input" class="form-input code-input" placeholder="예: AB12CD" maxlength="8">
        </div>

        <div class="form-group" id="team-select-group">
          <label class="form-label">팀 선택</label>
          <select id="join-team-select" class="form-select">
            <option value="NONE">개인전 / 자동 배정</option>
            <option value="RED">🔴 레드 팀</option>
            <option value="BLUE">🔵 블루 팀</option>
            <option value="GREEN">🟢 그린 팀</option>
            <option value="YELLOW">🟡 옐로우 팀</option>
          </select>
        </div>

        <div class="btn-group-row">
          <button id="btn-back-menu" class="btn btn-secondary">뒤로가기</button>
          <button id="btn-confirm-join" class="btn btn-primary">접속하기</button>
        </div>
      </div>
    `;

    this.rootEl.querySelector('#btn-back-menu')?.addEventListener('click', () => {
      this.renderMainMenu();
    });

    this.rootEl.querySelector('#btn-confirm-join')?.addEventListener('click', () => {
      const code = (this.rootEl.querySelector('#join-code-input') as HTMLInputElement).value.trim().toUpperCase();
      const team = (this.rootEl.querySelector('#join-team-select') as HTMLSelectElement).value as Team;
      if (!code) {
        alert('룸 코드를 입력해주세요.');
        return;
      }
      this.callbacks.onJoinRoom(nick, code, team);
    });
  }

  public renderWaitingRoom(
    roomCode: string,
    isHost: boolean,
    players: Array<{ id: string; nickname: string; isHost: boolean; team: Team }>,
    options: RoomOptions
  ): void {
    this.currentRoomCode = roomCode;
    this.isHost = isHost;

    const shareUrl = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;

    this.rootEl.innerHTML = `
      <div class="lobby-card">
        <div class="lobby-header">
          <div class="room-code-badge">
            <span class="code-title">ROOM CODE</span>
            <div class="code-val-row">
              <span class="room-code-txt">${roomCode}</span>
              <button id="btn-copy-link" class="btn btn-sm btn-ghost">📋 초대 링크 복사</button>
            </div>
          </div>
          <div class="room-spec-tags">
            <span class="spec-tag">${options.gameMode === 'FFA' ? '개인전' : `팀전 (${options.teamCount}팀)`}</span>
            <span class="spec-tag">${options.duration}초</span>
            <span class="spec-tag">${options.timeScale}x 배속</span>
            <span class="spec-tag">${options.ammoMode === 'UNLIMITED' ? '무제한 탄약' : '탄약 제한'}</span>
          </div>
        </div>

        <div class="player-list-section">
          <div class="list-header">
            <span>참가자 명단</span>
            <span class="count-badge">${players.length} / 10명</span>
          </div>
          <div class="player-list-grid">
            ${players.map(p => `
              <div class="player-chip team-${p.team.toLowerCase()}">
                <span class="chip-host">${p.isHost ? '👑' : '👤'}</span>
                <span class="chip-nick">${p.nickname}</span>
                ${p.team !== 'NONE' ? `<span class="chip-team team-badge-${p.team.toLowerCase()}">${p.team}</span>` : ''}
              </div>
            `).join('')}
          </div>
        </div>

        <div class="waiting-actions">
          ${isHost ? `
            <button id="btn-start-game" class="btn btn-primary btn-large">
              🚀 게임 시작 (Start Game)
            </button>
          ` : `
            <div class="guest-status-banner">
              방장이 게임을 시작할 때까지 잠시 대기해주세요...
            </div>
          `}
        </div>
      </div>
    `;

    this.rootEl.querySelector('#btn-copy-link')?.addEventListener('click', () => {
      navigator.clipboard.writeText(shareUrl).then(() => {
        alert(`초대 링크가 복사되었습니다!\n${shareUrl}`);
      });
    });

    if (isHost) {
      this.rootEl.querySelector('#btn-start-game')?.addEventListener('click', () => {
        this.callbacks.onStartMultiplayerGame();
      });
    }
  }

  public show(): void {
    this.rootEl.style.display = 'flex';
  }

  public hide(): void {
    this.rootEl.style.display = 'none';
  }
}
