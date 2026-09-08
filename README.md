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
- **핵심 룰**: 체력 고갈이 아닌, **총알의 넉백 충격량에 의해 경기장 밖(Ring-out)으로 추락하면 탈락**!
- **커피 당첨자**: **가장 먼저 맵 밖으로 떨어진 플레이어** (타임오버 시 외곽 밀림 누적 최다자)

---

## 🚀 기술 스택 & 100% 무료 인프라
- **Front-end**: Vite + Vanilla TypeScript + HTML5 Canvas (2D)
- **Networking**: PeerJS (WebRTC DataChannel Star Topology, 호스트 권한 물리 연산 30Hz)
- **Audio**: Web Audio API 내장 신시사이저 (외부 에셋 로딩 0%)
- **Deploy**: Vercel Static Hosting (Hobby 무료 플랜)

---

## 🔫 무기 4종 스펙
| 무기 구분 | 연사 쿨타임 | 넉백 충격량 | 탄창 (제한 모드) | 사거리 & 탄도 특성 |
| :--- | :--- | :--- | :--- | :--- |
| **밸런스 피스톨** | 0.35초 | 160 | 12발 | 중간 사거리, 직진 1발 |
| **헤비 샷건** | 0.85초 | 340 (85x4) | 4발 | 단거리, 부채꼴 4발 방사, 초근접 폭발 넉백 |
| **저격 스나이퍼** | 1.30초 | 460 | 3발 | 초장거리 레이저 궤적, 강력한 직선 1타 넉백 |
| **연사 머신건** | 0.10초 | 48 | 35발 | 중단거리, 고속 연타로 상대를 연속 밀어냄 |

---

## ⚡ 버프 아이템 & 10초 서든데스
- 🔴 **파워 업 (Power)**: 총기 넉백 위력 2.0배 증가
- 🔵 **스피드 업 (Speed)**: 이동속도 +50% 증가
- 🟡 **헤비 쉴드 (Shield)**: 질량 3.0배 (넉백 저항 70% 감소)
- ⚠️ **10초 서든데스 (Sudden Death)**:
  - 경기 종료 10초 전 사이렌 경보와 함께 **모든 엄폐물이 즉시 분해 소멸**
  - 전 플레이어 **탄약 무제한 강제 발동** ➔ 광란의 난타전 유도

---

## 🕹️ 로컬 실행 방법

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 자동화 물리/규칙 단위 테스트
npm test

# 프로덕션 빌드 검증
npm run build
```

---

## 📦 Vercel 배포 설정
1. Vercel에 본 저장소를 연결합니다.
2. 설정값:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `./`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. 무료로 배포 완료 후 모바일 브라우저 URL 접속만으로 즉시 10인 플레이 가능!
