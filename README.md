# ☕💥 커피 스트라이크 (Coffee Strike)

> **10인 실시간 모바일 넉아웃 슈터: 오늘 커피 살 사람은?**  
> Vercel에 100% 무료 정적 호스팅할 수 있는 WebRTC 기반 Star Topology 실시간 슈팅 게임입니다.

[![Vite](https://img.shields.io/badge/Vite-6.1.0-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7.3-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PeerJS](https://img.shields.io/badge/PeerJS-WebRTC-22c55e)](https://peerjs.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 🎮 게임 개요
- **장르**: 2D 탑다운 아레나 넉아웃 스모 슈터
- **핵심 룰**: 경기장 밖(Ring-out)으로 추락하거나 누적 대미지로 체력(HP)이 고갈되면 탈락!
- **커피 당첨자**: **가장 먼저 맵 밖으로 떨어진 플레이어** (영수증 벌칙금 3,000원 청구서 발부)
- **우승자**: 최후까지 살아남은 1인 (팀전 시 최후 생존 팀)

---

## 🚀 기술 스택 & 100% 무료 인프라
- **Front-end**: Vite + Vanilla TypeScript + HTML5 Canvas (2D)
- **Design System**: Cyber Arcade Neon 테마 + 가상 조이스틱 DPI 오토 스케일링
- **Networking**: PeerJS (WebRTC DataChannel Star Topology, 호스트 권한 물리 연산 30Hz)
- **Audio**: Web Audio API 내장 신시사이저 (외부 오디오 파일 로딩 0%)
- **Deploy**: Vercel Static Hosting (외부 백엔드 서버 및 API Key 의존성 0)

---

## 🔫 무기 4종 밸런스 스펙 (HP 100 기준)
사거리 내 가장 가까운 적을 탐색하여 **자동 조준(Auto-Aim) 및 자동 발사(Auto-Fire)**됩니다.

| 무기 구분 | 연사 쿨타임 | 넉백 충격량 | 대미지 | 탄창 (제한 모드) | 사거리 & 탄도 특성 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **밸런스 피스톨** | 0.38초 | 55 | 10 | 12발 | 중간 사거리(560px), 단발 직진, 올라운더 |
| **헤비 샷건** | 0.65초 | 128 (32x4) | 26 (6.5x4) | 5발 | 단거리(360px), 4방향 산탄, 초근접 폭발 넉백 |
| **저격 스나이퍼** | 1.40초 | 150 | 25 | 4발 | 초장거리(750px), 직선 궤적, 4발 명중 시 치명타 |
| **연사 머신건** | 0.08초 | 12 | 4.0 | 40발 | 중단거리(450px), 고속 연타 지속 밀림 |

> **히트 게이지 (Heat)**: 피격 누적 시 넉백 배율이 최대 1.8배까지 증폭되어 외곽 장외 위험도가 급증합니다.

---

## ⚡ 드롭 아이템 & 10초 서든데스
- ⚡ **파워 2배 (Power)**: 7초간 총기 넉백 위력 2.0배 증가
- 🧪 **체력 회복 (Heal)**: 체력 즉시 +200 회복
- ⭐ **무적 5초 (Invincible)**: 5초간 모든 대미지 및 넉백 충격 무효화
- ⚠️ **10초 서든데스 (Sudden Death)**:
  - 경기 종료 10초 전 사이렌 경보와 함께 **모든 엄폐물 즉시 소멸**
  - 전 플레이어 **탄약 무제한 강제 발동** ➔ 광란의 전면전 유도

---

## 🕹️ 방 설정 & 게임 모드
| 설정 항목 | 옵션 값 | 기본값 | 비고 |
| :--- | :--- | :--- | :--- |
| **참여 인원** | 2인 ~ 최대 10인 | 10인 | 대기실 QR 코드 지원 (터미널 및 UI) |
| **게임 모드** | 개인전(FFA) / 팀전 | 개인전 | 팀전: 2~4팀 분할 (아군 오인 사격 방지) |
| **경기 시간** | 60초 / 120초 / 180초 | 120초 | 실시간 카운트다운 타이머 |
| **게임 배속** | 1.0x / 1.5x / 2.0x / 3.0x | 1.0x | 이동/탄속/연사/쿨타임 동시 가속 |
| **탄약 모드** | 무제한 / 제한 | 무제한 | 제한 모드 시 탄창 소진 시 1.2초 재장전 |
| **로컬 봇** | 1 ~ 9인 AI 봇 스폰 | - | 솔로 플레이 및 밸런스 테스트용 |

---

## 📁 프로젝트 모듈 구조
```text
Coffee Strike/
├── src/
│   ├── engine/       # 코어 물리(Physics), 경기장(Arena), 조이스틱, 신시사이저(Audio), 렌더러
│   ├── objects/      # 플레이어(Player), 탄환(Bullet), 아이템(Item), 엄폐물(Obstacle)
│   ├── net/          # PeerJS WebRTC P2P 네트워크 어댑터 및 C2S/S2C 프로토콜 정의
│   ├── ui/           # HUD, 실시간 킬피드, 로비 UI, 사이버 영수증 결과창
│   ├── main.ts       # 게임 진입점 및 생명주기 오케스트레이션
│   └── style.css     # Cyber Arcade Neon 전역 디자인 시스템
├── scripts/
│   ├── dev-qr.ts            # LAN IP 자동 감지 터미널 QR 코드 개발 서버
│   └── simulate-balance.ts  # 200 매치 무기 밸런스 몬테카를로 시뮬레이터
├── tests/
│   ├── engine.test.ts       # 물리 엔진, 넉백, 아이템, 경기장 경계 단위 테스트
│   ├── lifecycle.test.ts    # 방 생성/참가, 결과창, 재경기(Rematch) 동기화 검증
│   └── mobile-touch.spec.ts # Playwright 모바일 터치 E2E 테스트
└── dist/                    # Vercel 배포용 프로덕션 번들
```

---

## 🛠️ 실행 및 테스트 명령어

```bash
# 1. 의존성 설치
npm install

# 2. 로컬 개발 서버 실행
npm run dev

# 3. 모바일 접속용 QR 코드 개발 서버 실행 (동일 Wi-Fi 실기기 테스트)
npm run dev:qr

# 4. 물리/라이프사이클 자동화 단위 테스트 (41개 검증)
npm test

# 5. 200 매치 무기 밸런스 헤드리스 시뮬레이션
npm run test:balance

# 6. 프로덕션 빌드 검증 (TypeScript 검사 포함)
npm run build
```

---

## 📦 Vercel 배포 가이드
1. GitHub 저장소를 Vercel에 연동합니다.
2. 배포 설정:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `./`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. 환경 변수(`.env`) 설정 없이 바로 무료 배포 완료. 생성된 URL을 카카오톡/슬랙에 공유하면 모바일 브라우저로 10명이 즉시 동시 대전을 즐길 수 있습니다.
