import { GameResult, WEAPON_CONFIGS, WeaponType } from '../engine/Types';
import { Game } from '../engine/Game';
import { sound } from '../engine/Audio';

export class HUD {
  private container: HTMLElement;
  private topBarEl!: HTMLElement;
  private timerEl!: HTMLElement;
  private aliveEl!: HTMLElement;
  private weaponBadgeEl!: HTMLElement;
  private ammoBarEl!: HTMLElement;
  private timeScaleBadgeEl!: HTMLElement;
  private suddenDeathBannerEl!: HTMLElement;

  private gameOverModalEl!: HTMLElement;

  public onReplayClick?: () => void;
  public onExitLobbyClick?: () => void;

  constructor(container: HTMLElement) {
    this.container = container;
    this.initElements();
  }

  private initElements(): void {
    // Top Bar HUD
    this.topBarEl = document.createElement('div');
    this.topBarEl.className = 'hud-top-bar';
    this.topBarEl.innerHTML = `
      <div class="hud-left-actions">
        <button id="btn-hud-exit" class="btn-hud-exit" title="게임 종료 및 로비로 나가기">🚪 나가기</button>
      </div>
      <div class="hud-item hud-timer-box">
        <span class="hud-label">남은 시간</span>
        <span class="hud-val timer-val" id="hud-timer">02:00</span>
      </div>
      <div class="hud-center-box">
        <div class="hud-badge scale-badge" id="hud-scale">1.0x 배속</div>
        <div class="hud-badge sudden-death-tag" id="hud-sd-tag" style="display:none;">⚡ 서든데스</div>
      </div>
      <div class="hud-right-box">
        <div class="hud-item hud-alive-box">
          <span class="hud-label">생존 인원</span>
          <span class="hud-val alive-val" id="hud-alive">4 / 4</span>
        </div>
        <button id="btn-sound-toggle" class="btn-sound" title="사운드 온/오프">🔊</button>
      </div>
    `;
    this.container.appendChild(this.topBarEl);

    // Bottom Weapon & HP Bar
    const bottomBar = document.createElement('div');
    bottomBar.className = 'hud-bottom-bar';
    bottomBar.innerHTML = `
      <div class="hud-status-cards">
        <div class="hud-hp-card">
          <div class="hp-info">
            <span class="hp-label">❤️ 체력</span>
            <span class="hp-count" id="hud-hp-val">100 HP</span>
            <span class="heat-count" id="hud-heat-val">💥 0%</span>
          </div>
          <div class="hp-track">
            <div class="hp-fill" id="hud-hp-fill" style="width: 100%;"></div>
          </div>
        </div>

        <div class="hud-weapon-card" id="hud-weapon-card">
          <div class="weapon-info">
            <span class="weapon-name" id="hud-weapon-name">밸런스 피스톨</span>
            <span class="ammo-count" id="hud-ammo-count">∞</span>
          </div>
          <div class="ammo-track">
            <div class="ammo-fill" id="hud-ammo-fill" style="width: 100%;"></div>
          </div>
        </div>
      </div>
    `;
    this.container.appendChild(bottomBar);

    // Sudden Death Banner
    this.suddenDeathBannerEl = document.createElement('div');
    this.suddenDeathBannerEl.className = 'hud-sd-banner';
    this.suddenDeathBannerEl.innerHTML = `
      <div class="sd-content">
        <h2>⚠️ SUDDEN DEATH ⚠️</h2>
        <p>엄폐물 전면 소멸! 탄약 무제한 난타전!</p>
      </div>
    `;
    this.suddenDeathBannerEl.style.display = 'none';
    this.container.appendChild(this.suddenDeathBannerEl);

    // Game Over Result Modal
    this.gameOverModalEl = document.createElement('div');
    this.gameOverModalEl.className = 'hud-modal-overlay';
    this.gameOverModalEl.style.display = 'none';
    this.container.appendChild(this.gameOverModalEl);

    // 캐싱
    this.timerEl = this.topBarEl.querySelector('#hud-timer') as HTMLElement;
    this.aliveEl = this.topBarEl.querySelector('#hud-alive') as HTMLElement;
    this.timeScaleBadgeEl = this.topBarEl.querySelector('#hud-scale') as HTMLElement;
    this.weaponBadgeEl = bottomBar.querySelector('#hud-weapon-name') as HTMLElement;
    this.ammoBarEl = bottomBar.querySelector('#hud-ammo-fill') as HTMLElement;

    // 나가기 버튼 바인딩
    const exitBtn = this.topBarEl.querySelector('#btn-hud-exit') as HTMLButtonElement;
    if (exitBtn) {
      exitBtn.style.pointerEvents = 'auto';
      exitBtn.addEventListener('click', () => {
        if (confirm('정말로 게임을 종료하고 로비로 나가시겠습니까?')) {
          if (this.onExitLobbyClick) {
            this.onExitLobbyClick();
          }
        }
      });
    }

    const soundBtn = this.topBarEl.querySelector('#btn-sound-toggle') as HTMLButtonElement;
    if (soundBtn) {
      soundBtn.style.pointerEvents = 'auto';
      soundBtn.addEventListener('click', () => {
        sound.enabled = !sound.enabled;
        soundBtn.textContent = sound.enabled ? '🔊' : '🔇';
      });
    }
  }

  public update(game: Game): void {
    // 1. 타이머
    const totalSec = Math.max(0, Math.ceil(game.timeRemaining));
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    this.timerEl.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    if (totalSec <= 10) {
      this.timerEl.classList.add('urgent');
    } else {
      this.timerEl.classList.remove('urgent');
    }

    // 2. 생존 인원
    const allPlayers = Array.from(game.players.values());
    const aliveCount = allPlayers.filter(p => !p.isDead).length;
    this.aliveEl.textContent = `${aliveCount} / ${allPlayers.length}`;

    // 3. 배속 뱃지
    this.timeScaleBadgeEl.textContent = `${game.timeScale}x 배속`;

    // 4. 서든데스 태그
    const sdTag = this.topBarEl.querySelector('#hud-sd-tag') as HTMLElement;
    if (game.isSuddenDeath) {
      sdTag.style.display = 'inline-flex';
    } else {
      sdTag.style.display = 'none';
    }

    // 5. 내 HP 및 무기 & 잔탄 표시
    const myPlayer = game.players.get(game.myPlayerId);
    if (myPlayer) {
      const hpValEl = this.container.querySelector('#hud-hp-val') as HTMLElement;
      const hpFillEl = this.container.querySelector('#hud-hp-fill') as HTMLElement;
      const heatValEl = this.container.querySelector('#hud-heat-val') as HTMLElement;

      if (hpValEl && hpFillEl) {
        if (myPlayer.buffs.invincible > 0) {
          hpValEl.textContent = `무적 (${myPlayer.buffs.invincible.toFixed(1)}s)`;
          hpFillEl.style.width = '100%';
          hpFillEl.style.backgroundColor = '#f59e0b';
        } else {
          hpValEl.textContent = `${Math.round(myPlayer.hp)} HP`;
          const hpPct = Math.max(0, Math.min(100, (myPlayer.hp / 100) * 100));
          hpFillEl.style.width = `${hpPct}%`;
          hpFillEl.style.backgroundColor = hpPct > 50 ? '#10b981' : (hpPct > 25 ? '#f59e0b' : '#ef4444');
        }
      }

      if (heatValEl) {
        heatValEl.textContent = `💥 ${Math.round(myPlayer.heatPercent)}%`;
        heatValEl.style.color = myPlayer.heatPercent >= 100 ? '#ef4444' : '#f59e0b';
      }

      const stats = WEAPON_CONFIGS[myPlayer.weapon];
      this.weaponBadgeEl.textContent = stats.nameKo;
      const ammoCountEl = this.container.querySelector('#hud-ammo-count') as HTMLElement;

      if (game.isSuddenDeath || game.options.ammoMode === 'UNLIMITED') {
        ammoCountEl.textContent = '무제한 ∞';
        this.ammoBarEl.style.width = '100%';
        this.ammoBarEl.style.backgroundColor = '#38bdf8';
      } else {
        if (myPlayer.isReloading) {
          ammoCountEl.textContent = '재장전 중...';
          const pct = Math.max(0, 100 - (myPlayer.reloadTimer / 1.2) * 100);
          this.ammoBarEl.style.width = `${pct}%`;
          this.ammoBarEl.style.backgroundColor = '#f59e0b';
        } else {
          ammoCountEl.textContent = `${myPlayer.ammo} / ${stats.maxAmmo}`;
          const pct = (myPlayer.ammo / stats.maxAmmo) * 100;
          this.ammoBarEl.style.width = `${pct}%`;
          this.ammoBarEl.style.backgroundColor = pct < 25 ? '#ef4444' : '#10b981';
        }
      }
    }
  }

  public showSuddenDeathAlert(): void {
    this.suddenDeathBannerEl.style.display = 'flex';
    setTimeout(() => {
      this.suddenDeathBannerEl.style.display = 'none';
    }, 3000);
  }

  public showGameOver(result: GameResult, isHost: boolean): void {
    this.gameOverModalEl.innerHTML = `
      <div class="result-modal-card">
        <div class="coffee-highlight-badge">
          <div class="coffee-cup-icon">☕</div>
          <div class="coffee-title">오늘의 커피 쏠 사람!</div>
          <div class="coffee-buyer-name">${result.coffeeBuyer.nickname}</div>
          <div class="coffee-reason">${result.coffeeBuyer.reason}</div>
        </div>

        <div class="winner-badge">
          🏆 최후의 우승: <strong>${result.winnerNickname || '없음'}</strong>
        </div>

        <div class="rankings-table-container">
          <table class="rankings-table">
            <thead>
              <tr>
                <th>순위</th>
                <th>닉네임</th>
                <th>생존 시간</th>
                <th>결과</th>
              </tr>
            </thead>
            <tbody>
              ${result.rankings.map(r => `
                <tr class="${r.isCoffeeBuyer ? 'row-coffee-buyer' : (r.rank === 1 ? 'row-winner' : '')}">
                  <td><span class="rank-num">${r.rank}위</span></td>
                  <td class="player-nick">${r.nickname}</td>
                  <td>${r.surviveTime}초</td>
                  <td>${r.isCoffeeBuyer ? '☕ 당첨!' : (r.rank === 1 ? '👑 1위' : '생존')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="modal-actions">
          ${isHost ? '<button id="btn-replay" class="btn btn-primary">🔄 다시 한 판 하기</button>' : '<div class="guest-waiting-txt">방장의 재시작 대기 중...</div>'}
          <button id="btn-exit-lobby" class="btn btn-secondary">🚪 대기실 나가기</button>
        </div>
      </div>
    `;

    this.gameOverModalEl.style.display = 'flex';

    const replayBtn = this.gameOverModalEl.querySelector('#btn-replay');
    if (replayBtn) {
      replayBtn.addEventListener('click', () => {
        this.hideGameOver();
        if (this.onReplayClick) this.onReplayClick();
      });
    }

    const exitBtn = this.gameOverModalEl.querySelector('#btn-exit-lobby');
    if (exitBtn) {
      exitBtn.addEventListener('click', () => {
        this.hideGameOver();
        if (this.onExitLobbyClick) this.onExitLobbyClick();
      });
    }
  }

  public hideGameOver(): void {
    this.gameOverModalEl.style.display = 'none';
  }

  public show(): void {
    this.topBarEl.style.display = 'flex';
    const b = this.container.querySelector('.hud-bottom-bar') as HTMLElement;
    if (b) b.style.display = 'flex';
  }

  public hide(): void {
    this.topBarEl.style.display = 'none';
    const b = this.container.querySelector('.hud-bottom-bar') as HTMLElement;
    if (b) b.style.display = 'none';
    this.hideGameOver();
  }
}
