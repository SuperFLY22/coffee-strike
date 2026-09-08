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
  private currentRoomCode: string = '';
  public isHost: boolean = false;
  private nickname: string = '';

  constructor(container: HTMLElement, callbacks: LobbyCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.nickname = '요원_' + Math.floor(100 + Math.random() * 900);
    this.init();
  }

  private init(): void {
    this.rootEl = document.createElement('div');
    this.rootEl.className = 'lobby-container';
    this.container.appendChild(this.rootEl);
    this.renderMainMenu();

    // URL 쿼리 파라미터에 ?room=xxxxxx 가 있는지 확인하여 자동 참가 화면 진입
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
      this.renderJoinRoom();
      const codeInput = this.rootEl.querySelector('#join-code-input') as HTMLInputElement;
      if (codeInput) codeInput.value = roomParam.trim().toUpperCase();
    }
  }

  private showLobbyToast(msg: string): void {
    const toast = document.createElement('div');
    toast.className = 'cyber-toast';
    toast.textContent = msg;
    this.rootEl.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('out');
      setTimeout(() => toast.remove(), 400);
    }, 2000);
  }

  public renderLoading(title: string, subtitle: string = '잠시만 기다려주세요...'): void {
    this.rootEl.innerHTML = `
      <div class="lobby-card" style="text-align: center; padding: 48px 24px;">
        <div style="font-size: 42px; margin-bottom: 12px; animation: wiggle 1.2s infinite ease-in-out;">☕📡</div>
        <h3 style="font-size: 20px; font-weight: 800; color: #fff; margin-bottom: 6px;">${title}</h3>
        <p style="font-size: 13px; color: #94a3b8;">${subtitle}</p>
      </div>
    `;
  }

  public renderMainMenu(): void {
    this.rootEl.innerHTML = `
      <div class="lobby-card">
        <div class="lobby-header">
          <div class="brand-logo">☕💥</div>
          <h1 class="game-title">COFFEE STRIKE</h1>
          <p class="game-subtitle">10인 실시간 넉아웃 슈터: 오늘 커피 쏠 사람은?</p>
        </div>

        <div class="form-group">
          <label class="form-label" for="user-nick">요원 닉네임</label>
          <input type="text" id="user-nick" class="form-input" value="${this.nickname}" maxlength="10" placeholder="닉네임 입력">
        </div>

        <div class="lobby-actions">
          <button type="button" id="btn-play-single" class="btn btn-emerald">
            🤖 솔로 테스트 (봇 3기와 즉시 대전)
          </button>

          <div class="divider"><span>또는 멀티플레이어 배틀</span></div>

          <div class="multi-btn-row">
            <button type="button" id="btn-open-create" class="btn btn-primary">
              👑 방 만들기 (호스트)
            </button>
            <button type="button" id="btn-open-join" class="btn btn-secondary">
              🔗 방 참가하기
            </button>
          </div>
        </div>
      </div>
    `;

    const nickInput = this.rootEl.querySelector('#user-nick') as HTMLInputElement;
    nickInput?.addEventListener('input', () => {
      this.nickname = nickInput.value.trim();
    });

    this.rootEl.querySelector('#btn-play-single')?.addEventListener('click', () => {
      const nick = nickInput?.value.trim() || this.nickname || '요원';
      this.nickname = nick;
      this.callbacks.onStartSinglePlayer(nick);
    });

    this.rootEl.querySelector('#btn-open-create')?.addEventListener('click', () => {
      const nick = nickInput?.value.trim() || this.nickname || '방장';
      this.nickname = nick;
      this.renderCreateRoom();
    });

    this.rootEl.querySelector('#btn-open-join')?.addEventListener('click', () => {
      const nick = nickInput?.value.trim() || this.nickname || '참가자';
      this.nickname = nick;
      this.renderJoinRoom();
    });
  }

  public renderCreateRoom(): void {
    let selectedMode: GameMode = 'FFA';
    let selectedTeamCount = 2;
    let selectedDuration = 120;
    let selectedScale = 1.0;
    let selectedAmmo = 'UNLIMITED';

    this.rootEl.innerHTML = `
      <div class="lobby-card">
        <div class="lobby-header">
          <h2 class="section-title">👑 멀티플레이어 방 개설</h2>
          <p class="game-subtitle">호스트 기기에서 물리 연산 및 경기 규칙을 총괄합니다</p>
        </div>

        <div class="options-grid">
          <!-- 모드 선택 -->
          <div class="option-item">
            <label class="form-label">게임 모드</label>
            <div class="segmented-pill-group" id="grp-mode">
              <button type="button" class="pill-btn active" data-val="FFA">👤 개인전 (FFA)</button>
              <button type="button" class="pill-btn" data-val="TEAM">👥 팀전 (Team)</button>
            </div>
          </div>

          <!-- 팀 수 (팀전 선택 시 노출) -->
          <div class="option-item" id="opt-team-count-box" style="display: none;">
            <label class="form-label">팀 편성 수</label>
            <div class="segmented-pill-group" id="grp-teams">
              <button type="button" class="pill-btn active" data-val="2">2개 팀</button>
              <button type="button" class="pill-btn" data-val="3">3개 팀</button>
              <button type="button" class="pill-btn" data-val="4">4개 팀</button>
            </div>
          </div>

          <!-- 경기 시간 -->
          <div class="option-item">
            <label class="form-label">경기 시간 (초)</label>
            <div class="segmented-pill-group" id="grp-duration">
              <button type="button" class="pill-btn" data-val="60">60초</button>
              <button type="button" class="pill-btn active" data-val="120">120초 (정식)</button>
              <button type="button" class="pill-btn" data-val="180">180초</button>
            </div>
          </div>

          <!-- 게임 배속 -->
          <div class="option-item">
            <label class="form-label">게임 배속</label>
            <div class="segmented-pill-group" id="grp-scale">
              <button type="button" class="pill-btn active" data-val="1.0">1.0x 표준</button>
              <button type="button" class="pill-btn" data-val="1.5">1.5x 스피디</button>
              <button type="button" class="pill-btn" data-val="2.0">2.0x 난타</button>
            </div>
          </div>

          <!-- 탄약 모드 -->
          <div class="option-item">
            <label class="form-label">탄약 규칙</label>
            <div class="segmented-pill-group" id="grp-ammo">
              <button type="button" class="pill-btn active" data-val="UNLIMITED">♾️ 무제한 난사</button>
              <button type="button" class="pill-btn" data-val="LIMITED">⏱️ 1.2s 재장전</button>
            </div>
          </div>
        </div>

        <div class="btn-group-row">
          <button type="button" id="btn-back-menu" class="btn btn-secondary">뒤로</button>
          <button type="button" id="btn-confirm-create" class="btn btn-primary">방 개설 및 대기실 입장</button>
        </div>
      </div>
    `;

    // 세그먼트 버튼 헬퍼
    const bindPillGroup = (groupId: string, onSelect: (val: string) => void) => {
      const grp = this.rootEl.querySelector(groupId);
      if (!grp) return;
      grp.querySelectorAll('.pill-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          grp.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const val = btn.getAttribute('data-val') || '';
          onSelect(val);
        });
      });
    };

    const teamCountBox = this.rootEl.querySelector('#opt-team-count-box') as HTMLElement;

    bindPillGroup('#grp-mode', (val) => {
      selectedMode = val as GameMode;
      teamCountBox.style.display = selectedMode === 'TEAM' ? 'block' : 'none';
    });

    bindPillGroup('#grp-teams', (val) => {
      selectedTeamCount = parseInt(val, 10);
    });

    bindPillGroup('#grp-duration', (val) => {
      selectedDuration = parseInt(val, 10);
    });

    bindPillGroup('#grp-scale', (val) => {
      selectedScale = parseFloat(val);
    });

    bindPillGroup('#grp-ammo', (val) => {
      selectedAmmo = val;
    });

    this.rootEl.querySelector('#btn-back-menu')?.addEventListener('click', () => {
      this.renderMainMenu();
    });

    this.rootEl.querySelector('#btn-confirm-create')?.addEventListener('click', () => {
      const options: RoomOptions = {
        maxPlayers: 10,
        gameMode: selectedMode,
        teamCount: selectedTeamCount,
        duration: selectedDuration,
        timeScale: selectedScale,
        ammoMode: selectedAmmo as any
      };
      this.callbacks.onCreateRoom(this.nickname || '방장', options);
    });
  }

  public renderJoinRoom(): void {
    const nick = this.nickname || '참가자';
    let selectedTeam: Team = 'NONE';

    this.rootEl.innerHTML = `
      <div class="lobby-card">
        <div class="lobby-header">
          <h2 class="section-title">🔗 룸 참가하기</h2>
          <p class="game-subtitle">호스트의 6자리 룸 코드를 입력하거나 초대 링크로 입장하세요</p>
        </div>

        <div class="form-group">
          <label class="form-label" for="join-code-input">룸 코드 (ROOM CODE)</label>
          <input type="text" id="join-code-input" class="form-input code-input" placeholder="예: AB12CD" maxlength="8">
        </div>

        <div class="form-group" id="team-select-group">
          <label class="form-label">팀 지정 (팀전일 경우)</label>
          <div class="segmented-pill-group" id="grp-join-team">
            <button type="button" class="pill-btn active" data-val="NONE">자동 배정</button>
            <button type="button" class="pill-btn" data-val="RED">🔴 레드</button>
            <button type="button" class="pill-btn" data-val="BLUE">🔵 블루</button>
            <button type="button" class="pill-btn" data-val="GREEN">🟢 그린</button>
          </div>
        </div>

        <div class="btn-group-row">
          <button id="btn-back-menu" class="btn btn-secondary">뒤로</button>
          <button id="btn-confirm-join" class="btn btn-primary">입장하기</button>
        </div>
      </div>
    `;

    const grp = this.rootEl.querySelector('#grp-join-team');
    grp?.querySelectorAll('.pill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        grp.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedTeam = (btn.getAttribute('data-val') || 'NONE') as Team;
      });
    });

    const codeInput = this.rootEl.querySelector('#join-code-input') as HTMLInputElement;
    const confirmBtn = this.rootEl.querySelector('#btn-confirm-join') as HTMLButtonElement;

    codeInput?.addEventListener('input', () => {
      const pos = codeInput.selectionStart;
      codeInput.value = codeInput.value.toUpperCase().replace(/\s+/g, '');
      if (pos !== null) {
        codeInput.setSelectionRange(pos, pos);
      }
    });

    const submitJoin = () => {
      const code = (codeInput?.value || '').trim().toUpperCase();
      if (!code) {
        this.showLobbyToast('룸 코드를 입력해주세요.');
        return;
      }
      this.callbacks.onJoinRoom(nick, code, selectedTeam);
    };

    codeInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitJoin();
    });

    this.rootEl.querySelector('#btn-back-menu')?.addEventListener('click', () => {
      this.renderMainMenu();
    });

    confirmBtn?.addEventListener('click', submitJoin);
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
              <div class="room-share-actions">
                <button id="btn-share-link" class="btn btn-sm btn-primary">🔗 공유하기</button>
                <button id="btn-copy-code" class="btn btn-sm btn-ghost">📋 복사</button>
              </div>
            </div>
          </div>
          <div class="room-spec-tags">
            <span class="spec-tag">${options.gameMode === 'FFA' ? '개인전' : `팀전 (${options.teamCount}팀)`}</span>
            <span class="spec-tag">${options.duration}초</span>
            <span class="spec-tag">${options.timeScale}x 배속</span>
            <span class="spec-tag">${options.ammoMode === 'UNLIMITED' ? '무제한 탄약' : '1.2s 재장전'}</span>
          </div>
        </div>

        <div class="player-list-section">
          <div class="list-header">
            <span>참가 대기 요원 명단</span>
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
              🚀 작전 개시 (Start Battle)
            </button>
          ` : `
            <div class="guest-status-banner">
              방장이 작전을 개시할 때까지 잠시 대기해주세요...
            </div>
          `}
        </div>
      </div>
    `;

    // 1. Web Share API or Clipboard Copy
    const shareBtn = this.rootEl.querySelector('#btn-share-link');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => {
        if (navigator.share) {
          navigator.share({
            title: 'Coffee Strike 초대',
            text: `[커피 스트라이크] 오늘 커피 쏠 사람을 정하자! 룸 코드: ${roomCode}`,
            url: shareUrl
          }).catch(() => {});
        } else {
          navigator.clipboard.writeText(shareUrl).then(() => {
            this.showLobbyToast('📋 초대 링크가 복사되었습니다!');
          });
        }
      });
    }

    const copyCodeBtn = this.rootEl.querySelector('#btn-copy-code');
    if (copyCodeBtn) {
      copyCodeBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(roomCode).then(() => {
          this.showLobbyToast(`코드 [${roomCode}] 복사 완료!`);
        });
      });
    }

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
