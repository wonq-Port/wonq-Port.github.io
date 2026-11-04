/**
 * Portfolio Interactive Scripts (js/script.js)
 * Pure Vanilla JavaScript — Smooth Scroll Reveal, Metric Counter,
 * Unified Dual Dropdown, Accordion & Lightbox Modal
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

  const modal = document.getElementById('image-modal');
  const modalTitle = document.getElementById('modal-title');
  const modalDesc = document.getElementById('modal-desc');
  const modalCode = document.getElementById('modal-code');
  const modalClose = document.getElementById('modal-close');
  const modalBackdrop = document.getElementById('modal-backdrop');
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

  // 5. Smooth Scroll Reveal & Metric Count-Up Animation
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

    const duration = 900;
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

  // 6. Project Accordion Expand/Collapse
  const projectItems = document.querySelectorAll('.project-item');
  projectItems.forEach((item) => {
    const toggleBtn = item.querySelector('.project-toggle-btn');
    const toggleText = item.querySelector('.toggle-text');
    const arrow = item.querySelector('.project-toggle-btn .arrow-icon');

    const toggleProject = (e) => {
      if (e.target.closest('a') || e.target.closest('.open-evidence-btn')) return;

      const isExpanded = item.classList.contains('is-expanded');
      item.classList.toggle('is-expanded');
      item.setAttribute('aria-expanded', String(!isExpanded));

      if (toggleText) {
        toggleText.textContent = !isExpanded ? '세부 분석 과정 닫기' : '세부 분석 과정 펼치기';
      }
      if (arrow) {
        arrow.textContent = !isExpanded ? '↑' : '↓';
      }
    };

    if (toggleBtn) {
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleProject(e);
      });
    }

    item.addEventListener('click', toggleProject);
    item.addEventListener('keydown', (e) => {
      if (e.target === item && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        toggleProject(e);
      }
    });
  });

  // 7. Story Accordion Expand/Collapse
  const storyItems = document.querySelectorAll('.story-accordion-item');
  const btnToggleAllStory = document.getElementById('btn-story-toggle-all');

  const updateToggleAllBtnLabel = () => {
    if (!btnToggleAllStory) return;
    const anyCollapsed = Array.from(storyItems).some((item) => !item.classList.contains('is-expanded'));
    btnToggleAllStory.textContent = anyCollapsed ? '전체 펼치기' : '전체 접기';
  };

  storyItems.forEach((item) => {
    const toggleText = item.querySelector('.story-toggle-text');
    const arrow = item.querySelector('.story-toggle-indicator .arrow-icon');

    const toggleStory = (e) => {
      if (e.target.closest('a') || e.target.closest('button')) return;

      const isExpanded = item.classList.contains('is-expanded');
      item.classList.toggle('is-expanded');
      item.setAttribute('aria-expanded', String(!isExpanded));

      if (toggleText) {
        toggleText.textContent = !isExpanded ? '본문 닫기' : '본문 보기';
      }
      if (arrow) {
        arrow.textContent = !isExpanded ? '↑' : '↓';
      }
      updateToggleAllBtnLabel();
    };

    item.addEventListener('click', toggleStory);
    item.addEventListener('keydown', (e) => {
      if (e.target === item && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        toggleStory(e);
      }
    });
  });

  if (btnToggleAllStory) {
    btnToggleAllStory.addEventListener('click', () => {
      const anyCollapsed = Array.from(storyItems).some((item) => !item.classList.contains('is-expanded'));

      storyItems.forEach((item) => {
        const toggleText = item.querySelector('.story-toggle-text');
        const arrow = item.querySelector('.story-toggle-indicator .arrow-icon');
        if (anyCollapsed) {
          item.classList.add('is-expanded');
          item.setAttribute('aria-expanded', 'true');
          if (toggleText) toggleText.textContent = '본문 닫기';
          if (arrow) arrow.textContent = '↑';
        } else {
          item.classList.remove('is-expanded');
          item.setAttribute('aria-expanded', 'false');
          if (toggleText) toggleText.textContent = '본문 보기';
          if (arrow) arrow.textContent = '↓';
        }
      });

      updateToggleAllBtnLabel();
    });
  }

  // 8. Evidence Lightbox Modal Interaction
  const evidenceData = {
    evidence1: {
      title: "Snort & Suricata 기반 침입 탐지(IDS) 룰셋 및 탐지 검증 보고서",
      desc: "Kali Linux 발 SYN Flag Scanning 및 비정상 패킷 공격 시나리오에 대해 Snort 및 Suricata 침입 탐지 엔진의 룰셋을 작성하고 실시간 알림 로그를 검증한 실증 결과입니다.",
      code: "[Snort Rule 명세]\nalert tcp any any -> $HOME_NET any (msg:\"SYN Flag Scanning Detected\"; flags:S; threshold:type threshold, track by_src, count 5, seconds 3; sid:1000005; rev:1;)\nalert icmp any any -> $HOME_NET any (msg:\"ICMP Echo Request Detected\"; itype:8; sid:1000001; rev:1;)\n\n[검증 결과]\n- Kali 발 포트 스캔 유입 시 alert 파일 내 timestamp, src IP, dst port 정확 매칭\n- 오탐 방지: 내부 DNS/NTP 통신 포트 예외 처리 완료"
    },
    evidence2: {
      title: "GNS3 가상 토폴로지 구축 및 Cisco ASAv 방화벽 망 분리 설계서",
      desc: "GNS3 환경에서 라우터 이중화(HSRP)와 Cisco ASAv 방화벽을 배치하여 내부망(Inside), DMZ 웹 서버망, 인터넷 구간을 격리하고 인터페이스별 보안 레벨 정책을 적용한 보고서입니다.",
      code: "[Cisco ASAv 방화벽 인터페이스 보안 레벨]\ninterface GigabitEthernet0/0 -> nameif inside, security-level 100\ninterface GigabitEthernet0/1 -> nameif dmz, security-level 50\ninterface GigabitEthernet0/2 -> nameif outside, security-level 0\n\n[ACL 패킷 필터링 정책]\naccess-list DMZ_IN extended permit tcp any host 192.168.20.10 eq 80\naccess-list DMZ_IN extended permit tcp any host 192.168.20.10 eq 23\naccess-list DMZ_IN extended deny ip any any"
    },
    evidence3: {
      title: "OSSEC(HIDS) 및 Zabbix 기반 호스트 관제 체계 구축 명세서",
      desc: "Ubuntu 중앙 관제 서버에 OSSEC HIDS 서버를 구축하고 Windows 및 Rocky Linux 노드에 Agent를 연동하여 파일 무결성 및 시스템 가용성을 실시간 모니터링한 구성 문서입니다.",
      code: "[OSSEC HIDS 에이전트 연동 상태]\n- Server: Ubuntu 22.04 LTS (IP: 192.168.10.50)\n- Agent 001: Windows 10 (IP: 192.168.10.101) - Status: Active\n- Agent 002: Rocky Linux 9 (IP: 192.168.10.102) - Status: Active\n\n[Syscheck 무결성 감시]\n- 감시 대상: /etc/passwd, /etc/shadow, C:\\Windows\\System32\\drivers\\etc\\hosts\n- Zabbix 연동: CPU 점유율 85% 초과 또는 Agent Unreachable 시 즉시 대시보드 경보"
    },
    scope: {
      title: "공개 범위 및 보안 점검표 (Disclosure Scope Checklist)",
      desc: "정보보안 전문가로서 개인정보보호법 준수 및 자산 침해사고 예방을 위해 공개/비공개 범위를 명확히 규정합니다.",
      code: "[대상 및 목적]\n- 대상: 정보보안 직무 채용 담당자 및 IT 실무진\n- 목적: 보안 엔지니어 이혜원의 ZTNA·XDR 아키텍처 구현 역량과 실무 문제 해결 경험 전달\n\n[공개 정보 (4개)]\n1. 이름 및 전문 지향점: 이혜원 / AI 보안 에이전트 및 ZTNA·XDR 엔지니어\n2. 보유 기술 스택: ZTNA/XDR, WebAuthn/JWKS, Snort/Suricata, GNS3/ASAv, Linux, Python\n3. 공식 채용 소통 이메일: three78945@naver.com\n4. 실무 산출물: 비식별화된 S-A-R 침입 탐지 룰셋, 연구 논문 및 보안 웹앱\n\n[비공개 정보 (3개)]\n1. 주민등록번호, 생년월일 등 고유식별정보 (사유: 개인정보보호법 준수 및 도용 방지)\n2. 개인 휴대전화번호 및 상세 거주지 주소 (사유: 사생활 보호 및 스팸 방지)\n3. 시스템 계정 비밀번호, API Secret 토큰 원문 (사유: 침해사고 예방 및 보안 윤리)"
    }
  };

  const openModal = (key) => {
    if (!modal) return;
    const data = evidenceData[key];
    if (!data) return;

    lastActiveElement = document.activeElement;
    if (modalTitle) modalTitle.textContent = data.title;
    if (modalDesc) modalDesc.textContent = data.desc;
    if (modalCode) modalCode.textContent = data.code;

    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    if (modalClose) modalClose.focus();
  };

  const closeModal = () => {
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';

    if (lastActiveElement && typeof lastActiveElement.focus === 'function') {
      lastActiveElement.focus();
    }
  };

  document.querySelectorAll('.open-evidence-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const key = btn.dataset.evidence;
      openModal(key);
    });
  });

  if (modalClose) modalClose.addEventListener('click', closeModal);
  if (modalBackdrop) modalBackdrop.addEventListener('click', closeModal);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllDropdowns();
      if (modal && modal.classList.contains('open')) {
        closeModal();
      }
    }
  });

  // 9. Passkey Authentication (WebAuthn) with Non-Blocking Inline Status Notice
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
        if (!res.ok) {
          throw new Error('등록 챌린지를 가져오지 못했습니다.');
        }
        const options = await res.json();
        options.challenge = coerceToArrayBuffer(options.challenge);
        if (options.user && options.user.id) {
          options.user.id = coerceToArrayBuffer(options.user.id);
        }
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