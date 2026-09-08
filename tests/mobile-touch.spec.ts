import { test, expect } from '@playwright/test';

test.describe('Mobile Viewport & Touch Interaction', () => {
  test('모바일 화면에서 캔버스와 로비 UI가 정상 렌더링되어야 함', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/');

    // 1. 뷰포트 메타태그 확인 (Safe Area 및 확대 방지)
    const viewportMeta = page.locator('meta[name="viewport"]');
    await expect(viewportMeta).toHaveAttribute('content', /viewport-fit=cover/);

    // 2. 캔버스 엘리먼트 존재 및 크기 확인
    const canvas = page.locator('#game-canvas');
    await expect(canvas).toBeVisible();

    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(300);
    expect(box!.height).toBeGreaterThan(500);

    // 3. 로비 UI 또는 싱글 플레이 시작 버튼 탐색
    const singlePlayBtn = page.locator('button:has-text("혼자하기"), button:has-text("연습"), button:has-text("시작")').first();
    if (await singlePlayBtn.isVisible()) {
      await singlePlayBtn.click();
      await page.waitForTimeout(500);
    }

    // 4. 모바일 터치 시뮬레이션 (조이스틱 영역 터치 및 드래그)
    // 화면 좌하단 가상 조이스틱 영역
    const startX = 100;
    const startY = box!.height - 150;

    await page.touchscreen.tap(startX, startY);
    await page.waitForTimeout(100);

    // 5. 치명적 JS 에러 발생 여부 검증
    const fatalErrors = errors.filter((e) => !e.includes('Peer') && !e.includes('ICE'));
    expect(fatalErrors).toHaveLength(0);
  });
});
