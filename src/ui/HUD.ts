import { GameResult, WEAPON_CONFIGS } from '../engine/Types';
import { sound } from '../engine/Audio';
import { HUDState } from './HUDState';

export class HUD {
  private container: HTMLElement;
  private topBarEl!: HTMLElement;
  private timerEl!: HTMLElement;
  private aliveEl!: HTMLElement;
  private weaponBadgeEl!: HTMLElement;
  private ammoBarEl!: HTMLElement;
  private timeScaleBadgeEl!: HTMLElement;
  private suddenDeathBannerEl!: HTMLElement;
  private killfeedContainerEl!: HTMLElement;
  private buffsContainerEl!: HTMLElement;

  private exitModalEl!: HTMLElement;
  private gameOverModalEl!: HTMLElement;
  private countdownOverlayEl!: HTMLElement;
  private toastNotificationEl!: HTMLElement;

  public onReplayClick?: () => void;
  public onExitLobbyClick?: () => void;

  constructor(container: HTMLElement) {
    this.container = container;
    this.initElements();
  }

  private initElements(): void {
    // 1. Top Bar HUD (좌: 시스템 조작, 중: 경기 타이머 & 배속, 우: 생존 인원)
    this.topBarEl = document.createElement('div');
    this.topBarEl.className = 'hud-top-bar';
    this.topBarEl.innerHTML = `
      <div class="hud-top-actions">
        <button id="btn-sound-toggle" class="btn-top-sys" title="사운드 온/오프">🔊</button>
        <button id="btn-top-exit" class="btn-top-sys exit" title="작전 포기 / 로비 나가기">🚪</button>
      </div>

      <div class="hud-center-box">
        <div class="hud-item hud-timer-box">
          <span class="hud-label">남은 시간</span>
          <span class="hud-val timer-val" id="hud-timer">02:00</span>
        </div>
        <div class="hud-badges-row">
          <div class="hud-badge scale-badge" id="hud-scale">1.0x 배속</div>
          <div class="hud-badge sudden-death-tag" id="hud-sd-tag" style="display:none;">⚡ 서든데스</div>
        </div>
      </div>

      <div class="hud-item hud-alive-box">
        <span class="hud-label">생존 요원</span>
        <span class="hud-val alive-val" id="hud-alive">4 / 4</span>
      </div>
    `;
    this.container.appendChild(this.topBarEl);

    // 2. Killfeed Toast Container (상단 중앙 알림)
    this.killfeedContainerEl = document.createElement('div');
    this.killfeedContainerEl.className = 'killfeed-container';
    this.container.appendChild(this.killfeedContainerEl);

    // 3. Countdown Overlay (3, 2, 1, GO!)
    this.countdownOverlayEl = document.createElement('div');
    this.countdownOverlayEl.className = 'countdown-overlay';
    this.countdownOverlayEl.style.display = 'none';
    this.countdownOverlayEl.innerHTML = `
      <div class="countdown-number" id="hud-countdown-num">3</div>
    `;
    this.container.appendChild(this.countdownOverlayEl);

    // 4. Bottom HUD (오른손 엄지 조작 방해 없도록 우측 상단/중하단에 안전 배치)
    const bottomBar = document.createElement('div');
    bottomBar.className = 'hud-bottom-bar';
    bottomBar.innerHTML = `
      <div class="hud-buffs-container" id="hud-buffs-container"></div>

      <div class="hud-status-cards">
        <div class="hud-hp-card">
          <div class="hp-info">
            <span class="hp-label">🛡️ 체력</span>
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

    // 5. Sudden Death Banner
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

    // 6. Custom Non-blocking Exit Modal
    this.exitModalEl = document.createElement('div');
    this.exitModalEl.className = 'hud-modal-overlay';
    this.exitModalEl.id = 'exit-confirm-modal';
    this.exitModalEl.style.display = 'none';
    this.exitModalEl.innerHTML = `
      <div class="cyber-confirm-card">
        <div class="confirm-icon">⚠️</div>
        <h3 class="confirm-title">작전 중단 (퇴장)</h3>
        <p class="confirm-desc">현재 전투를 포기하고 메인 로비로 복귀하시겠습니까?<br><span class="danger-sub">진행 중인 매치에서 자동 패배 처리됩니다.</span></p>
        <div class="confirm-btn-row">
          <button id="btn-cancel-exit" class="btn btn-secondary btn-sm">계속 전투</button>
          <button id="btn-confirm-exit" class="btn btn-danger btn-sm">전장 이탈</button>
        </div>
      </div>
    `;
    this.container.appendChild(this.exitModalEl);

    // 7. Toast Notification Pill
    this.toastNotificationEl = document.createElement('div');
    this.toastNotificationEl.className = 'cyber-toast';
    this.toastNotificationEl.style.display = 'none';
    this.container.appendChild(this.toastNotificationEl);

    // 8. Game Over Result Modal (Cyber Coffee Receipt)
    this.gameOverModalEl = document.createElement('div');
    this.gameOverModalEl.className = 'hud-modal-overlay';
    this.gameOverModalEl.style.display = 'none';
    this.container.appendChild(this.gameOverModalEl);

    // DOM 캐싱
    this.timerEl = this.topBarEl.querySelector('#hud-timer') as HTMLElement;
    this.aliveEl = this.topBarEl.querySelector('#hud-alive') as HTMLElement;
    this.timeScaleBadgeEl = this.topBarEl.querySelector('#hud-scale') as HTMLElement;
    this.weaponBadgeEl = bottomBar.querySelector('#hud-weapon-name') as HTMLElement;
    this.ammoBarEl = bottomBar.querySelector('#hud-ammo-fill') as HTMLElement;
    this.buffsContainerEl = bottomBar.querySelector('#hud-buffs-container') as HTMLElement;

    // 시스템 버튼 이벤트 바인딩
    const topExitBtn = this.topBarEl.querySelector('#btn-top-exit') as HTMLButtonElement;
    if (topExitBtn) {
      topExitBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showExitConfirmModal();
      });
    }

    const cancelExitBtn = this.exitModalEl.querySelector('#btn-cancel-exit') as HTMLButtonElement;
    if (cancelExitBtn) {
      cancelExitBtn.addEventListener('click', () => {
        this.hideExitConfirmModal();
      });
    }

    const confirmExitBtn = this.exitModalEl.querySelector('#btn-confirm-exit') as HTMLButtonElement;
    if (confirmExitBtn) {
      confirmExitBtn.addEventListener('click', () => {
        this.hideExitConfirmModal();
        if (this.onExitLobbyClick) {
          this.onExitLobbyClick();
        }
      });
    }

    const soundBtn = this.topBarEl.querySelector('#btn-sound-toggle') as HTMLButtonElement;
    if (soundBtn) {
      soundBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sound.enabled = !sound.enabled;
        soundBtn.textContent = sound.enabled ? '🔊' : '🔇';
      });
    }
  }

  public showExitConfirmModal(): void {
    this.exitModalEl.style.display = 'flex';
  }

  public hideExitConfirmModal(): void {
    this.exitModalEl.style.display = 'none';
  }

  public showToast(msg: string): void {
    this.toastNotificationEl.textContent = msg;
    this.toastNotificationEl.style.display = 'block';
    this.toastNotificationEl.classList.remove('fade-out');
    clearTimeout((this.toastNotificationEl as any)._timeout);
    (this.toastNotificationEl as any)._timeout = setTimeout(() => {
      this.toastNotificationEl.style.display = 'none';
    }, 2200);
  }

  private lastKillfeedTimes = new Map<string, number>();

  /**
   * 전장 링아웃 / 탈락 킬피드 토스트 출력 (중복 방지 및 최대 표시 개수 제한)
   */
  public showKillfeed(nickname: string, isFirst: boolean): void {
    const now = performance.now();
    const lastTime = this.lastKillfeedTimes.get(nickname) || 0;
    if (now - lastTime < 3000) {
      return; // 3초 이내 동일 플레이어 탈락 알림 중복 무시
    }
    this.lastKillfeedTimes.set(nickname, now);

    // 킬피드가 너무 많이 쌓이지 않도록 최대 4개로 제한
    while (this.killfeedContainerEl.children.length >= 4) {
      this.killfeedContainerEl.firstElementChild?.remove();
    }

    const item = document.createElement('div');
    item.className = `killfeed-item ${isFirst ? 'first-blood' : ''}`;
    item.innerHTML = isFirst
      ? `☕ <strong>${nickname}</strong> 첫 탈락! (커피 당첨 유력!)`
      : `💥 <strong>${nickname}</strong> 링아웃 장외 낙사!`;

    this.killfeedContainerEl.appendChild(item);
    setTimeout(() => {
      item.classList.add('out');
      setTimeout(() => item.remove(), 400);
    }, 2400);
  }

  public showCountdown(val: number | string): void {
    this.countdownOverlayEl.style.display = 'flex';
    const numEl = this.countdownOverlayEl.querySelector('#hud-countdown-num') as HTMLElement;
    if (numEl) {
      numEl.textContent = String(val);
      numEl.className = `countdown-number ${val === 'GO!' ? 'go' : ''}`;
      numEl.style.animation = 'none';
      void numEl.offsetHeight; // reflow
      numEl.style.animation = '';
    }
  }

  public hideCountdown(): void {
    this.countdownOverlayEl.style.display = 'none';
  }

  public update(state: HUDState): void {
    // 1. 타이머
    const totalSec = Math.max(0, Math.ceil(state.timeRemaining));
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    this.timerEl.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    if (totalSec <= 10) {
      this.timerEl.classList.add('urgent');
    } else {
      this.timerEl.classList.remove('urgent');
    }

    // 2. 생존 인원
    this.aliveEl.textContent = `${state.aliveCount} / ${state.totalCount}`;

    // 3. 배속 뱃지
    this.timeScaleBadgeEl.textContent = `${state.timeScale}x 배속`;

    // 4. 서든데스 태그
    const sdTag = this.topBarEl.querySelector('#hud-sd-tag') as HTMLElement;
    if (state.isSuddenDeath) {
      sdTag.style.display = 'inline-flex';
    } else {
      sdTag.style.display = 'none';
    }

    // 5. 내 상태 & 버프 인디케이터
    const myPlayer = state.myPlayer;
    if (myPlayer) {
      const hpValEl = this.container.querySelector('#hud-hp-val') as HTMLElement;
      const hpFillEl = this.container.querySelector('#hud-hp-fill') as HTMLElement;
      const heatValEl = this.container.querySelector('#hud-heat-val') as HTMLElement;

      if (hpValEl && hpFillEl) {
        if (myPlayer.invincibleRemaining > 0) {
          hpValEl.textContent = `무적 (${myPlayer.invincibleRemaining.toFixed(1)}s)`;
          hpFillEl.style.width = '100%';
          hpFillEl.style.backgroundColor = '#f59e0b';
        } else {
          hpValEl.textContent = `${Math.round(myPlayer.hp)} HP`;
          const hpPct = Math.max(0, Math.min(100, (myPlayer.hp / myPlayer.maxHp) * 100));
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

      if (state.isSuddenDeath || state.ammoMode === 'UNLIMITED') {
        ammoCountEl.textContent = '무제한 ∞';
        this.ammoBarEl.style.width = '100%';
        this.ammoBarEl.style.backgroundColor = '#00f0ff';
      } else {
        if (myPlayer.isReloading) {
          ammoCountEl.textContent = '재장전...';
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

      // 버프 인디케이터 렌더링
      let buffsHtml = '';
      if (myPlayer.powerRemaining > 0) {
        buffsHtml += `<div class="buff-chip buff-power">⚡ 파워 2x (${myPlayer.powerRemaining.toFixed(1)}s)</div>`;
      }
      if (myPlayer.invincibleRemaining > 0) {
        buffsHtml += `<div class="buff-chip buff-shield">🛡️ 무적 쉴드 (${myPlayer.invincibleRemaining.toFixed(1)}s)</div>`;
      }
      this.buffsContainerEl.innerHTML = buffsHtml;
    }
  }

  public showSuddenDeathAlert(): void {
    this.suddenDeathBannerEl.style.display = 'flex';
    setTimeout(() => {
      this.suddenDeathBannerEl.style.display = 'none';
    }, 3000);
  }

  /**
   * 사이버 커피 영수증 (Cyber Coffee Receipt) 모달 렌더링
   */
  public showGameOver(result: GameResult, isHost: boolean): void {
    const playerCount = result.rankings.length;
    const coffeeCost = playerCount * 3000;
    const orderNo = 'CS-' + Math.floor(1000 + Math.random() * 9000);
    const nowStr = new Date().toLocaleString('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });

    this.gameOverModalEl.innerHTML = `
      <div class="cyber-receipt-card">
        <div class="receipt-header">
          <div class="receipt-brand">☕ COFFEE STRIKE 💥</div>
          <div class="receipt-sub">TACTICAL PENALTY RECEIPT</div>
          <div class="receipt-meta">
            <span>주문번호: #${orderNo}</span>
            <span>${nowStr}</span>
          </div>
        </div>

        <div class="receipt-divider">--------------------------------</div>

        <div class="receipt-buyer-section">
          <div class="receipt-stamp-badge">
            <span class="stamp-text">결제 당첨</span>
          </div>
          <div class="buyer-label">오늘의 커피 결제자</div>
          <div class="buyer-name">${result.coffeeBuyer.nickname}</div>
          <div class="buyer-reason">${result.coffeeBuyer.reason}</div>
        </div>

        <div class="receipt-divider">--------------------------------</div>

        <div class="receipt-order-list">
          <div class="order-item-row">
            <span>아메리카노 (ICED) x ${playerCount}</span>
            <span>₩${coffeeCost.toLocaleString()}</span>
          </div>
          <div class="order-item-row sub">
            <span>생존 요원 보상 쿠폰</span>
            <span>-₩0</span>
          </div>
          <div class="receipt-divider-thin"></div>
          <div class="order-total-row">
            <span>총 청구 금액</span>
            <span class="total-price">₩${coffeeCost.toLocaleString()}</span>
          </div>
        </div>

        <div class="winner-honor-box">
          🏆 최후의 생존 우승: <strong>${result.winnerNickname || '없음'}</strong>
        </div>

        <div class="rankings-table-container">
          <table class="rankings-table">
            <thead>
              <tr>
                <th>순위</th>
                <th>요원명</th>
                <th>생존</th>
                <th>판정</th>
              </tr>
            </thead>
            <tbody>
              ${result.rankings.map(r => `
                <tr class="${r.isCoffeeBuyer ? 'row-coffee-buyer' : (r.rank === 1 ? 'row-winner' : '')}">
                  <td><span class="rank-num">${r.rank}위</span></td>
                  <td class="player-nick">${r.nickname}</td>
                  <td>${r.surviveTime}s</td>
                  <td>${r.isCoffeeBuyer ? '💸 결제' : (r.rank === 1 ? '👑 1위' : '생존')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="modal-actions">
          <button id="btn-copy-receipt" class="btn btn-emerald btn-sm">
            📋 영수증 텍스트 복사 (슬랙/카톡)
          </button>
          ${isHost ? '<button id="btn-replay" class="btn btn-primary">🔄 다시 한 판 하기</button>' : '<div class="guest-waiting-txt">방장의 재시작을 대기하는 중...</div>'}
          <button id="btn-exit-lobby" class="btn btn-secondary">🚪 메인 로비로 나가기</button>
        </div>
      </div>
    `;

    this.gameOverModalEl.style.display = 'flex';

    // 텍스트 클립보드 복사
    const copyBtn = this.gameOverModalEl.querySelector('#btn-copy-receipt');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const shareText = `☕ [커피 스트라이크] 오늘의 결제 당첨자!\n━━━━━━━━━━━━━━━━━━━━\n💸 결제 당첨: ${result.coffeeBuyer.nickname} (${result.coffeeBuyer.reason})\n👑 생존 1위: ${result.winnerNickname || '없음'}\n☕ 결제 금액: 아메리카노 ${playerCount}잔 (₩${coffeeCost.toLocaleString()})\n━━━━━━━━━━━━━━━━━━━━\n다음 판 설욕전 하러 가기: ${window.location.href}`;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(shareText).then(() => {
            this.showToast('📋 영수증이 클립보드에 복사되었습니다!');
          }).catch(() => {
            this.showToast('복사 실패 (권한 필요)');
          });
        }
      });
    }

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
    this.hideGameOver();
    this.hideExitConfirmModal();
    this.topBarEl.style.display = 'flex';
    const b = this.container.querySelector('.hud-bottom-bar') as HTMLElement;
    if (b) b.style.display = 'flex';
  }

  public hide(): void {
    this.topBarEl.style.display = 'none';
    const b = this.container.querySelector('.hud-bottom-bar') as HTMLElement;
    if (b) b.style.display = 'none';
    this.hideGameOver();
    this.hideExitConfirmModal();
    this.hideCountdown();
  }
}
