/**
 * Portfolio Interactive Scripts (js/script.js)
 * Pure Vanilla JavaScript — Compact Project Modal, Metric Counter,
 * Dual Dropdown Navigation & Smooth Interactions
 */

document.addEventListener('DOMContentLoaded', () => {
  const navbar = document.getElementById('navbar');
  const scrollProgress = document.getElementById('scroll-progress');
  const logoBtn = document.getElementById('logo-btn');
  const motionToggleBtn = document.getElementById('motion-toggle-btn');

  const overviewDropdown = document.getElementById('nav-overview-dropdown');
  const overviewBtn = document.getElementById('nav-overview-btn');
  const projectsDropdown = document.getElementById('nav-projects-dropdown');
  const projectsBtn = document.getElementById('nav-projects-btn');

  const modal = document.getElementById('detail-modal');
  const modalTag = document.getElementById('modal-project-tag');
  const modalTitle = document.getElementById('modal-project-title');
  const modalSarS = document.getElementById('modal-sar-s');
  const modalSarA = document.getElementById('modal-sar-a');
  const modalSarR = document.getElementById('modal-sar-r');
  const modalSpecs = document.getElementById('modal-specs-block');
  const modalActions = document.getElementById('modal-actions-row');
  const modalClose = document.getElementById('detail-modal-close');
  const modalBackdrop = document.getElementById('detail-modal-backdrop');
  let lastActiveElement = null;

  // 1. Scroll Progress & Navbar Elevation
  const handleScroll = () => {
    const scrollY = window.scrollY;
    if (navbar) {
      if (scrollY > 24) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    }

    if (scrollProgress) {
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? (scrollY / docHeight) * 100 : 0;
      scrollProgress.style.width = `${Math.min(100, Math.max(0, progress))}%`;
    }
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();

  // 2. Dual Dropdown Navigation
  const closeAllDropdowns = () => {
    if (overviewDropdown) {
      overviewDropdown.classList.remove('open');
      if (overviewBtn) overviewBtn.setAttribute('aria-expanded', 'false');
    }
    if (projectsDropdown) {
      projectsDropdown.classList.remove('open');
      if (projectsBtn) projectsBtn.setAttribute('aria-expanded', 'false');
    }
  };

  if (overviewBtn && overviewDropdown) {
    overviewBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = overviewDropdown.classList.contains('open');
      closeAllDropdowns();
      if (!isOpen) {
        overviewDropdown.classList.add('open');
        overviewBtn.setAttribute('aria-expanded', 'true');
      }
    });
  }

  if (projectsBtn && projectsDropdown) {
    projectsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = projectsDropdown.classList.contains('open');
      closeAllDropdowns();
      if (!isOpen) {
        projectsDropdown.classList.add('open');
        projectsBtn.setAttribute('aria-expanded', 'true');
      }
    });
  }

  document.querySelectorAll('.dropdown-item').forEach((item) => {
    item.addEventListener('click', () => {
      closeAllDropdowns();
    });
  });

  document.addEventListener('click', (e) => {
    if (overviewDropdown && projectsDropdown) {
      if (!overviewDropdown.contains(e.target) && !projectsDropdown.contains(e.target)) {
        closeAllDropdowns();
      }
    }
  });

  // 3. Smooth Scroll Navigation
  if (logoBtn) {
    logoBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href').slice(1);
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        e.preventDefault();
        closeAllDropdowns();
        targetEl.scrollIntoView({ behavior: 'smooth' });
        targetEl.setAttribute('tabindex', '-1');
        targetEl.focus({ preventScroll: true });
      }
    });
  });

  // 4. Motion Reduction Toggle
  if (motionToggleBtn) {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const applyMotionSetting = (shouldReduce) => {
      if (shouldReduce) {
        document.body.classList.add('reduce-motion');
        motionToggleBtn.setAttribute('aria-pressed', 'true');
        motionToggleBtn.textContent = '모션 줄이기: ON';
      } else {
        document.body.classList.remove('reduce-motion');
        motionToggleBtn.setAttribute('aria-pressed', 'false');
        motionToggleBtn.textContent = '모션 줄이기: OFF';
      }
    };

    if (mediaQuery.matches) {
      applyMotionSetting(true);
    }

    motionToggleBtn.addEventListener('click', () => {
      const isCurrentlyReduced = document.body.classList.contains('reduce-motion');
      applyMotionSetting(!isCurrentlyReduced);
    });
  }

  // 5. Scroll Reveal & Metric Count-Up Animation
  const animateMetricValue = (el) => {
    if (el.dataset.animated === 'true') return;
    el.dataset.animated = 'true';

    const target = parseInt(el.dataset.countTarget || '0', 10);
    const suffix = el.dataset.countSuffix || '';
    const format = el.dataset.countFormat || '';
    if (!target || document.body.classList.contains('reduce-motion')) {
      const formatted = format === 'comma' ? target.toLocaleString('ko-KR') : String(target);
      el.textContent = formatted + suffix;
      return;
    }

    const duration = 850;
    const startTime = performance.now();

    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(target * eased);
      const formatted = format === 'comma' ? current.toLocaleString('ko-KR') : String(current);
      el.textContent = formatted + suffix;
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };

    requestAnimationFrame(step);
  };

  const revealElements = document.querySelectorAll('.reveal-on-scroll');
  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          const metricVal = entry.target.querySelector('.metric-val[data-count-target]');
          if (metricVal) animateMetricValue(metricVal);
          revealObserver.unobserve(entry.target);
        }
      });
    }, { root: null, rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    revealElements.forEach((el) => revealObserver.observe(el));
  } else {
    revealElements.forEach((el) => el.classList.add('is-visible'));
  }

  // 6. 3대 대표 프로젝트 상세 데이터 (모달 팝업용 데이터)
  const projectDetailsData = {
    ztna: {
      tag: "PROJECT 01 · ZTNA & XDR SECURITY SUITE",
      title: "ZTNA·XDR 통합 보안 웹 애플리케이션 아키텍처",
      s: "<strong>상황 (Situation):</strong> 단순 계정 로그인만으로는 비인가 기기 접근, 무차별 대입(Brute-force) 공격 및 권한 우회 API 호출을 방어하기 어려워 신원과 디바이스를 동시에 검증하는 제로트러스트(ZTNA) 및 침해 탐지·대응(XDR) 체계가 필요했습니다.",
      a: "<strong>행동 (Action):</strong> Supabase Auth JWKS 비대칭 키 서명 검증, 디바이스 고유 인가(/api/device), 허용 엔드포인트 화이트리스트 라우팅, 실시간 로그인 실패 횟수 기반 공격 차단 및 SAMPLE_NOTE_1 무결성 마커를 통한 안전한 복원(/api/restore) 파이프라인을 구축했습니다.",
      r: "<strong>결과 (Result):</strong> 비인가 경로 100% 차단과 공격 탐지·격리·데이터 무결성 복원 자동화를 검증하고 실제 클라우드 환경에 배포했습니다.",
      specs: `[ZTNA & XDR 아키텍처 핵심 명세]
• 인증/인가: Supabase /.well-known/jwks.json 기반 JWT 서명 & audience: "authenticated" 검증
• 디바이스 제어: 등록된 인가 기기 식별자에 한해 세션 발급 (/api/device)
• 접근 통제: POST /api/login, POST /api/device, /api/memos, POST /api/restore 외 비인가 경로 100% 차단
• XDR 위협 완화: 비정상 무차별 대입 공격 실시간 차단 및 데이터 변조 시 원클릭 무결성 복구`,
      actions: [
        { label: "배포 웹 애플리케이션 열기 ↗", url: "https://choi-bujang-secret-vault-one-phi.vercel.app/", primary: true },
        { label: "GitHub 저장소 ↗", url: "https://github.com/wonq-Port/choi-bujang-secret-vault", primary: false }
      ]
    },

    phishing: {
      tag: "PROJECT 02 · RESEARCH PAPER & LIVE WEB APP",
      title: "피싱 URL 형태학 분석 연구 논문 & 사전 진단기 웹앱",
      s: "<strong>상황 (Situation):</strong> 웹페이지 본문에 직접 접속해 분석하는 방식은 악성코드 감염 위험과 네트워크 지연이 발생하므로, 브라우저 접속 전 URL 문자열 구조만으로 위험도를 사전 판별할 통계적 근거와 진단 도구가 필요했습니다.",
      a: "<strong>행동 (Action):</strong> 110,077건 공개 보안 데이터셋에 대해 Welch t-검정을 수행해 호스트네임 내부 하이픈(NumDashInHostname)과 URL 길이의 피싱 상관관계를 규명하여 단독 연구 논문을 작성했습니다. 이어 연구 임계치를 브라우저 내부에서 즉시 연산하는 무서버 Vanilla JS 사전 진단기(단일 검사, A/B 대조, 500줄 일괄 진단, 퀴즈, 누적 통계)를 구현하고 CSV Injection 방어 로직을 적용했습니다.",
      r: "<strong>결과 (Result):</strong> 정상 대비 피싱 URL 호스트 하이픈 3.88배, 길이 2.82배 통계적 유의성(p<0.001) 입증 및 클라이언트 단독 실행 보안 웹앱 정식 배포를 완료했습니다.",
      specs: `[연구 논문 통계 & 웹앱 진단 명세]
• 분석 표본: web-page-phishing.csv (100,077건) + dataset6.csv (10,000건)
• 가설 정교화: 검색엔진(SEO) 경로 하이픈 왜곡을 제거하고 '호스트네임 내부 하이픈' 분리 측정
• 진단 알고리즘: URL 길이 29자 임계점, 호스트 하이픈 빈도, 위험 문자(@, =, .) 종합 가중합 점수화
• 클라이언트 보안: 제로 네트워크(Zero-Network) 브라우저 독립 분석 및 악성 수식 실행 차단(CSV 이스케이프)`,
      actions: [
        { label: "피싱 URL 사전 진단기 웹앱 실행 →", url: "phishing-detector.html", primary: true },
        { label: "논문 파일 원문 다운로드/열람 ↗", url: "https://drive.google.com/file/d/1JIYAKJRQSLqqQi_LWV_2zgnzysrBoxuY/view?usp=drivesdk", primary: false }
      ]
    },

    infra: {
      tag: "PROJECT 03 · NETWORK INFRASTRUCTURE & MONITORING",
      title: "Cisco ASAv 망 분리 & Snort 침입 탐지·통합 관제 체계 구축",
      s: "<strong>상황 (Situation):</strong> 내부 업무망(Inside)과 외부 공개망(DMZ), 인터넷 경계 구간에서 비인가 트래픽 유입 및 단일 장애점(SPOF) 위협이 존재하며, 엔드포인트 시스템 파일 변조와 침입 시도를 통합 감시할 아키텍처가 필요했습니다.",
      a: "<strong>행동 (Action):</strong> GNS3 환경에서 라우터 이중화(HSRP)와 Cisco ASAv 방화벽을 배치해 인터페이스별 보안 레벨(Inside 100, DMZ 50, Outside 0)과 ACL 정책을 수립했습니다. 이어 Snort/Suricata 맞춤형 탐지 룰(SYN Scan, DDoS)을 작성하고, Ubuntu 관제 서버에 OSSEC HIDS 및 Zabbix 에이전트를 연동해 무결성과 시스템 자원을 실시간 모니터링했습니다.",
      r: "<strong>결과 (Result):</strong> 비인가 트래픽 100% 차단 검증, 모의 공격 트래픽 실시간 경보 발생률 100% 달성 및 파일 변경·시스템 과부하를 즉시 식별하는 통합 관제 파이프라인을 완성했습니다.",
      specs: `[네트워크 인프라 & 침입 탐지 명세]
• Cisco ASAv 인터페이스: Inside(보안레벨 100) -> DMZ(50, HTTP 80/Telnet 23 허용) -> Deny Any Any
• HSRP 라우터 이중화: Active-Standby 절체 시간 1초 내 서비스 무중단 검증
• Snort 맞춤 룰: alert tcp any any -> $HOME_NET any (flags:S; threshold:type threshold, count 5, seconds 3;)
• 호스트 무결성(Syscheck): /etc/passwd, /etc/shadow 등 주요 시스템 파일 해시 주기적 비교 감시`,
      actions: [
        { label: "공개 범위 및 보안 점검표 확인", url: "#", primary: true, isScope: true }
      ]
    },

    scope: {
      tag: "SECURITY CHECKLIST · DISCLOSURE SCOPE",
      title: "공개 범위 및 보안 점검표 (Disclosure Scope Checklist)",
      s: "<strong>대상 및 목적:</strong> 정보보안·네트워크 인프라 직무 채용 담당자와 IT 실무진에게 보안 엔지니어 이혜원의 기술 역량을 투명하게 전달합니다.",
      a: "<strong>보안 원칙:</strong> 개인정보보호법을 준수하고 시스템 자산 침해사고를 예방하기 위해 포트폴리오 공개/비공개 범위를 명확히 분리합니다.",
      r: "<strong>결과:</strong> 민감정보 노출 없는 안전한 공개 포트폴리오를 유지합니다.",
      specs: `[공개 정보 (4개 항목)]
1. 성명 및 지원 직무: 이혜원 / 정보보안 엔지니어, 네트워크 인프라, 보안관제
2. 보유 기술 스택: ZTNA/XDR, WebAuthn/JWKS, Cisco ASAv, Snort/Suricata, Linux, Python
3. 공식 채용 소통 이메일: three78945@naver.com
4. 실무 산출물: 비식별화된 침입 탐지 룰셋, 네트워크 토폴로지 보고서, 실증 연구 논문

[비공개 정보 (3개 항목)]
1. 주민등록번호, 생년월일 등 고유식별정보 (사유: 개인정보보호법 준수 및 도용 방지)
2. 개인 휴대전화번호 및 상세 거주지 주소 (사유: 사생활 보호 및 스팸 방지)
3. 시스템 계정 비밀번호, API Secret 키 및 토큰 원문 (사유: 침해사고 예방 및 보안 윤리)`,
      actions: []
    }
  };

  const openProjectModal = (key) => {
    if (!modal) return;
    const data = projectDetailsData[key];
    if (!data) return;

    lastActiveElement = document.activeElement;
    if (modalTag) modalTag.textContent = data.tag;
    if (modalTitle) modalTitle.textContent = data.title;
    if (modalSarS) modalSarS.innerHTML = data.s;
    if (modalSarA) modalSarA.innerHTML = data.a;
    if (modalSarR) modalSarR.innerHTML = data.r;
    if (modalSpecs) modalSpecs.textContent = data.specs;

    if (modalActions) {
      modalActions.innerHTML = "";
      if (data.actions && data.actions.length > 0) {
        data.actions.forEach((act) => {
          if (act.isScope) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "btn-editorial btn-editorial-primary";
            btn.textContent = act.label;
            btn.addEventListener("click", () => openProjectModal("scope"));
            modalActions.appendChild(btn);
          } else {
            const a = document.createElement("a");
            a.href = act.url;
            a.className = act.primary ? "btn-editorial btn-editorial-primary" : "btn-editorial";
            a.textContent = act.label;
            if (act.url.startsWith("http")) {
              a.target = "_blank";
              a.rel = "noopener noreferrer";
            }
            modalActions.appendChild(a);
          }
        });
      }
    }

    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    if (modalClose) modalClose.focus();
  };

  const closeProjectModal = () => {
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';

    if (lastActiveElement && typeof lastActiveElement.focus === 'function') {
      lastActiveElement.focus();
    }
  };

  document.querySelectorAll('.compact-project-card').forEach((card) => {
    card.addEventListener('click', () => {
      const key = card.dataset.projectKey;
      openProjectModal(key);
    });

    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const key = card.dataset.projectKey;
        openProjectModal(key);
      }
    });
  });

  const btnOpenScope = document.getElementById('btn-open-scope-modal');
  if (btnOpenScope) {
    btnOpenScope.addEventListener('click', () => {
      openProjectModal('scope');
    });
  }

  if (modalClose) modalClose.addEventListener('click', closeProjectModal);
  if (modalBackdrop) modalBackdrop.addEventListener('click', closeProjectModal);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllDropdowns();
      if (modal && modal.classList.contains('open')) {
        closeProjectModal();
      }
    }
  });

  // 7. Passkey Authentication (WebAuthn)
  const btnRegister = document.getElementById('btn-register-passkey');
  const btnLogin = document.getElementById('btn-login-passkey');
  const btnLogout = document.getElementById('btn-logout');
  const authGate = document.getElementById('auth-gate');
  const privateContent = document.getElementById('private-content-area');
  const passkeyStatusMsg = document.getElementById('passkey-status-msg');

  const showPasskeyNotice = (msg) => {
    if (!passkeyStatusMsg) return;
    passkeyStatusMsg.textContent = msg;
    passkeyStatusMsg.classList.add('visible');
  };

  const coerceToArrayBuffer = (input) => {
    if (!input) return new ArrayBuffer(0);
    if (input instanceof ArrayBuffer) return input;
    if (ArrayBuffer.isView(input)) return input.buffer;
    if (typeof input === 'object' && input.type === 'Buffer' && Array.isArray(input.data)) {
      return new Uint8Array(input.data).buffer;
    }
    if (Array.isArray(input)) {
      return new Uint8Array(input).buffer;
    }
    if (typeof input === 'string') {
      let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4) base64 += '=';
      const binaryString = window.atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes.buffer;
    }
    return new ArrayBuffer(0);
  };

  const bufferToBase64URL = (buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  };

  if (btnRegister) {
    btnRegister.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/passkey-register-start', { method: 'POST' });
        if (!res.ok) throw new Error('등록 챌린지를 가져오지 못했습니다.');
        const options = await res.json();
        options.challenge = coerceToArrayBuffer(options.challenge);
        if (options.user && options.user.id) options.user.id = coerceToArrayBuffer(options.user.id);
        if (options.excludeCredentials) {
          options.excludeCredentials.forEach((cred) => {
            cred.id = coerceToArrayBuffer(cred.id);
          });
        }
        const credential = await navigator.credentials.create({ publicKey: options });
        const verifyRes = await fetch('/api/passkey-register-finish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: credential.id,
            rawId: bufferToBase64URL(credential.rawId),
            type: credential.type,
            response: {
              attestationObject: bufferToBase64URL(credential.response.attestationObject),
              clientDataJSON: bufferToBase64URL(credential.response.clientDataJSON),
            },
          }),
        });
        if (verifyRes.ok) {
          showPasskeyNotice('패스키가 성공적으로 등록되었습니다.');
        } else {
          showPasskeyNotice('패스키 등록 검증에 실패했습니다.');
        }
      } catch (error) {
        showPasskeyNotice('패스키 등록 안내: 서버리스 인증 엔드포인트 연결 환경에서 동작합니다.');
      }
    });
  }

  if (btnLogin) {
    btnLogin.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/passkey-login-start', { method: 'POST' });
        if (!res.ok) throw new Error('로그인 챌린지를 가져오지 못했습니다.');
        const options = await res.json();
        options.challenge = coerceToArrayBuffer(options.challenge);
        if (options.allowCredentials) {
          options.allowCredentials.forEach((cred) => {
            cred.id = coerceToArrayBuffer(cred.id);
          });
        }
        const credential = await navigator.credentials.get({ publicKey: options });
        const verifyRes = await fetch('/api/passkey-login-finish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: credential.id,
            rawId: bufferToBase64URL(credential.rawId),
            type: credential.type,
            response: {
              authenticatorData: bufferToBase64URL(credential.response.authenticatorData),
              clientDataJSON: bufferToBase64URL(credential.response.clientDataJSON),
              signature: bufferToBase64URL(credential.response.signature),
              userHandle: credential.response.userHandle ? bufferToBase64URL(credential.response.userHandle) : null,
            },
          }),
        });
        if (verifyRes.ok) {
          if (authGate) authGate.style.display = 'none';
          if (privateContent) privateContent.style.display = 'block';
          showPasskeyNotice('인증 성공! 나만의 공간이 열렸습니다.');
        } else {
          showPasskeyNotice('인증에 실패했습니다. 등록된 기기인지 확인해주세요.');
        }
      } catch (error) {
        showPasskeyNotice('패스키 로그인 안내: 등록된 보안 키 및 서버리스 API 연결이 필요합니다.');
      }
    });
  }

  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      if (authGate) authGate.style.display = 'flex';
      if (privateContent) privateContent.style.display = 'none';
      showPasskeyNotice('로그아웃 되었습니다. 화면이 다시 잠깁니다.');
    });
  }
});

// ============================================================================
// Master Unified Navigation & Dark/Light Theme Controller (Wonq Portfolio)
// ============================================================================
(function() {
  var THEME_KEY = 'wonq_portfolio_theme';

  function applyTheme(theme) {
    var isDark = theme === 'dark';
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.body.classList.add('dark-theme');
    } else {
      document.documentElement.removeAttribute('data-theme');
      document.body.classList.remove('dark-theme');
    }
    var toggleBtn = document.getElementById('btn-theme-toggle');
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-label', isDark ? '라이트 모드로 전환' : '다크 모드로 전환');
      toggleBtn.setAttribute('title', isDark ? '라이트 모드로 전환' : '다크 모드로 전환');
    }
  }

  function getPreferredTheme() {
    var saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }

  function initApp() {
    // 1. Theme initialization
    var current = getPreferredTheme();
    applyTheme(current);

    var toggleBtn = document.getElementById('btn-theme-toggle');
    if (toggleBtn && !toggleBtn.dataset.themeBound) {
      toggleBtn.dataset.themeBound = 'true';
      toggleBtn.addEventListener('click', function(e) {
        e.preventDefault();
        var next = (document.documentElement.getAttribute('data-theme') === 'dark' || document.body.classList.contains('dark-theme')) ? 'light' : 'dark';
        applyTheme(next);
        localStorage.setItem(THEME_KEY, next);
        window.dispatchEvent(new CustomEvent('wonqThemeChange', { detail: { theme: next } }));
      });
    }

    window.addEventListener('storage', function(e) {
      if (e.key === THEME_KEY && e.newValue) {
        applyTheme(e.newValue);
      }
    });

    window.addEventListener('wonqThemeChange', function(e) {
      if (e.detail && e.detail.theme) {
        applyTheme(e.detail.theme);
      }
    });

    // 2. Navigation Dropdowns & Scroll
    var scrollProgress = document.getElementById('scroll-progress');
    var navbar = document.getElementById('navbar');
    var overviewDropdown = document.getElementById('nav-overview-dropdown');
    var overviewBtn = document.getElementById('nav-overview-btn');
    var projectsDropdown = document.getElementById('nav-projects-dropdown');
    var projectsBtn = document.getElementById('nav-projects-btn');
    var motionBtn = document.getElementById('btn-motion-toggle') || document.getElementById('motion-toggle-btn');

    if (projectsBtn && projectsBtn.dataset.navBound === 'true') return;
    if (projectsBtn) projectsBtn.dataset.navBound = 'true';

    var updateScroll = function() {
      var scrollY = window.scrollY || window.pageYOffset;
      if (navbar) {
        navbar.classList.toggle('scrolled', scrollY > 10);
      }
      if (scrollProgress) {
        var docHeight = document.documentElement.scrollHeight - window.innerHeight;
        var pct = docHeight > 0 ? (scrollY / docHeight) * 100 : 0;
        scrollProgress.style.width = Math.min(100, Math.max(0, pct)) + '%';
      }
    };
    window.addEventListener('scroll', updateScroll, { passive: true });
    updateScroll();

    var closeAllDropdowns = function() {
      if (overviewDropdown) {
        overviewDropdown.classList.remove('open');
        if (overviewBtn) overviewBtn.setAttribute('aria-expanded', 'false');
      }
      if (projectsDropdown) {
        projectsDropdown.classList.remove('open');
        if (projectsBtn) projectsBtn.setAttribute('aria-expanded', 'false');
      }
    };

    if (overviewBtn && overviewDropdown) {
      overviewBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        var isOpen = overviewDropdown.classList.contains('open');
        closeAllDropdowns();
        if (!isOpen) {
          overviewDropdown.classList.add('open');
          overviewBtn.setAttribute('aria-expanded', 'true');
        }
      });
    }

    if (projectsBtn && projectsDropdown) {
      projectsBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        var isOpen = projectsDropdown.classList.contains('open');
        closeAllDropdowns();
        if (!isOpen) {
          projectsDropdown.classList.add('open');
          projectsBtn.setAttribute('aria-expanded', 'true');
        }
      });
    }

    document.querySelectorAll('.dropdown-item').forEach(function(item) {
      item.addEventListener('click', function() {
        closeAllDropdowns();
      });
    });

    document.addEventListener('click', function(e) {
      var inOverview = overviewDropdown && overviewDropdown.contains(e.target);
      var inProjects = projectsDropdown && projectsDropdown.contains(e.target);
      if (!inOverview && !inProjects) {
        closeAllDropdowns();
      }
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        closeAllDropdowns();
      }
    });

    if (motionBtn && !motionBtn.dataset.boundUnified) {
      motionBtn.dataset.boundUnified = 'true';
      motionBtn.addEventListener('click', function() {
        var reduced = document.body.classList.toggle('reduce-motion');
        motionBtn.setAttribute('aria-pressed', String(reduced));
        motionBtn.textContent = reduced ? '모션 줄이기: ON' : '모션 줄이기: OFF';
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
