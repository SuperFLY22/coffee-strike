import { JoystickInput } from './Types';

export class Joystick {
  public enabled: boolean = false; // 게임 실행 중에만 활성화
  private active: boolean = false;
  private touchId: number | null = null;
  private originX: number = 0;
  private originY: number = 0;
  private currentX: number = 0;
  private currentY: number = 0;
  private maxRadius: number = 60; // 조이스틱 최대 이동 반경 (px)
  
  // 키보드 폴백 (WASD / 방향키)
  private keys = {
    up: false,
    down: false,
    left: false,
    right: false
  };

  private boundTouchStart: (e: TouchEvent) => void;
  private boundTouchMove: (e: TouchEvent) => void;
  private boundTouchEnd: (e: TouchEvent) => void;
  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;
  private boundMouseDown: (e: MouseEvent) => void;
  private boundMouseMove: (e: MouseEvent) => void;
  private boundMouseUp: (e: MouseEvent) => void;
  private boundBlur: () => void;
  private boundVisibilityChange: () => void;
  private boundContextMenu: (e: MouseEvent) => void;
  private boundMouseLeave: () => void;
  private isMouseDown: boolean = false;

  constructor(private container: HTMLElement) {
    this.boundTouchStart = this.onTouchStart.bind(this);
    this.boundTouchMove = this.onTouchMove.bind(this);
    this.boundTouchEnd = this.onTouchEnd.bind(this);
    this.boundKeyDown = this.onKeyDown.bind(this);
    this.boundKeyUp = this.onKeyUp.bind(this);
    this.boundMouseDown = this.onMouseDown.bind(this);
    this.boundMouseMove = this.onMouseMove.bind(this);
    this.boundMouseUp = this.onMouseUp.bind(this);
    this.boundBlur = this.reset.bind(this);
    this.boundVisibilityChange = () => {
      if (document.hidden) this.reset();
    };
    this.boundContextMenu = () => this.reset();
    this.boundMouseLeave = () => {
      if (this.isMouseDown) {
        this.reset();
      }
    };

    this.attach();
  }

  public setEnabled(val: boolean): void {
    this.enabled = val;
    if (!val) {
      this.reset();
    }
  }

  /**
   * 모든 키보드/마우스/터치 입력 상태를 0으로 강제 초기화 (방향 고착 버그 완벽 방지)
   */
  public reset(): void {
    this.active = false;
    this.isMouseDown = false;
    this.touchId = null;
    this.originX = 0;
    this.originY = 0;
    this.currentX = 0;
    this.currentY = 0;
    this.keys = {
      up: false,
      down: false,
      left: false,
      right: false
    };
  }

  private attach(): void {
    // Touch events on the container
    this.container.addEventListener('touchstart', this.boundTouchStart, { passive: false });
    window.addEventListener('touchmove', this.boundTouchMove, { passive: false });
    window.addEventListener('touchend', this.boundTouchEnd, { passive: false });
    window.addEventListener('touchcancel', this.boundTouchEnd, { passive: false });

    // Desktop Mouse Drag Fallback (화면 좌측 클릭 시 조이스틱 활성화)
    this.container.addEventListener('mousedown', this.boundMouseDown);
    window.addEventListener('mousemove', this.boundMouseMove);
    window.addEventListener('mouseup', this.boundMouseUp);
    document.addEventListener('mouseleave', this.boundMouseLeave);

    // Keyboard Fallback
    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);

    // 포커스 아웃 / 창 전환 / 우클릭 시 키 고착 방지
    window.addEventListener('blur', this.boundBlur);
    document.addEventListener('visibilitychange', this.boundVisibilityChange);
    window.addEventListener('contextmenu', this.boundContextMenu);
  }

  public destroy(): void {
    this.container.removeEventListener('touchstart', this.boundTouchStart);
    window.removeEventListener('touchmove', this.boundTouchMove);
    window.removeEventListener('touchend', this.boundTouchEnd);
    window.removeEventListener('touchcancel', this.boundTouchEnd);

    this.container.removeEventListener('mousedown', this.boundMouseDown);
    window.removeEventListener('mousemove', this.boundMouseMove);
    window.removeEventListener('mouseup', this.boundMouseUp);
    document.removeEventListener('mouseleave', this.boundMouseLeave);

    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);

    window.removeEventListener('blur', this.boundBlur);
    document.removeEventListener('visibilitychange', this.boundVisibilityChange);
    window.removeEventListener('contextmenu', this.boundContextMenu);
  }

  private onTouchStart(e: TouchEvent): void {
    if (!this.enabled || this.active) return;

    // UI 요소(버튼, 인풋, 셀렉트, 모달 등) 터치 시 조이스틱 터치 가로채기 방지
    const target = e.target as HTMLElement | null;
    if (target && target.closest('button, input, select, .lobby-container, .hud-top-bar, .hud-bottom-bar, .hud-control-actions, .hud-modal-overlay, .countdown-overlay, .result-modal-card')) {
      return;
    }

    const rect = this.container.getBoundingClientRect();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const relX = touch.clientX - rect.left;
      const relY = touch.clientY - rect.top;

      // 화면 좌측 65% 영역 터치 시 가상 플로팅 조이스틱 생성
      if (relX <= rect.width * 0.65) {
        e.preventDefault();
        this.touchId = touch.identifier;
        this.active = true;
        this.originX = relX;
        this.originY = relY;
        this.currentX = relX;
        this.currentY = relY;
        break;
      }
    }
  }

  private onTouchMove(e: TouchEvent): void {
    if (!this.enabled || !this.active || this.touchId === null) return;
    const rect = this.container.getBoundingClientRect();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === this.touchId) {
        e.preventDefault();
        const relX = touch.clientX - rect.left;
        const relY = touch.clientY - rect.top;
        this.updatePosition(relX, relY);
        break;
      }
    }
  }

  private onTouchEnd(e: TouchEvent): void {
    if (!this.active || this.touchId === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === this.touchId) {
        this.resetTouch();
        break;
      }
    }
  }

  private onMouseDown(e: MouseEvent): void {
    if (!this.enabled || this.active || e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target && target.closest('button, input, select, textarea, .lobby-container, .hud-top-bar, .hud-bottom-bar, .hud-control-actions, .hud-modal-overlay, .countdown-overlay, .result-modal-card')) {
      return;
    }

    const rect = this.container.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const relY = e.clientY - rect.top;

    if (relX <= rect.width * 0.65) {
      this.isMouseDown = true;
      this.active = true;
      this.originX = relX;
      this.originY = relY;
      this.currentX = relX;
      this.currentY = relY;
    }
  }

  private onMouseMove(e: MouseEvent): void {
    if (!this.isMouseDown || !this.active) return;
    const rect = this.container.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const relY = e.clientY - rect.top;
    this.updatePosition(relX, relY);
  }

  private onMouseUp(): void {
    if (this.isMouseDown || this.active) {
      this.isMouseDown = false;
      this.resetTouch();
    }
  }

  private updatePosition(x: number, y: number): void {
    const dx = x - this.originX;
    const dy = y - this.originY;
    const dist = Math.hypot(dx, dy);

    if (dist > this.maxRadius) {
      const angle = Math.atan2(dy, dx);
      this.currentX = this.originX + Math.cos(angle) * this.maxRadius;
      this.currentY = this.originY + Math.sin(angle) * this.maxRadius;
    } else {
      this.currentX = x;
      this.currentY = y;
    }
  }

  private resetTouch(): void {
    this.active = false;
    this.touchId = null;
    this.isMouseDown = false;
    this.currentX = this.originX;
    this.currentY = this.originY;
  }

  private onKeyDown(e: KeyboardEvent): void {
    // 입력창(인풋) 포커스 시 게임 키 입력 차단
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
      return;
    }

    const code = e.code;
    const key = e.key ? e.key.toLowerCase() : '';

    if (code === 'KeyW' || code === 'ArrowUp' || key === 'w' || key === 'arrowup') {
      this.keys.up = true;
      if (code.startsWith('Arrow')) e.preventDefault();
    } else if (code === 'KeyS' || code === 'ArrowDown' || key === 's' || key === 'arrowdown') {
      this.keys.down = true;
      if (code.startsWith('Arrow')) e.preventDefault();
    } else if (code === 'KeyA' || code === 'ArrowLeft' || key === 'a' || key === 'arrowleft') {
      this.keys.left = true;
      if (code.startsWith('Arrow')) e.preventDefault();
    } else if (code === 'KeyD' || code === 'ArrowRight' || key === 'd' || key === 'arrowright') {
      this.keys.right = true;
      if (code.startsWith('Arrow')) e.preventDefault();
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    const code = e.code;
    const key = e.key ? e.key.toLowerCase() : '';

    if (code === 'KeyW' || code === 'ArrowUp' || key === 'w' || key === 'arrowup') {
      this.keys.up = false;
    } else if (code === 'KeyS' || code === 'ArrowDown' || key === 's' || key === 'arrowdown') {
      this.keys.down = false;
    } else if (code === 'KeyA' || code === 'ArrowLeft' || key === 'a' || key === 'arrowleft') {
      this.keys.left = false;
    } else if (code === 'KeyD' || code === 'ArrowRight' || key === 'd' || key === 'arrowright') {
      this.keys.right = false;
    }
  }

  public getInput(): JoystickInput {
    // 1. 터치/마우스 조이스틱 우선
    if (this.active) {
      const rawDx = this.currentX - this.originX;
      const rawDy = this.currentY - this.originY;
      const dist = Math.hypot(rawDx, rawDy);
      if (dist < 4) {
        return {
          active: true,
          dx: 0,
          dy: 0,
          originX: this.originX,
          originY: this.originY,
          currentX: this.currentX,
          currentY: this.currentY
        };
      }
      const normDx = Math.max(-1, Math.min(1, rawDx / this.maxRadius));
      const normDy = Math.max(-1, Math.min(1, rawDy / this.maxRadius));
      return {
        active: true,
        dx: normDx,
        dy: normDy,
        originX: this.originX,
        originY: this.originY,
        currentX: this.currentX,
        currentY: this.currentY
      };
    }

    // 2. 키보드 입력 폴백
    let kx = 0;
    let ky = 0;
    if (this.keys.left) kx -= 1;
    if (this.keys.right) kx += 1;
    if (this.keys.up) ky -= 1;
    if (this.keys.down) ky += 1;

    if (kx !== 0 || ky !== 0) {
      const len = Math.hypot(kx, ky);
      return {
        active: true,
        dx: kx / len,
        dy: ky / len,
        originX: 0,
        originY: 0,
        currentX: 0,
        currentY: 0
      };
    }

    return {
      active: false,
      dx: 0,
      dy: 0,
      originX: 0,
      originY: 0,
      currentX: 0,
      currentY: 0
    };
  }

  /**
   * 화면 UI 상에 터치 조이스틱 링과 스틱 헤드를 렌더링
   */
  public render(ctx: CanvasRenderingContext2D, uiScale: number = 1): void {
    if (!this.active || (this.originX === 0 && this.originY === 0)) return;

    ctx.save();
    // 베이스 링
    ctx.beginPath();
    ctx.arc(this.originX, this.originY, this.maxRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.stroke();

    // 조이스틱 헤드
    ctx.beginPath();
    ctx.arc(this.currentX, this.currentY, 24, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(56, 189, 248, 0.7)'; // neon cyan
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // 중심 방향 연결선
    ctx.beginPath();
    ctx.moveTo(this.originX, this.originY);
    ctx.lineTo(this.currentX, this.currentY);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.restore();
  }
}
