/**
 * CYBER DEFENSE : TIC-TAC-TOE
 * Standalone Engine complying with T02-C01 ~ T02-C31
 */

document.addEventListener('DOMContentLoaded', () => {
  const timerVal = document.getElementById('timer-val');
  const statWins = document.getElementById('stat-wins');
  const statLosses = document.getElementById('stat-losses');
  const statDraws = document.getElementById('stat-draws');
  const gameStatus = document.getElementById('game-status');
  const cellButtons = document.querySelectorAll('.cell-btn');
  const btnRestart = document.getElementById('btn-restart');
  const btnPause = document.getElementById('btn-pause');
  const btnResetStorage = document.getElementById('btn-reset-storage');
  const btnSoundToggle = document.getElementById('btn-sound-toggle');
  const btnMotionToggle = document.getElementById('btn-motion-toggle');

  const STORAGE_KEY_STATS = 'cyber_defense_stats';
  const STORAGE_KEY_SETTINGS = 'cyber_defense_settings';

  const DEFAULT_STATS = { wins: 0, losses: 0, draws: 0 };
  const DEFAULT_SETTINGS = { muted: false, reducedMotion: false };

  let stats = { ...DEFAULT_STATS };
  let settings = { ...DEFAULT_SETTINGS };

  let board = Array(9).fill(null);
  let timeLeft = 30.0;
  let timerInterval = null;
  let isGameOver = false;
  let isPaused = false;
  let isAiThinking = false;

  let audioCtx = null;
  const getAudioContext = () => {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  };

  const playTone = (freq, type, duration) => {
    if (settings.muted) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {}
  };

  const playSoundEvent = (event) => {
    if (settings.muted) return;
    if (event === 'move_player') {
      playTone(520, 'sine', 0.08);
    } else if (event === 'move_ai') {
      playTone(280, 'triangle', 0.1);
    } else if (event === 'win') {
      playTone(587, 'sine', 0.12);
      setTimeout(() => playTone(880, 'sine', 0.25), 130);
    } else if (event === 'loss' || event === 'timeout') {
      playTone(220, 'sawtooth', 0.2);
      setTimeout(() => playTone(140, 'sawtooth', 0.35), 210);
    } else if (event === 'draw') {
      playTone(350, 'sine', 0.15);
    }
  };

  const loadSavedData = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_STATS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          typeof parsed === 'object' &&
          parsed !== null &&
          typeof parsed.wins === 'number' &&
          typeof parsed.losses === 'number' &&
          typeof parsed.draws === 'number'
        ) {
          stats = { wins: parsed.wins, losses: parsed.losses, draws: parsed.draws };
        } else {
          stats = { ...DEFAULT_STATS };
          localStorage.setItem(STORAGE_KEY_STATS, JSON.stringify(stats));
        }
      } else {
        stats = { ...DEFAULT_STATS };
      }
    } catch (err) {
      stats = { ...DEFAULT_STATS };
      try {
        localStorage.setItem(STORAGE_KEY_STATS, JSON.stringify(stats));
      } catch (e) {}
    }

    try {
      const rawSettings = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (rawSettings) {
        const parsedS = JSON.parse(rawSettings);
        if (parsedS && typeof parsedS.muted === 'boolean') {
          settings.muted = parsedS.muted;
        }
        if (parsedS && typeof parsedS.reducedMotion === 'boolean') {
          settings.reducedMotion = parsedS.reducedMotion;
        }
      }
    } catch (err) {
      settings = { ...DEFAULT_SETTINGS };
    }

    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      settings.reducedMotion = true;
    }

    applySettingsUI();
    renderStats();
  };

  const saveStats = () => {
    try {
      localStorage.setItem(STORAGE_KEY_STATS, JSON.stringify(stats));
    } catch (e) {}
  };

  const saveSettings = () => {
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
    } catch (e) {}
  };

  const applySettingsUI = () => {
    if (btnSoundToggle) {
      btnSoundToggle.setAttribute('aria-pressed', String(settings.muted));
      btnSoundToggle.textContent = settings.muted ? '소리: 음소거' : '소리: 켜짐';
    }
    if (btnMotionToggle) {
      btnMotionToggle.setAttribute('aria-pressed', String(settings.reducedMotion));
      btnMotionToggle.textContent = settings.reducedMotion ? '모션: 줄임' : '모션: 일반';
    }
    if (settings.reducedMotion) {
      document.body.classList.add('reduce-motion');
    } else {
      document.body.classList.remove('reduce-motion');
    }
  };

  const renderStats = () => {
    if (statWins) statWins.textContent = stats.wins;
    if (statLosses) statLosses.textContent = stats.losses;
    if (statDraws) statDraws.textContent = stats.draws;
  };

  const updateTimerDisplay = () => {
    if (timerVal) {
      timerVal.textContent = `${Math.max(0, timeLeft).toFixed(1)}s`;
    }
  };

  const startTimer = () => {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (isPaused || isGameOver) return;

      timeLeft = Math.max(0, timeLeft - 0.1);
      updateTimerDisplay();

      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        handleGameEnd({ winner: 'timeout', line: null });
      }
    }, 100);
  };

  const stopTimer = () => {
    clearInterval(timerInterval);
  };

  const WINNING_LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];

  const checkWinner = (currentBoard) => {
    for (const line of WINNING_LINES) {
      const [a, b, c] = line;
      if (currentBoard[a] && currentBoard[a] === currentBoard[b] && currentBoard[a] === currentBoard[c]) {
        return { winner: currentBoard[a], line };
      }
    }
    if (currentBoard.every(cell => cell !== null)) {
      return { winner: 'draw', line: null };
    }
    return null;
  };

  const renderBoard = () => {
    cellButtons.forEach((btn, idx) => {
      const val = board[idx];
      btn.textContent = val || '';
      btn.classList.remove('cell-o', 'cell-x', 'winning-cell');
      if (val === 'O') btn.classList.add('cell-o');
      if (val === 'X') btn.classList.add('cell-x');

      btn.disabled = val !== null || isGameOver || isPaused || isAiThinking;
    });
  };

  const handleGameEnd = (result) => {
    isGameOver = true;
    stopTimer();
    renderBoard();

    if (result.winner === 'O') {
      stats.wins++;
      playSoundEvent('win');
      if (gameStatus) {
        gameStatus.className = 'status-banner win';
        gameStatus.textContent = '[DEFENSE SUCCESS] 방어 성공! 침입자의 공격 라인을 완전히 차단했습니다.';
      }
      if (result.line) {
        result.line.forEach(i => cellButtons[i].classList.add('winning-cell'));
      }
    } else if (result.winner === 'X') {
      stats.losses++;
      playSoundEvent('loss');
      if (gameStatus) {
        gameStatus.className = 'status-banner loss';
        gameStatus.textContent = '[BREACH DETECTED] 침해 발생! AI 침입자에게 방화벽 노드가 점령당했습니다.';
      }
      if (result.line) {
        result.line.forEach(i => cellButtons[i].classList.add('winning-cell'));
      }
    } else if (result.winner === 'timeout') {
      stats.losses++;
      playSoundEvent('timeout');
      if (gameStatus) {
        gameStatus.className = 'status-banner loss';
        gameStatus.textContent = '⏱️ 시간 초과 실패! 30초 내에 방어선을 완성하지 못했습니다.';
      }
    } else {
      stats.draws++;
      playSoundEvent('draw');
      if (gameStatus) {
        gameStatus.className = 'status-banner';
        gameStatus.textContent = '[DRAW] 무승부! 시스템 방어 상태가 팽팽하게 유지되었습니다.';
      }
    }

    saveStats();
    renderStats();
  };

  const resetGame = () => {
    stopTimer();
    board = Array(9).fill(null);
    timeLeft = 30.0;
    isGameOver = false;
    isPaused = false;
    isAiThinking = false;

    if (btnPause) {
      btnPause.textContent = '일시정지 (P)';
    }

    if (gameStatus) {
      gameStatus.className = 'status-banner';
      gameStatus.textContent = '당신의 턴입니다 (방어 노드 O). 비어 있는 방어 노드를 선택하세요.';
    }

    updateTimerDisplay();
    renderBoard();
    startTimer();
  };

  const makeAiMove = () => {
    if (isGameOver || isPaused) return;

    isAiThinking = true;
    if (gameStatus) {
      gameStatus.className = 'status-banner';
      gameStatus.textContent = 'AI 침입자가 취약점 경로를 분석 중입니다... (침입자 X)';
    }
    renderBoard();

    setTimeout(() => {
      if (isGameOver || isPaused) {
        isAiThinking = false;
        return;
      }

      // 1. Check AI Win in 1 move
      for (let i = 0; i < 9; i++) {
        if (!board[i]) {
          board[i] = 'X';
          if (checkWinner(board)?.winner === 'X') {
            isAiThinking = false;
            playSoundEvent('move_ai');
            handleGameEnd(checkWinner(board));
            return;
          }
          board[i] = null;
        }
      }

      // 2. Check Player Win Block in 1 move
      for (let i = 0; i < 9; i++) {
        if (!board[i]) {
          board[i] = 'O';
          if (checkWinner(board)?.winner === 'O') {
            board[i] = 'X';
            isAiThinking = false;
            playSoundEvent('move_ai');
            const res = checkWinner(board);
            if (res) {
              handleGameEnd(res);
            } else {
              if (gameStatus) {
                gameStatus.className = 'status-banner';
                gameStatus.textContent = '당신의 턴입니다 (방어 노드 O). 비어 있는 방어 노드를 선택하세요.';
              }
              renderBoard();
            }
            return;
          }
          board[i] = null;
        }
      }

      // 3. Center or Random selection
      let chosenMove = null;
      if (!board[4] && Math.random() < 0.6) {
        chosenMove = 4;
      } else {
        const emptyIndices = [];
        board.forEach((val, idx) => {
          if (!val) emptyIndices.push(idx);
        });
        if (emptyIndices.length > 0) {
          chosenMove = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
        }
      }

      if (chosenMove !== null) {
        board[chosenMove] = 'X';
        playSoundEvent('move_ai');
      }

      isAiThinking = false;
      const finalResult = checkWinner(board);
      if (finalResult) {
        handleGameEnd(finalResult);
      } else {
        if (gameStatus) {
          gameStatus.className = 'status-banner';
          gameStatus.textContent = '당신의 턴입니다 (방어 노드 O). 비어 있는 방어 노드를 선택하세요.';
        }
        renderBoard();
      }
    }, 400);
  };

  const handleCellClick = (idx) => {
    if (board[idx] !== null || isGameOver || isPaused || isAiThinking) {
      return;
    }

    board[idx] = 'O';
    playSoundEvent('move_player');
    renderBoard();

    const result = checkWinner(board);
    if (result) {
      handleGameEnd(result);
    } else {
      makeAiMove();
    }
  };

  cellButtons.forEach((btn, idx) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      handleCellClick(idx);
    });
  });

  const togglePause = () => {
    if (isGameOver) return;

    isPaused = !isPaused;
    if (isPaused) {
      stopTimer();
      if (btnPause) btnPause.textContent = '계속하기 (P)';
      if (gameStatus) {
        gameStatus.className = 'status-banner paused';
        gameStatus.textContent = '⏸️ 일시정지 상태입니다. 재개하려면 [계속하기]를 누르세요.';
      }
      renderBoard();
    } else {
      startTimer();
      if (btnPause) btnPause.textContent = '일시정지 (P)';
      if (gameStatus) {
        gameStatus.className = 'status-banner';
        gameStatus.textContent = isAiThinking
          ? 'AI 침입자가 취약점 경로를 분석 중입니다... (침입자 X)'
          : '당신의 턴입니다 (방어 노드 O). 비어 있는 방어 노드를 선택하세요.';
      }
      renderBoard();
      if (isAiThinking) {
        makeAiMove();
      }
    }
  };

  if (btnRestart) btnRestart.addEventListener('click', resetGame);
  if (btnPause) btnPause.addEventListener('click', togglePause);

  if (btnResetStorage) {
    btnResetStorage.addEventListener('click', () => {
      stats = { ...DEFAULT_STATS };
      saveStats();
      renderStats();
      resetGame();
    });
  }

  if (btnSoundToggle) {
    btnSoundToggle.addEventListener('click', () => {
      settings.muted = !settings.muted;
      saveSettings();
      applySettingsUI();
    });
  }

  if (btnMotionToggle) {
    btnMotionToggle.addEventListener('click', () => {
      settings.reducedMotion = !settings.reducedMotion;
      saveSettings();
      applySettingsUI();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.key === 'p' || e.key === 'P' || e.key === 'ㅔ') {
      e.preventDefault();
      togglePause();
    } else if (e.key === 'r' || e.key === 'R' || e.key === 'ㄱ') {
      e.preventDefault();
      resetGame();
    }
  });

  window.addEventListener('blur', () => {
    if (!isGameOver && !isPaused) {
      togglePause();
    }
  });

  window.addEventListener('resize', () => {
    renderBoard();
    updateTimerDisplay();
  });

  loadSavedData();
  resetGame();
});









// ============================================================================
// Unified Portfolio Navigation (Overview & Projects Dropdowns + Scroll Progress + Motion Toggle)
// ============================================================================
(function() {
  document.addEventListener('DOMContentLoaded', function() {
    var scrollProgress = document.getElementById('scroll-progress');
    var navbar = document.getElementById('navbar');
    var overviewDropdown = document.getElementById('nav-overview-dropdown');
    var overviewBtn = document.getElementById('nav-overview-btn');
    var projectsDropdown = document.getElementById('nav-projects-dropdown');
    var projectsBtn = document.getElementById('nav-projects-btn');
    var motionBtn = document.getElementById('btn-motion-toggle') || document.getElementById('motion-toggle-btn');

    // 1. Scroll progress bar
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

    // 2. Dual Dropdowns (Overview & Projects)
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

    // 3. Motion Toggle (if not already bound by page script)
    if (motionBtn && !motionBtn.dataset.boundUnified) {
      motionBtn.dataset.boundUnified = 'true';
      motionBtn.addEventListener('click', function() {
        var reduced = document.body.classList.toggle('reduce-motion');
        motionBtn.setAttribute('aria-pressed', String(reduced));
        motionBtn.textContent = reduced ? '모션 줄이기: ON' : '모션 줄이기: OFF';
      });
    }
  });
})();
