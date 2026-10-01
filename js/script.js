/**
 * Portfolio Interactive Scripts
 * Pure Vanilla JavaScript (No Framework Dependency)
 * Full Keyboard & Mouse Accessibility & Zero Console Errors
 */

document.addEventListener('DOMContentLoaded', () => {
  const navbar = document.getElementById('navbar');
  const scrollProgress = document.getElementById('scroll-progress');
  const navLinks = document.querySelectorAll('.nav-link');
  const logoBtn = document.getElementById('logo-btn');
  const motionToggleBtn = document.getElementById('motion-toggle-btn');
  const sections = ['hero', 'about', 'skills', 'work', 'contact']
    .map(id => document.getElementById(id))
    .filter(Boolean);

  const modal = document.getElementById('image-modal');
  const modalTitle = document.getElementById('modal-title');
  const modalDesc = document.getElementById('modal-desc');
  const modalCode = document.getElementById('modal-code');
  const modalClose = document.getElementById('modal-close');
  const modalBackdrop = document.getElementById('modal-backdrop');
  let lastActiveElement = null;

  // 1. Scroll Progress & Navbar Style on Scroll
  const handleScroll = () => {
    const scrollY = window.scrollY;
    if (navbar) {
      if (scrollY > 48) {
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

  // 2. Active Section Spy
  if ('IntersectionObserver' in window && sections.length > 0) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const currentId = entry.target.id;
          navLinks.forEach(link => {
            if (link.dataset.section === currentId || link.getAttribute('href') === `#${currentId}`) {
              link.classList.add('active');
            } else {
              link.classList.remove('active');
            }
          });
        }
      });
    }, { root: null, rootMargin: '-30% 0px -50% 0px', threshold: 0 });

    sections.forEach(section => observer.observe(section));
  }

  // 3. Smooth Scroll Navigation
  if (logoBtn) {
    logoBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href').slice(1);
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        e.preventDefault();
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

  // 5. Project Accordion Expand/Collapse (Mouse & Keyboard Enter/Space)
  const projectItems = document.querySelectorAll('.project-item');
  projectItems.forEach(item => {
    const toggleBtn = item.querySelector('.project-toggle-btn');
    const toggleText = item.querySelector('.toggle-text');
    const arrow = item.querySelector('.project-toggle-btn .arrow-icon');

    const toggleProject = (e) => {
      if (e.target.closest('.evidence-modal-trigger')) return;

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

  // 6. Evidence Lightbox Modal Interaction
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
      code: "[대상 및 목적]\n- 대상: 정보보안 직무 채용 담당자 및 IT 실무진\n- 목적: 정보보안 전문가를 꿈꾸는 이혜원의 보안 분석 역량과 실무 문제 해결 경험 전달\n\n[공개 정보 (4개)]\n1. 이름 및 전문 지향점: 이혜원 / 주니어 정보보안 전문가\n2. 보유 기술 스택: Snort/Suricata, GNS3/ASAv, AI 보안관제, Linux, Python\n3. 공식 채용 소통 이메일: wonq1029@gmail.com\n4. 실무 산출물: 비식별화된 S-A-R 침입 탐지 룰셋 및 네트워크 아키텍처 보고서\n\n[비공개 정보 (3개)]\n1. 주민등록번호, 생년월일 등 고유식별정보 (사유: 개인정보보호법 준수 및 도용 방지)\n2. 개인 휴대전화번호 및 상세 거주지 주소 (사유: 사생활 보호 및 스팸 방지)\n3. 시스템 계정 비밀번호, API Secret 토큰 원문 (사유: 침해사고 예방 및 보안 윤리)"
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

  document.querySelectorAll('.open-evidence-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const key = btn.dataset.evidence;
      openModal(key);
    });
  });

  if (modalClose) modalClose.addEventListener('click', closeModal);
  if (modalBackdrop) modalBackdrop.addEventListener('click', closeModal);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && modal.classList.contains('open')) {
      closeModal();
    }
  });

  // 7. Easter Egg: Cyber Defense Tic-Tac-Toe Minigame
  const gameTriggerBtn = document.getElementById('game-trigger-btn');
  const gameModal = document.getElementById('game-modal');
  const gameCloseBtn = document.getElementById('game-close-btn');
  const gameBackdrop = document.getElementById('game-backdrop');
  const gameCells = document.querySelectorAll('.game-cell');
  const gameStatus = document.getElementById('game-status');
  const gameResetBtn = document.getElementById('game-reset-btn');
  const scoreWinsEl = document.getElementById('score-wins');
  const scoreDrawsEl = document.getElementById('score-draws');
  const scoreLossesEl = document.getElementById('score-losses');

  let boardState = Array(9).fill(null);
  let isGameOver = false;
  let isAiThinking = false;
  let scores = { wins: 0, draws: 0, losses: 0 };

  const winningLines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];

  const checkWinner = (state) => {
    for (let line of winningLines) {
      const [a, b, c] = line;
      if (state[a] && state[a] === state[b] && state[a] === state[c]) {
        return { winner: state[a], line };
      }
    }
    if (state.every(cell => cell !== null)) {
      return { winner: 'draw', line: null };
    }
    return null;
  };

  const updateScores = () => {
    if (scoreWinsEl) scoreWinsEl.textContent = scores.wins;
    if (scoreDrawsEl) scoreDrawsEl.textContent = scores.draws;
    if (scoreLossesEl) scoreLossesEl.textContent = scores.losses;
  };

  const renderBoard = () => {
    gameCells.forEach((cell, idx) => {
      const val = boardState[idx];
      cell.textContent = val || '';
      cell.classList.remove('cell-o', 'cell-x', 'winning-cell');
      if (val === 'O') cell.classList.add('cell-o');
      if (val === 'X') cell.classList.add('cell-x');
      cell.disabled = val !== null || isGameOver || isAiThinking;
    });
  };

  const resetGame = () => {
    boardState = Array(9).fill(null);
    isGameOver = false;
    isAiThinking = false;
    if (gameStatus) {
      gameStatus.textContent = '당신의 턴입니다 (🛡️ O). 노드를 선택하세요.';
      gameStatus.style.color = 'var(--color-text-main)';
    }
    renderBoard();
  };

  const handleGameEnd = (result) => {
    isGameOver = true;
    renderBoard();

    if (result.winner === 'O') {
      scores.wins++;
      if (gameStatus) {
        gameStatus.textContent = '방어 성공! 공격 라인을 완벽히 차단했습니다.';
        gameStatus.style.color = '#15803d';
      }
      if (result.line) {
        result.line.forEach(i => gameCells[i].classList.add('winning-cell'));
      }
    } else if (result.winner === 'X') {
      scores.losses++;
      if (gameStatus) {
        gameStatus.textContent = '침해 발생! AI 침입자가 방어선을 돌파했습니다.';
        gameStatus.style.color = 'var(--color-accent-red)';
      }
      if (result.line) {
        result.line.forEach(i => gameCells[i].classList.add('winning-cell'));
      }
    } else {
      scores.draws++;
      if (gameStatus) {
        gameStatus.textContent = '방어전 무승부! 시스템 상태가 유지되었습니다.';
        gameStatus.style.color = 'var(--color-text-secondary)';
      }
    }
    updateScores();
  };

  const makeAiMove = () => {
    if (isGameOver) return;
    isAiThinking = true;
    if (gameStatus) {
      gameStatus.textContent = 'AI 침입자가 취약점 경로를 스캔 중입니다... (⚔️ X)';
      gameStatus.style.color = 'var(--color-text-subtle)';
    }
    renderBoard();

    setTimeout(() => {
      // 1. AI winning move
      for (let i = 0; i < 9; i++) {
        if (!boardState[i]) {
          boardState[i] = 'X';
          if (checkWinner(boardState)?.winner === 'X') {
            isAiThinking = false;
            handleGameEnd({ winner: 'X', line: checkWinner(boardState).line });
            return;
          }
          boardState[i] = null;
        }
      }

      // 2. Block Player move
      for (let i = 0; i < 9; i++) {
        if (!boardState[i]) {
          boardState[i] = 'O';
          if (checkWinner(boardState)?.winner === 'O') {
            boardState[i] = 'X';
            isAiThinking = false;
            const res = checkWinner(boardState);
            if (res) {
              handleGameEnd(res);
            } else {
              if (gameStatus) {
                gameStatus.textContent = '당신의 턴입니다 (🛡️ O). 노드를 선택하세요.';
                gameStatus.style.color = 'var(--color-text-main)';
              }
              renderBoard();
            }
            return;
          }
          boardState[i] = null;
        }
      }

      // 3. Center or Random move
      let bestMove = null;
      if (!boardState[4] && Math.random() < 0.7) {
        bestMove = 4;
      } else {
        const available = [];
        boardState.forEach((val, idx) => {
          if (!val) available.push(idx);
        });
        if (available.length > 0) {
          bestMove = available[Math.floor(Math.random() * available.length)];
        }
      }

      if (bestMove !== null) {
        boardState[bestMove] = 'X';
      }

      isAiThinking = false;
      const finalCheck = checkWinner(boardState);
      if (finalCheck) {
        handleGameEnd(finalCheck);
      } else {
        if (gameStatus) {
          gameStatus.textContent = '당신의 턴입니다 (🛡️ O). 노드를 선택하세요.';
          gameStatus.style.color = 'var(--color-text-main)';
        }
        renderBoard();
      }
    }, 450);
  };

  const handleCellClick = (idx) => {
    if (boardState[idx] || isGameOver || isAiThinking) return;

    boardState[idx] = 'O';
    renderBoard();

    const result = checkWinner(boardState);
    if (result) {
      handleGameEnd(result);
    } else {
      makeAiMove();
    }
  };

  gameCells.forEach((cell, idx) => {
    cell.addEventListener('click', () => handleCellClick(idx));
  });

  if (gameResetBtn) {
    gameResetBtn.addEventListener('click', resetGame);
  }

  const openGameModal = () => {
    if (!gameModal) return;
    lastActiveElement = document.activeElement;
    gameModal.classList.add('open');
    gameModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    resetGame();
    if (gameCloseBtn) gameCloseBtn.focus();
  };

  const closeGameModal = () => {
    if (!gameModal) return;
    gameModal.classList.remove('open');
    gameModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (lastActiveElement && typeof lastActiveElement.focus === 'function') {
      lastActiveElement.focus();
    }
  };

  if (gameTriggerBtn) gameTriggerBtn.addEventListener('click', openGameModal);
  if (gameCloseBtn) gameCloseBtn.addEventListener('click', closeGameModal);
  if (gameBackdrop) gameBackdrop.addEventListener('click', closeGameModal);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && gameModal && gameModal.classList.contains('open')) {
      closeGameModal();
    }
  });

  // ==========================================================================
  // 8. Passkey Authentication (WebAuthn) - 수정된 등록 및 로그인 로직
  // ==========================================================================
  
  const btnRegister = document.getElementById('btn-register-passkey');
  const btnLogin = document.getElementById('btn-login-passkey');
  const btnLogout = document.getElementById('btn-logout');
  const authGate = document.getElementById('auth-gate');
  const privateContent = document.getElementById('private-content-area');

  // [헬퍼 함수] Base64URL을 ArrayBuffer로 안전하게 변환 (에러 방지 강화)
  const base64URLToBuffer = (base64URL) => {
    if (!base64URL) return new ArrayBuffer(0);
    let base64 = base64URL.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
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

  // --- [카드 2] 패스키 등록 ---
  if (btnRegister) {
    btnRegister.addEventListener('click', async () => {
      try {
        // 1. 서버에 등록용 질문(Challenge) 요청
        const res = await fetch('/api/passkey-register-start', { method: 'POST' });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || '등록 질문을 가져오지 못했습니다.');
        }
        const options = await res.json();

        // 2. 서버에서 받은 challenge와 user.id를 안전한 버퍼로 변환
        options.challenge = base64URLToBuffer(options.challenge);
        if (options.user && options.user.id) {
          // 서버가 이미 배열 형태나 문자열로 보낸 경우를 모두 대응
          if (Array.isArray(options.user.id)) {
            options.user.id = new Uint8Array(options.user.id).buffer;
          } else if (typeof options.user.id === 'string') {
            options.user.id = base64URLToBuffer(options.user.id);
          }
        }

        // 3. 기기에서 패스키(열쇠 쌍) 생성 (지문/얼굴 인식 창 호출)
        const credential = await navigator.credentials.create({ publicKey: options });

        // 4. 만들어진 공개키와 서명을 서버로 전송
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
          alert('패스키가 성공적으로 등록되었습니다!');
        } else {
          const errData = await verifyRes.json();
          alert('패스키 등록 실패: ' + (errData.error || '알 수 없는 오류'));
        }
      } catch (error) {
        console.error('등록 에러:', error);
        alert('등록 에러: ' + error.message);
      }
    });
  }

  // --- [카드 3] 패스키 로그인 ---
  if (btnLogin) {
    btnLogin.addEventListener('click', async () => {
      try {
        // 1. 서버에 로그인용 질문(Challenge) 요청
        const res = await fetch('/api/passkey-login-start', { method: 'POST' });
        if (!res.ok) throw new Error('로그인 질문을 가져오지 못했습니다.');
        const options = await res.json();

        options.challenge = base64URLToBuffer(options.challenge);
        if (options.allowCredentials) {
          options.allowCredentials.forEach(cred => {
            cred.id = base64URLToBuffer(cred.id);
          });
        }

        // 2. 기기에서 개인키로 서명 (지문/얼굴 인식 창 호출)
        const credential = await navigator.credentials.get({ publicKey: options });

        // 3. 서명된 데이터를 서버로 보내 검증
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
          alert('인증 성공! 나만의 공간이 열렸습니다.');
        } else {
          alert('인증에 실패했습니다. 등록된 기기인지 확인해주세요.');
        }
      } catch (error) {
        console.error('로그인 에러:', error);
        alert('로그인을 취소했거나 오류가 발생했습니다.');
      }
    });
  }

  // --- 로그아웃 ---
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      await fetch('/api/passkey-logout', { method: 'POST' });
      if (authGate) authGate.style.display = 'flex';
      if (privateContent) privateContent.style.display = 'none';
      alert('로그아웃 되었습니다. 화면이 다시 잠깁니다.');
    });
  }
