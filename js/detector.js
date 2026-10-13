/**
 * Lexical Phishing Detector Client Script
 * 10번 연구 논문 실증 통계 기반 사전 분석 엔진
 * Pure Vanilla JavaScript (No Framework / No External API)
 */

document.addEventListener('DOMContentLoaded', () => {
  const samples = {
    safe1: "https://www.naver.com",
    safe2: "https://github.com/wonq-Port",
    phish1: "http://secure-login-account-update.com/signin/auth-step",
    phish2: "http://myaccount.verify@user-update-security-protection-service.com/login?token=8943892429482934892489"
  };

  const inputEl = document.getElementById('url-input');
  const btnRun = document.getElementById('btn-run');
  const errorBox = document.getElementById('error-box');
  const resultDashboard = document.getElementById('result-dashboard');

  // 샘플 로드 함수 전역 바인딩
  window.loadSample = function(key) {
    if (inputEl && samples[key]) {
      inputEl.value = samples[key];
      analyzeUrl();
    }
  };

  function showError(msg) {
    if (errorBox) {
      errorBox.textContent = msg;
      errorBox.classList.add('active');
    }
    if (resultDashboard) {
      resultDashboard.classList.remove('active');
    }
  }

  function clearError() {
    if (errorBox) {
      errorBox.textContent = '';
      errorBox.classList.remove('active');
    }
  }

  function analyzeUrl() {
    clearError();
    let rawUrl = (inputEl ? inputEl.value : '').trim();

    // [방어 로직 BRB-C05] 잘못된 입력 처리
    if (!rawUrl) {
      showError("⚠️ URL을 입력해 주세요. (예시 샘플 버튼을 누르시면 바로 테스트할 수 있습니다)");
      return;
    }

    // 공백 제거 및 프로토콜 보정
    rawUrl = rawUrl.replace(/\s+/g, '');
    let parseTarget = rawUrl;
    if (!parseTarget.startsWith('http://') && !parseTarget.startsWith('https://')) {
      parseTarget = 'http://' + parseTarget;
    }

    let parsedHostname = '';
    let parsedPath = '';
    try {
      const u = new URL(parseTarget);
      parsedHostname = u.hostname || '';
      parsedPath = u.pathname + u.search + u.hash;
    } catch (e) {
      const match = parseTarget.match(/^https?:\/\/([^\/\?#]+)(.*)$/i);
      if (match) {
        parsedHostname = match[1];
        parsedPath = match[2] || '';
      } else {
        parsedHostname = parseTarget.split('/')[0];
        parsedPath = parseTarget.substring(parsedHostname.length);
      }
    }

    if (!parsedHostname || parsedHostname.length < 2) {
      showError("⚠️ 입력된 문자열에서 유효한 도메인을 식별할 수 없습니다. 올바른 주소 형식을 입력해 주세요.");
      return;
    }

    // 10번 논문 통계 기반 형태학적 특징 추출
    const urlLength = rawUrl.length;
    const numDashInHostname = (parsedHostname.match(/-/g) || []).length;
    const hasAtSign = rawUrl.includes('@');
    const numDotsInHostname = (parsedHostname.match(/\./g) || []).length;
    const doubleSlashInPath = parsedPath.includes('//');
    const numEquals = (rawUrl.match(/=/g) || []).length;
    const hasSuspiciousWord = /(login|verify|account|banking|security|signin|update|secure|service|ebay|paypal|apple|google)/i.test(rawUrl);

    // 위험도 점수 계산 (Risk Score: 0 ~ 100)
    let score = 5;

    // 1. 길이 가중치 (논문: 29자부터 피싱 58.6% 급증, 피싱 평균 66.49자)
    if (urlLength >= 66) {
      score += 35;
    } else if (urlLength >= 29) {
      score += 20;
    }

    // 2. 도메인 내부 하이픈 (논문: 피싱 사이트가 정상보다 3.88배 높음, t=15.22)
    if (numDashInHostname >= 2) {
      score += 35;
    } else if (numDashInHostname === 1) {
      score += 20;
    }

    // 3. 특수문자 가중치
    if (hasAtSign) score += 30; // @는 치명적 위장 기호
    if (doubleSlashInPath) score += 15;
    if (numDotsInHostname >= 3) score += 15; // 다중 서브도메인 위장
    if (numEquals >= 3) score += 10;
    if (hasSuspiciousWord && numDashInHostname > 0) score += 15;

    score = Math.min(100, Math.max(0, score));

    // UI 렌더링
    if (resultDashboard) resultDashboard.classList.add('active');

    const banner = document.getElementById('score-banner');
    const scoreNum = document.getElementById('score-number');
    const scoreTitle = document.getElementById('score-title');
    const scoreDesc = document.getElementById('score-desc');
    const actionGuide = document.getElementById('action-guide');

    if (scoreNum) scoreNum.textContent = score;

    if (banner) {
      banner.className = 'score-banner';
      if (score < 30) {
        banner.classList.add('safe');
        if (scoreTitle) scoreTitle.textContent = '안전 수준 (Low Risk)';
        if (scoreDesc) scoreDesc.textContent = '논문의 피싱 판별 임계 기준을 초과하지 않는 일반적인 형태의 URL입니다.';
        if (actionGuide) actionGuide.textContent = 'URL 구조가 표준적입니다. 다만 금융·결제 정보를 입력할 때는 브라우저 주소창의 정식 도메인과 보안 인증서(HTTPS)를 다시 한번 확인하세요.';
      } else if (score < 60) {
        banner.classList.add('warning');
        if (scoreTitle) scoreTitle.textContent = '주의 요망 (Moderate Risk)';
        if (scoreDesc) scoreDesc.textContent = 'URL 길이가 다소 길거나 일부 피싱 의심 패턴(도메인 하이픈 등)이 감지되었습니다.';
        if (actionGuide) actionGuide.textContent = '도메인 내부에 하이픈(-)이나 긴 문자열이 포함되어 있습니다. 공공기관이나 공식 기업을 사칭하는 가짜 주소일 가능성이 있으므로 링크를 통한 직접 로그인을 자제하세요.';
      } else {
        banner.classList.add('danger');
        if (scoreTitle) scoreTitle.textContent = '위험 (High Risk / Likely Phishing)';
        if (scoreDesc) scoreDesc.textContent = '11만 건 보안 연구에서 규명된 핵심 피싱 패턴(과다 길이, 호스트 하이픈 위장 등)이 다수 일치합니다.';
        if (actionGuide) actionGuide.textContent = '경고: 피싱 사이트일 확률이 매우 높습니다! 이 링크를 절대 클릭하거나 개인정보 및 비밀번호를 입력하지 마시고 즉시 창을 닫으세요.';
      }
    }

    // 특징 카드 수치 갱신
    const statLen = document.getElementById('stat-len');
    const bLen = document.getElementById('badge-len');
    if (statLen) statLen.textContent = urlLength;
    if (bLen) {
      if (urlLength >= 66) {
        bLen.textContent = '위험 (피싱 평균 초과)';
        bLen.className = 'feature-status status-alert';
      } else if (urlLength >= 29) {
        bLen.textContent = '주의 (29자 임계점 초과)';
        bLen.className = 'feature-status status-warn';
      } else {
        bLen.textContent = '정상 (23.59자 부근)';
        bLen.className = 'feature-status status-ok';
      }
    }

    const statHyphen = document.getElementById('stat-hyphen');
    const bHyphen = document.getElementById('badge-hyphen');
    if (statHyphen) statHyphen.textContent = numDashInHostname;
    if (bHyphen) {
      if (numDashInHostname >= 1) {
        bHyphen.textContent = `위험 (도메인 하이픈 ${numDashInHostname}개)`;
        bHyphen.className = 'feature-status status-alert';
      } else {
        bHyphen.textContent = '정상 (하이픈 없음)';
        bHyphen.className = 'feature-status status-ok';
      }
    }

    const totalSpecials = (hasAtSign ? 1 : 0) + (doubleSlashInPath ? 1 : 0) + (numDotsInHostname >= 3 ? 1 : 0) + (numEquals >= 2 ? 1 : 0);
    const statSpecials = document.getElementById('stat-specials');
    const bSpecials = document.getElementById('badge-specials');
    if (statSpecials) statSpecials.textContent = totalSpecials;
    if (bSpecials) {
      if (totalSpecials >= 2 || hasAtSign) {
        bSpecials.textContent = '주의 / 위험 기호 검출';
        bSpecials.className = 'feature-status status-alert';
      } else {
        bSpecials.textContent = '정상 범위';
        bSpecials.className = 'feature-status status-ok';
      }
    }

    // 대조표 렌더링
    const tbody = document.getElementById('evidence-tbody');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td><strong>전체 길이 (url_length)</strong></td>
          <td>${urlLength}자</td>
          <td>23.59자</td>
          <td>66.49자</td>
          <td>${urlLength >= 29 ? '<span style="color:#b91c1c; font-weight:700;">29자 임계치 초과 (피싱 비율 58.6% 급증 구간)</span>' : '<span style="color:#15803d;">정상 범위 (29자 미만)</span>'}</td>
        </tr>
        <tr>
          <td><strong>도메인 내 하이픈 (NumDashInHostname)</strong></td>
          <td>${numDashInHostname}개</td>
          <td>0.06개</td>
          <td>0.22개</td>
          <td>${numDashInHostname >= 1 ? '<span style="color:#b91c1c; font-weight:700;">피싱 3.88배 검출 규칙 해당 (t=15.22, p&lt;0.001)</span>' : '<span style="color:#15803d;">정상 범위 (호스트 하이픈 없음)</span>'}</td>
        </tr>
        <tr>
          <td><strong>골뱅이 기호 (@) 포함 여부</strong></td>
          <td>${hasAtSign ? '포함됨 (위험)' : '없음'}</td>
          <td>0.00%</td>
          <td>통계적 유의성</td>
          <td>${hasAtSign ? '<span style="color:#b91c1c; font-weight:700;">사용자 속임수용 인증 위장 패턴 감지</span>' : '<span style="color:#15803d;">정상</span>'}</td>
        </tr>
        <tr>
          <td><strong>호스트네임 서브도메인 (Dots)</strong></td>
          <td>${numDotsInHostname}개</td>
          <td>1.85개</td>
          <td>2.31개</td>
          <td>${numDotsInHostname >= 3 ? '<span style="color:#b45309; font-weight:700;">다중 계층 도메인 위장 의심</span>' : '<span style="color:#15803d;">정상 범위</span>'}</td>
        </tr>
      `;
    }
  }

  if (btnRun) btnRun.addEventListener('click', analyzeUrl);
  if (inputEl) {
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') analyzeUrl();
    });
  }
});
