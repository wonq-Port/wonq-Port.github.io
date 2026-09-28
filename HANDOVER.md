# [HANDOVER] 과제 4 환율 목표 알림 및 임계치 경보 기능 인수인계서

> **작성 주체:** AI 세션 A (Model Alpha)  
> **수신 주체:** AI 세션 B (Model Beta - 이전 대화 기록 없음)  
> **기준 시각:** 2026-09-28 KST  
> **프로젝트:** 오늘의 진짜 정보판 (과제 4 - USD/KRW 환율 정보판)  
> **목적:** 이전 대화 전문 없이 저장소 코드와 본 문서만으로 작업을 재개하여 사전에 고정된 10대 검사를 완수함.

---

## 1. 작업 목표 및 배경 (Target Objective)
- **개선 배경:** '오늘의 진짜 정보판'에 사용자가 지정한 관심 목표 환율(상한가 돌파 / 하한가 하회)을 실시간으로 감시하고, 조건 도달 시 시각적 경보(배지 및 배너)를 즉시 발동하는 기능을 추가합니다.
- **핵심 요구사항:**
  - 외부 무거운 라이브러리(npm/CDN) 설치 금지 (순수 Vanilla JS + LocalStorage 환경 유지).
  - 기존 실시간 환율 수집 및 5종 장애 합성 복원(Stale 상태 머신) 로직과 100% 호환성 유지.
  - 사전에 고정된 10개 검사 항목을 전건 PASS(10/10)해야 함.

---

## 2. 현재까지 완료된 작업 (Completed Scope by AI A)
AI 세션 A에서 기초 아키텍처 및 코어 비즈니스 로직 설계를 완료했습니다:
1. **상태 스키마 설계 완료 (`alertConfig` & `alertHistory`):**
   ```javascript
   alertConfig = {
     enabled: false,           // 알림 감시 활성화 여부
     upperLimit: null,         // 상한 환율 (예: 1340.00)
     lowerLimit: null,         // 하한 환율 (예: 1330.00)
     lastTriggeredState: null  // null | 'UPPER' | 'LOWER'
   };
   alertHistory = [];          // 발생 이력 최근 5건 보존
