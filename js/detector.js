/**
 * Lexical Phishing Detector v2 — 고도화 통합 클라이언트 스크립트 (js/detector.js)
 * [적용 내역]
 * 1. 앱 UX 인터랙션(1번): 클립보드 원클릭 붙여넣기·진단, 진단 리포트 원클릭 복사, 전역 단축키(/, 1~6, Esc), 인앱 토스트 알림, 모션 줄이기 토글
 * 2. 실무 보안 분석(2번): 정상 vs 의심 URL 1:1 A/B 정밀 비교 탭(02 A/B 비교), 로컬 검사 이력 통계 대시보드 및 검색·필터(04 기록)
 * 3. 기존 포트폴리오2/phishing-detector.html (BRB-C01~C05) 호환성 100% 유지
 */

(function () {
  'use strict';

  var DEFAULT_SETTINGS = {
    threshold: 29,
    weights: { length: 35, hyphen: 20, at: 25, equal: 8, slash: 7, dot: 5 },
    saveHistory: true
  };

  var SAMPLES = {
    safe1: 'https://www.naver.com',
    safe2: 'https://github.com/wonq-Port',
    phish1: 'https://secure-bank-login-update.example/verify',
    phish2: 'https://trusted.example@account-security-confirmation.example/verify?id=4820'
  };

  var COMPARE_PAIRS = {
    pair1: {
      a: 'https://www.naver.com/login',
      b: 'https://nid-naver-security-login.example/verify?session=9482'
    },
    pair2: {
      a: 'https://github.com/wonq-Port',
      b: 'https://github.com@account-verify-auth-update.example/signin'
    },
    pair3: {
      a: 'https://news.example.com/2026/10/how-to-analyze-data-with-ai',
      b: 'https://news-example-account-check.example/login?redirect=home'
    }
  };

  var TABS = ['scan', 'compare', 'batch', 'history', 'settings', 'research'];

  var LEVEL_COPY = {
    safe: {
      title: '안전 수준 (Low Risk)',
      description: '설정된 형태적 기준에서 두드러진 위험 신호가 적습니다.'
    },
    warning: {
      title: '주의 신호 발견 (Moderate Risk)',
      description: '피싱 URL 집단에서 자주 관측된 형태적 특징이 일부 발견되었습니다.'
    },
    danger: {
      title: '높은 위험 신호 (High Risk)',
      description: '여러 형태적 위험 신호가 함께 발견되었습니다. 접속하지 마세요.'
    }
  };

  var LEVEL_LABEL = {
    safe: '낮음',
    warning: '주의',
    danger: '높음'
  };

  var PRESETS = {
    loose: {
      threshold: 50,
      weights: { length: 35, hyphen: 20, at: 25, equal: 8, slash: 7, dot: 5 }
    },
    default: {
      threshold: 29,
      weights: { length: 35, hyphen: 20, at: 25, equal: 8, slash: 7, dot: 5 }
    },
    strict: {
      threshold: 20,
      weights: { length: 35, hyphen: 25, at: 30, equal: 8, slash: 7, dot: 5 }
    }
  };

  function cloneSettings(s) {
    return {
      threshold: Number(s.threshold),
      weights: {
        length: Number(s.weights.length),
        hyphen: Number(s.weights.hyphen),
        at: Number(s.weights.at),
        equal: Number(s.weights.equal),
        slash: Number(s.weights.slash),
        dot: Number(s.weights.dot)
      },
      saveHistory: Boolean(s.saveHistory)
    };
  }

  function safeRead(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      var parsed = JSON.parse(raw);
      return parsed !== null && parsed !== undefined ? parsed : fallback;
    } catch (e) {
      return fallback;
    }
  }

  var state = {
    tab: 'scan',
    settings: cloneSettings(safeRead('lpd.settings.v1', DEFAULT_SETTINGS)),
    history: safeRead('lpd.history.v1', []),
    input: '',
    result: null,
    compareA: COMPARE_PAIRS.pair1.a,
    compareB: COMPARE_PAIRS.pair1.b,
    compareResultA: null,
    compareResultB: null,
    error: '',
    storageNotice: '',
    batchText: '',
    batchRows: [],
    batchFilter: 'all',
    batchSort: 'score',
    removeDuplicates: true,
    historyFilter: 'all',
    historySearch: '',
    confirmClearOpen: false,
    reduceMotion: false
  };

  var toastTimer = null;

  function showToast(msg) {
    var toastEl = document.getElementById('app-toast');
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove('show');
    }, 2400);
  }

  function copyTextToClipboard(text, successMsg) {
    var fallbackCopy = function () {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast(successMsg || '클립보드에 복사되었습니다.');
      } catch (err) {
        showToast('복사에 실패했습니다. 직접 선택해 복사해 주세요.');
      }
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        showToast(successMsg || '클립보드에 복사되었습니다.');
      }).catch(fallbackCopy);
    } else {
      fallbackCopy();
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function extractFeatures(input) {
    var raw = String(input || '').trim();
    if (!raw) {
      throw new Error('검사할 URL을 입력해 주세요. (예시 샘플 버튼을 누르시면 바로 테스트할 수 있습니다)');
    }
    var hasScheme = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(raw);
    var normalized = hasScheme ? raw : 'https://' + raw;
    var parsed;
    try {
      parsed = new URL(normalized);
    } catch (e) {
      throw new Error('URL 형식을 해석할 수 없습니다. 도메인과 경로를 다시 확인해 주세요.');
    }
    if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || !parsed.hostname || parsed.hostname.indexOf('.') === -1) {
      throw new Error('유효한 도메인을 포함한 http 또는 https 형식의 웹 URL을 입력해 주세요.');
    }
    var countable = normalized.replace(/^[a-zA-Z][a-zA-Z\d+.-]*:\/\//, '');
    var countChar = function (ch) {
      return countable.split(ch).length - 1;
    };
    var userinfo = '';
    if (parsed.username || parsed.password) {
      userinfo = parsed.username + (parsed.password ? ':' + parsed.password : '') + '@';
    }
    return {
      raw: raw,
      normalized: normalized,
      hostname: parsed.hostname,
      userinfo: userinfo,
      protocol: parsed.protocol.replace(':', ''),
      pathname: parsed.pathname,
      search: parsed.search,
      countable: countable,
      length: countable.length,
      hostHyphens: (parsed.hostname.match(/-/g) || []).length,
      pathHyphens: (parsed.pathname.match(/-/g) || []).length,
      at: countChar('@'),
      equal: countChar('='),
      slashes: countChar('/'),
      dots: countChar('.')
    };
  }

  function scoreFeatures(features, settings) {
    var weights = settings.weights;
    var threshold = settings.threshold;
    var signals = [];
    var score = 0;

    if (features.length >= threshold) {
      var ratio = features.length >= 75 ? 1 : features.length >= threshold + 21 ? 0.86 : 0.57;
      score += Math.round(weights.length * ratio);
      signals.push('길이 ' + features.length + '자');
    }
    if (features.hostHyphens) {
      score += Math.round((weights.hyphen * Math.min(features.hostHyphens, 2)) / 2);
      signals.push('호스트 하이픈 ' + features.hostHyphens + '개');
    }
    if (features.at) {
      score += weights.at;
      signals.push('@ 포함');
    }
    if (features.equal) {
      score += weights.equal;
      signals.push('= 포함');
    }
    if (features.slashes >= 3) {
      score += weights.slash;
      signals.push('슬래시 ' + features.slashes + '개');
    }
    if (features.dots >= 4) {
      score += weights.dot;
      signals.push('점 ' + features.dots + '개');
    }

    score = Math.min(100, score);
    var level = score >= 60 ? 'danger' : score >= 30 ? 'warning' : 'safe';

    return {
      raw: features.raw,
      normalized: features.normalized,
      hostname: features.hostname,
      userinfo: features.userinfo,
      protocol: features.protocol,
      pathname: features.pathname,
      search: features.search,
      countable: features.countable,
      length: features.length,
      hostHyphens: features.hostHyphens,
      pathHyphens: features.pathHyphens,
      at: features.at,
      equal: features.equal,
      slashes: features.slashes,
      dots: features.dots,
      id: Date.now() + '-' + Math.random().toString(16).slice(2),
      score: score,
      level: level,
      signals: signals,
      scannedAt: new Date().toISOString(),
      pinned: Boolean(features.pinned)
    };
  }

  function analyze(input, settings) {
    return scoreFeatures(extractFeatures(input), settings);
  }

  function persistSettings() {
    try {
      localStorage.setItem('lpd.settings.v1', JSON.stringify(state.settings));
      state.storageNotice = '';
    } catch (e) {
      state.storageNotice = '브라우저 저장소를 사용할 수 없어 설정은 이번 세션에만 유지됩니다.';
    }
  }

  function persistHistory() {
    if (!state.settings.saveHistory) return;
    try {
      localStorage.setItem('lpd.history.v1', JSON.stringify(state.history.slice(0, 200)));
      state.storageNotice = '';
    } catch (e) {
      state.storageNotice = '브라우저 저장소를 사용할 수 없어 기록은 이번 세션에만 유지됩니다.';
    }
  }

  function saveResultToHistory(nextResult) {
    if (!state.settings.saveHistory) return;
    var filtered = state.history.filter(function (item) {
      return item.id !== nextResult.id;
    });
    state.history = [nextResult].concat(filtered).slice(0, 200);
    persistHistory();
  }

  function recalculateActiveResults() {
    if (state.result) {
      var rescored = scoreFeatures(state.result, state.settings);
      rescored.id = state.result.id;
      rescored.scannedAt = state.result.scannedAt;
      rescored.pinned = state.result.pinned;
      state.result = rescored;
    }
    if (state.compareResultA && state.compareResultB) {
      state.compareResultA = scoreFeatures(state.compareResultA, state.settings);
      state.compareResultB = scoreFeatures(state.compareResultB, state.settings);
    }
    if (state.batchRows.length > 0) {
      state.batchRows = state.batchRows.map(function (row) {
        if (!row.result) return row;
        var rescoredRow = scoreFeatures(row.result, state.settings);
        rescoredRow.id = row.result.id;
        rescoredRow.scannedAt = row.result.scannedAt;
        return { source: row.source, result: rescoredRow };
      });
    }
  }

  function renderNotice() {
    var errorBox = document.getElementById('error-box');
    if (!errorBox) return;
    var msg = state.error || state.storageNotice;
    if (msg) {
      errorBox.textContent = msg;
      errorBox.classList.add('active');
    } else {
      errorBox.textContent = '';
      errorBox.classList.remove('active');
    }
  }

  function renderTabs() {
    TABS.forEach(function (tabId) {
      var btn = document.getElementById('tab-btn-' + tabId);
      var panel = document.getElementById('panel-' + tabId);
      var isActive = state.tab === tabId;
      if (btn) {
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
      }
      if (panel) {
        panel.classList.toggle('hidden', !isActive);
      }
    });
  }

  function buildHighlightedUrlHtml(result) {
    var html = '<span class="scheme">' + escapeHtml(result.protocol) + '://</span>';
    if (result.userinfo) {
      var userPart = result.userinfo.slice(0, -1);
      html += '<span class="userinfo">' + escapeHtml(userPart) + '<span class="risk-char">@</span></span>';
    }
    var hostParts = result.hostname.split('-');
    html += '<strong>';
    for (var i = 0; i < hostParts.length; i++) {
      html += escapeHtml(hostParts[i]);
      if (i < hostParts.length - 1) {
        html += '<span class="risk-char">-</span>';
      }
    }
    html += '</strong>';

    var pathParts = result.pathname.split('-');
    html += '<span class="path">';
    for (var j = 0; j < pathParts.length; j++) {
      html += escapeHtml(pathParts[j]);
      if (j < pathParts.length - 1) {
        html += '<span class="neutral-char">-</span>';
      }
    }
    html += '</span>';

    if (result.search) {
      html += '<span class="query">';
      for (var k = 0; k < result.search.length; k++) {
        var ch = result.search.charAt(k);
        if (ch === '=' || ch === '@') {
          html += '<span class="risk-char">' + escapeHtml(ch) + '</span>';
        } else {
          html += escapeHtml(ch);
        }
      }
      html += '</span>';
    }
    return html;
  }

  function setStatusBadge(el, level, customText) {
    if (!el) return;
    var statusClass = level === 'danger' ? 'status-alert' : level === 'warning' ? 'status-warn' : 'status-ok';
    el.className = 'feature-status level-chip ' + level + ' ' + statusClass;
    el.textContent = customText || LEVEL_LABEL[level];
  }

  function renderScanPanel() {
    var inputEl = document.getElementById('url-input');
    if (inputEl && inputEl.value !== state.input) {
      inputEl.value = state.input;
    }

    var emptyEl = document.getElementById('scan-empty');
    var dashEl = document.getElementById('result-dashboard');
    if (!state.result) {
      if (emptyEl) emptyEl.classList.remove('hidden');
      if (dashEl) dashEl.classList.remove('active');
      return;
    }

    if (emptyEl) emptyEl.classList.add('hidden');
    if (dashEl) dashEl.classList.add('active');

    var r = state.result;
    var threshold = state.settings.threshold;

    var bannerEl = document.getElementById('score-banner');
    if (bannerEl) {
      bannerEl.className = 'score-banner ' + r.level;
    }
    var scoreNumEl = document.getElementById('score-number');
    if (scoreNumEl) {
      scoreNumEl.textContent = String(r.score).padStart(2, '0');
    }
    setStatusBadge(document.getElementById('banner-level-chip'), r.level, LEVEL_LABEL[r.level]);

    var titleEl = document.getElementById('score-title');
    var descEl = document.getElementById('score-desc');
    if (titleEl) titleEl.textContent = LEVEL_COPY[r.level].title;
    if (descEl) descEl.textContent = LEVEL_COPY[r.level].description;

    var visualEl = document.getElementById('url-visual');
    if (visualEl) {
      visualEl.innerHTML = buildHighlightedUrlHtml(r);
    }
    var legendHostEl = document.getElementById('legend-hostname');
    if (legendHostEl) {
      legendHostEl.textContent = r.hostname;
    }

    var statLenEl = document.getElementById('stat-len');
    if (statLenEl) statLenEl.textContent = String(r.length);
    var lenBenchmarkEl = document.getElementById('len-benchmark-text');
    if (lenBenchmarkEl) {
      lenBenchmarkEl.innerHTML = '• 현재 임계 기준선: <strong>' + threshold + '자</strong> (논문 기본 29자, 스킴 제외)<br />• 정상 평균: 23.59자 / 피싱 평균: 66.49자';
    }
    var lenLevel = r.length >= Math.max(50, threshold + 21) ? 'danger' : r.length >= threshold ? 'warning' : 'safe';
    var lenBadgeText = r.length >= threshold ? '주의 (' + threshold + '자 기준 이상)' : '기준치 이내 (' + threshold + '자 미만)';
    setStatusBadge(document.getElementById('badge-len'), lenLevel, lenBadgeText);

    var statHyphenEl = document.getElementById('stat-hyphen');
    if (statHyphenEl) statHyphenEl.textContent = String(r.hostHyphens);
    var pathHyphenNoteEl = document.getElementById('path-hyphen-note');
    if (pathHyphenNoteEl) {
      pathHyphenNoteEl.innerHTML = '• 논문 기준선: <strong>피싱 사이트에서 3.88배 높음</strong> (정상 0.06 vs 피싱 0.22)<br />• 경로 하이픈 <strong>' + r.pathHyphens + '개</strong>는 SEO 관행으로 점수 미반영';
    }
    var hyphenLevel = r.hostHyphens >= 2 ? 'danger' : r.hostHyphens ? 'warning' : 'safe';
    var hyphenBadgeText = r.hostHyphens ? '위험 (호스트 하이픈 ' + r.hostHyphens + '개)' : '하이픈 없음';
    setStatusBadge(document.getElementById('badge-hyphen'), hyphenLevel, hyphenBadgeText);

    var specialCount = r.at + r.equal + r.slashes + r.dots;
    var statSpecialsEl = document.getElementById('stat-specials');
    if (statSpecialsEl) statSpecialsEl.textContent = String(specialCount);
    var specialBreakdownEl = document.getElementById('special-breakdown');
    if (specialBreakdownEl) {
      specialBreakdownEl.innerHTML = '• 검출 내역: <strong>@ ' + r.at + ' · = ' + r.equal + ' · / ' + r.slashes + ' · . ' + r.dots + '</strong><br />• 골뱅이(@) 위장 및 다중 서브도메인·경로 탐지';
    }
    var specialLevel = r.at ? 'danger' : specialCount >= 7 ? 'warning' : 'safe';
    var specialBadgeText = r.at ? '위험 (@ 기호 포함)' : specialCount >= 7 ? '주의 (특수문자 과다)' : '정상 범위';
    setStatusBadge(document.getElementById('badge-specials'), specialLevel, specialBadgeText);

    var rows = [
      ['전체 길이 (url_length)', r.length + '자', '23.59자', '66.49자', r.length >= threshold ? threshold + '자 기준 이상 (피싱 58.6% 급증 구간)' : threshold + '자 기준 미만 (정상 범위)'],
      ['도메인 내 하이픈 (NumDashInHostname)', r.hostHyphens + '개', '0.06개', '0.22개', r.hostHyphens ? '호스트에서 발견 (피싱 3.88배 규칙 해당)' : '발견되지 않음 (정상 범위)'],
      ['점 (n_dots, .)', r.dots + '개', '2.05개', '2.53개', r.dots >= 4 ? '다중 서브도메인 주의' : '일반 범위'],
      ['골뱅이 (n_at, @)', r.at + '개', '0.00003개', '0.061개', r.at ? '사용자 속임수용 인증 위장 패턴 감지 (실제 호스트 확인)' : '발견되지 않음'],
      ['슬래시 (n_slash, /)', r.slashes + '개', '0.29개', '2.62개', r.slashes >= 3 ? '하위 경로 단계가 많음' : '일반 범위'],
      ['등호 (n_equal, =)', r.equal + '개', '0.03개', '0.55개', r.equal ? '쿼리 매개변수 발견' : '발견되지 않음']
    ];
    var tbodyEl = document.getElementById('evidence-tbody');
    if (tbodyEl) {
      tbodyEl.innerHTML = rows.map(function (row) {
        return '<tr>' + row.map(function (cell, idx) {
          return idx === 0 ? '<td><strong>' + escapeHtml(cell) + '</strong></td>' : '<td>' + escapeHtml(cell) + '</td>';
        }).join('') + '</tr>';
      }).join('');
    }

    var guideEl = document.getElementById('action-guide');
    if (guideEl) {
      guideEl.textContent = r.level === 'safe'
        ? '낮은 점수는 안전 보증이 아닙니다. 단축 URL이나 해킹된 정상 도메인의 짧은 경로는 탐지하지 못할 수 있으므로 로그인·결제 시 주소창의 정식 도메인과 HTTPS 인증서를 반드시 재확인하세요.'
        : '경고: 피싱 의심 형태 신호가 감지되었습니다. 링크를 직접 열지 말고, 해당 서비스의 공식 앱이나 직접 입력한 정식 주소로 이동해 요청 내용을 확인하세요.';
    }
  }

  function renderComparePanel() {
    var inputA = document.getElementById('compare-input-a');
    var inputB = document.getElementById('compare-input-b');
    if (inputA && inputA.value !== state.compareA) inputA.value = state.compareA;
    if (inputB && inputB.value !== state.compareB) inputB.value = state.compareB;

    var wrapEl = document.getElementById('compare-result-wrap');
    if (!wrapEl) return;

    if (!state.compareResultA || !state.compareResultB) {
      wrapEl.classList.add('hidden');
      return;
    }
    wrapEl.classList.remove('hidden');

    var a = state.compareResultA;
    var b = state.compareResultB;
    var scoreDiff = b.score - a.score;
    var sameHost = a.hostname.toLowerCase() === b.hostname.toLowerCase();

    var deltaEl = document.getElementById('compare-delta-badge');
    if (deltaEl) {
      var sign = scoreDiff > 0 ? '+' : '';
      deltaEl.textContent = 'Δ ' + sign + scoreDiff + '점';
      deltaEl.className = 'compare-delta-badge ' + (scoreDiff > 0 ? 'diff-worse' : scoreDiff < 0 ? 'diff-safe' : 'diff-same');
    }

    var summaryTextEl = document.getElementById('compare-summary-text');
    if (summaryTextEl) {
      var hostMsg = sameHost
        ? '두 URL의 실제 접속 호스트(' + a.hostname + ')가 동일합니다.'
        : '주의: 실제 접속 호스트가 서로 다릅니다! (' + a.hostname + ' ≠ ' + b.hostname + ')';
      summaryTextEl.textContent = hostMsg + ' · 기준(A) ' + a.score + '점(' + LEVEL_LABEL[a.level] + ') vs 비교(B) ' + b.score + '점(' + LEVEL_LABEL[b.level] + ')';
    }

    var cardsGrid = document.getElementById('compare-cards-grid');
    if (cardsGrid) {
      cardsGrid.innerHTML = [
        { label: '기준 URL (A · 공식/대조군)', item: a },
        { label: '비교 URL (B · 의심/검사군)', item: b }
      ].map(function (entry) {
        var it = entry.item;
        return '<article class="compare-card">' +
          '<div class="compare-card-head">' +
            '<div>' +
              '<span class="kicker">' + escapeHtml(entry.label) + '</span>' +
              '<div style="margin-top:4px;"><span class="level-chip ' + it.level + '">' + LEVEL_LABEL[it.level] + '</span> <strong style="font-size:13px;">호스트: ' + escapeHtml(it.hostname) + '</strong></div>' +
            '</div>' +
            '<div class="compare-card-score">' + String(it.score).padStart(2, '0') + '<small style="font-size:11px;font-weight:600;color:var(--muted);">/100</small></div>' +
          '</div>' +
          '<div class="url-map" style="margin-bottom:0.75rem;">' +
            '<div class="url-visual" style="padding:0.85rem 1rem;font-size:12.5px;">' + buildHighlightedUrlHtml(it) + '</div>' +
          '</div>' +
          '<div style="font-size:12px;color:var(--muted);">검출 신호: <strong style="color:var(--ink);">' + escapeHtml(it.signals.join(' · ') || '두드러진 위험 신호 없음') + '</strong></div>' +
        '</article>';
      }).join('');
    }

    var formatDiff = function (valA, valB, unit, neutralFlag) {
      var d = valB - valA;
      if (d === 0) return '<span class="diff-same">동일 (0' + unit + ')</span>';
      var prefix = d > 0 ? '+' : '';
      if (neutralFlag) {
        return '<span class="diff-same">' + prefix + d + unit + ' (경로 하이픈 · 점수 미반영)</span>';
      }
      return '<span class="' + (d > 0 ? 'diff-worse' : 'diff-safe') + '">' + prefix + d + unit + (d > 0 ? ' (위험 신호 증가)' : ' (위험 신호 감소)') + '</span>';
    };

    var diffRows = [
      [
        '실제 접속 호스트 (hostname)',
        escapeHtml(a.hostname),
        escapeHtml(b.hostname),
        sameHost ? '<span class="diff-safe">일치 (동일 도메인)</span>' : '<span class="diff-worse">불일치 (사칭·피싱 도메인 주의)</span>'
      ],
      [
        '종합 위험도 점수',
        a.score + '점 (' + LEVEL_LABEL[a.level] + ')',
        b.score + '점 (' + LEVEL_LABEL[b.level] + ')',
        formatDiff(a.score, b.score, '점', false)
      ],
      [
        '전체 문자열 길이 (스킴 제외)',
        a.length + '자',
        b.length + '자',
        formatDiff(a.length, b.length, '자', false)
      ],
      [
        '호스트 내부 하이픈 (핵심 지표)',
        a.hostHyphens + '개',
        b.hostHyphens + '개',
        formatDiff(a.hostHyphens, b.hostHyphens, '개', false)
      ],
      [
        '하위 경로 하이픈 (SEO 중립)',
        a.pathHyphens + '개',
        b.pathHyphens + '개',
        formatDiff(a.pathHyphens, b.pathHyphens, '개', true)
      ],
      [
        '골뱅이 (@) 인증 위장 기호',
        a.at + '개',
        b.at + '개',
        formatDiff(a.at, b.at, '개', false)
      ],
      [
        '기타 특수문자 (= / . 합계)',
        (a.equal + a.slashes + a.dots) + '개 (= ' + a.equal + ' · / ' + a.slashes + ' · . ' + a.dots + ')',
        (b.equal + b.slashes + b.dots) + '개 (= ' + b.equal + ' · / ' + b.slashes + ' · . ' + b.dots + ')',
        formatDiff(a.equal + a.slashes + a.dots, b.equal + b.slashes + b.dots, '개', false)
      ]
    ];

    var diffTbody = document.getElementById('compare-diff-tbody');
    if (diffTbody) {
      diffTbody.innerHTML = diffRows.map(function (row) {
        return '<tr>' +
          '<td><strong>' + row[0] + '</strong></td>' +
          '<td>' + row[1] + '</td>' +
          '<td>' + row[2] + '</td>' +
          '<td>' + row[3] + '</td>' +
        '</tr>';
      }).join('');
    }
  }

  function renderBatchPanel() {
    var resultsWrap = document.getElementById('batch-results-wrap');
    if (!resultsWrap) return;

    if (state.batchRows.length === 0) {
      resultsWrap.classList.add('hidden');
      return;
    }
    resultsWrap.classList.remove('hidden');

    ['all', 'danger', 'warning', 'safe'].forEach(function (filterKey) {
      var btn = document.getElementById('batch-filter-' + filterKey);
      if (btn) {
        btn.classList.toggle('active', state.batchFilter === filterKey);
      }
    });

    var filtered = state.batchRows.filter(function (row) {
      return state.batchFilter === 'all' || (row.result && row.result.level === state.batchFilter);
    });

    filtered.sort(function (a, b) {
      var aVal = state.batchSort === 'score'
        ? (a.result ? a.result.score : -1)
        : (a.result ? a.result.length : -1);
      var bVal = state.batchSort === 'score'
        ? (b.result ? b.result.score : -1)
        : (b.result ? b.result.length : -1);
      return bVal - aVal;
    });

    var tbody = document.getElementById('batch-tbody');
    if (!tbody) return;

    tbody.innerHTML = filtered.map(function (row, idx) {
      var origIdx = state.batchRows.indexOf(row);
      if (!row.result) {
        return '<tr>' +
          '<td>' + (idx + 1) + '</td>' +
          '<td class="url-cell" title="' + escapeHtml(row.source) + '">' + escapeHtml(row.source) + '</td>' +
          '<td colspan="6" class="invalid">해석 불가 · ' + escapeHtml(row.error || '') + '</td>' +
          '</tr>';
      }
      var item = row.result;
      var specials = item.at + item.equal + item.slashes + item.dots;
      var sigText = item.signals.length ? item.signals.join(' · ') : '두드러진 신호 없음';
      return '<tr class="clickable" data-batch-index="' + origIdx + '">' +
        '<td>' + (idx + 1) + '</td>' +
        '<td class="url-cell" title="' + escapeHtml(row.source) + '">' + escapeHtml(row.source) + '</td>' +
        '<td class="score-cell">' + item.score + '</td>' +
        '<td><span class="level-chip ' + item.level + '">' + LEVEL_LABEL[item.level] + '</span></td>' +
        '<td>' + item.length + '</td>' +
        '<td>' + item.hostHyphens + '</td>' +
        '<td>' + specials + '</td>' +
        '<td>' + escapeHtml(sigText) + '</td>' +
        '</tr>';
    }).join('');
  }

  function renderHistoryPanel() {
    var emptyEl = document.getElementById('history-empty');
    var contentEl = document.getElementById('history-content');
    var countEl = document.getElementById('history-count');
    var confirmBar = document.getElementById('history-confirm-bar');
    var listEl = document.getElementById('history-list');

    if (state.history.length === 0) {
      state.confirmClearOpen = false;
      if (emptyEl) emptyEl.classList.remove('hidden');
      if (contentEl) contentEl.classList.add('hidden');
      return;
    }

    if (emptyEl) emptyEl.classList.add('hidden');
    if (contentEl) contentEl.classList.remove('hidden');
    if (countEl) countEl.textContent = '총 ' + state.history.length + ' / 200건 보관 중';
    if (confirmBar) {
      confirmBar.classList.toggle('hidden', !state.confirmClearOpen);
    }

    // 2번 기능 F9: 로컬 검사 이력 통계 대시보드 계산
    var total = state.history.length;
    var sumScore = 0;
    var countDanger = 0;
    var countWarning = 0;
    var countSafe = 0;
    var signalCounts = {
      '길이 기준 초과': 0,
      '호스트 하이픈': 0,
      '@ 기호 포함': 0,
      '= 쿼리 포함': 0,
      '다중 슬래시(/)': 0,
      '다중 서브도메인(.)': 0
    };

    state.history.forEach(function (item) {
      sumScore += Number(item.score || 0);
      if (item.level === 'danger') countDanger++;
      else if (item.level === 'warning') countWarning++;
      else countSafe++;

      if (item.length >= state.settings.threshold) signalCounts['길이 기준 초과']++;
      if (item.hostHyphens > 0) signalCounts['호스트 하이픈']++;
      if (item.at > 0) signalCounts['@ 기호 포함']++;
      if (item.equal > 0) signalCounts['= 쿼리 포함']++;
      if (item.slashes >= 3) signalCounts['다중 슬래시(/)']++;
      if (item.dots >= 4) signalCounts['다중 서브도메인(.)']++;
    });

    var avgScore = (sumScore / total).toFixed(1);
    var highRiskRatio = Math.round(((countDanger + countWarning) / total) * 100);

    var topSignalName = '검출 신호 없음';
    var topSignalVal = 0;
    Object.keys(signalCounts).forEach(function (key) {
      if (signalCounts[key] > topSignalVal) {
        topSignalVal = signalCounts[key];
        topSignalName = key;
      }
    });

    var statTotalEl = document.getElementById('hist-stat-total');
    var statAvgEl = document.getElementById('hist-stat-avg');
    var statRiskRatioEl = document.getElementById('hist-stat-risk-ratio');
    var statRiskSubEl = document.getElementById('hist-stat-risk-sub');
    var statTopSigEl = document.getElementById('hist-stat-top-sig');
    var statTopSigSubEl = document.getElementById('hist-stat-top-sig-sub');

    if (statTotalEl) statTotalEl.textContent = total + '건';
    if (statAvgEl) statAvgEl.textContent = avgScore + '점';
    if (statRiskRatioEl) statRiskRatioEl.textContent = highRiskRatio + '%';
    if (statRiskSubEl) {
      statRiskSubEl.textContent = '높음 ' + countDanger + ' · 주의 ' + countWarning + ' · 낮음 ' + countSafe;
    }
    if (statTopSigEl) {
      statTopSigEl.textContent = topSignalVal > 0 ? topSignalName : '-';
    }
    if (statTopSigSubEl) {
      statTopSigSubEl.textContent = topSignalVal > 0 ? ('총 ' + topSignalVal + '회 검출 (' + Math.round((topSignalVal / total) * 100) + '%)') : '위험 신호 검출 이력 없음';
    }

    var pctDanger = ((countDanger / total) * 100).toFixed(1);
    var pctWarning = ((countWarning / total) * 100).toFixed(1);
    var pctSafe = ((countSafe / total) * 100).toFixed(1);

    var segDangerEl = document.getElementById('ratio-seg-danger');
    var segWarnEl = document.getElementById('ratio-seg-warning');
    var segSafeEl = document.getElementById('ratio-seg-safe');
    if (segDangerEl) segDangerEl.style.width = pctDanger + '%';
    if (segWarnEl) segWarnEl.style.width = pctWarning + '%';
    if (segSafeEl) segSafeEl.style.width = pctSafe + '%';

    var ratioLegendEl = document.getElementById('history-ratio-legend');
    if (ratioLegendEl) {
      ratioLegendEl.innerHTML =
        '<span><strong style="color:var(--red);">높음(Danger)</strong> ' + countDanger + '건 (' + pctDanger + '%)</span>' +
        '<span><strong style="color:#b45309;">주의(Warning)</strong> ' + countWarning + '건 (' + pctWarning + '%)</span>' +
        '<span><strong style="color:var(--safe);">낮음(Safe)</strong> ' + countSafe + '건 (' + pctSafe + '%)</span>';
    }

    // 기록 탭 필터 버튼 활성화 표시
    ['all', 'danger', 'warning', 'safe', 'pinned'].forEach(function (fKey) {
      var fBtn = document.getElementById('hist-filter-' + fKey);
      if (fBtn) fBtn.classList.toggle('active', state.historyFilter === fKey);
    });

    var searchQuery = state.historySearch.trim().toLowerCase();
    var filteredHistory = state.history.filter(function (item) {
      if (state.historyFilter === 'pinned' && !item.pinned) return false;
      if (state.historyFilter !== 'all' && state.historyFilter !== 'pinned' && item.level !== state.historyFilter) return false;
      if (searchQuery && item.raw.toLowerCase().indexOf(searchQuery) === -1 && item.hostname.toLowerCase().indexOf(searchQuery) === -1) {
        return false;
      }
      return true;
    });

    var sorted = filteredHistory.slice().sort(function (a, b) {
      return Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
    });

    if (listEl) {
      if (sorted.length === 0) {
        listEl.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--muted);font-size:12.5px;">선택한 필터 조건에 맞는 검사 기록이 없습니다.</div>';
        return;
      }
      listEl.innerHTML = sorted.map(function (item) {
        var timeStr = '';
        try {
          timeStr = new Date(item.scannedAt).toLocaleString('ko-KR');
        } catch (e) {
          timeStr = item.scannedAt;
        }
        var sigText = item.signals && item.signals.length ? item.signals.join(' · ') : '두드러진 신호 없음';
        return '<article class="history-item">' +
          '<div class="history-score">' + item.score + '</div>' +
          '<div class="history-copy">' +
            '<div>' +
              '<span class="level-chip ' + item.level + '">' + LEVEL_LABEL[item.level] + '</span>' +
              '<time>' + escapeHtml(timeStr) + '</time>' +
            '</div>' +
            '<p title="' + escapeHtml(item.raw) + '">' + escapeHtml(item.raw) + '</p>' +
            '<span>' + escapeHtml(sigText) + '</span>' +
          '</div>' +
          '<div class="history-buttons">' +
            '<button type="button" data-history-action="pin" data-id="' + escapeHtml(item.id) + '">' + (item.pinned ? 'UNPIN' : 'PIN') + '</button>' +
            '<button type="button" data-history-action="compare" data-id="' + escapeHtml(item.id) + '">비교(B)</button>' +
            '<button type="button" data-history-action="rescan" data-id="' + escapeHtml(item.id) + '">재검사</button>' +
            '<button type="button" data-history-action="delete" data-id="' + escapeHtml(item.id) + '">삭제</button>' +
          '</div>' +
        '</article>';
      }).join('');
    }
  }

  function renderSettingsPanel() {
    var s = state.settings;
    var pairs = [
      ['range-threshold', 'val-threshold', s.threshold, '자'],
      ['range-length', 'val-length', s.weights.length, ''],
      ['range-hyphen', 'val-hyphen', s.weights.hyphen, ''],
      ['range-at', 'val-at', s.weights.at, ''],
      ['range-equal', 'val-equal', s.weights.equal, ''],
      ['range-slash', 'val-slash', s.weights.slash, ''],
      ['range-dot', 'val-dot', s.weights.dot, '']
    ];
    pairs.forEach(function (pair) {
      var input = document.getElementById(pair[0]);
      var label = document.getElementById(pair[1]);
      if (input) input.value = String(pair[2]);
      if (label) {
        label.innerHTML = pair[2] + (pair[3] ? '<small>' + pair[3] + '</small>' : '');
      }
    });

    var switchBtn = document.getElementById('btn-toggle-storage');
    if (switchBtn) {
      switchBtn.classList.toggle('on', s.saveHistory);
      switchBtn.setAttribute('aria-checked', s.saveHistory ? 'true' : 'false');
      switchBtn.textContent = s.saveHistory ? 'ON' : 'OFF';
    }
  }

  function renderAll() {
    renderNotice();
    renderTabs();
    renderScanPanel();
    renderComparePanel();
    renderBatchPanel();
    renderHistoryPanel();
    renderSettingsPanel();
  }

  function navigate(nextTab) {
    if (TABS.indexOf(nextTab) === -1) nextTab = 'scan';
    state.tab = nextTab;
    try {
      window.history.replaceState(null, '', '#' + nextTab);
    } catch (e) {}
    renderAll();
    window.scrollTo({ top: 0, behavior: state.reduceMotion ? 'auto' : 'smooth' });
  }

  function runScan(value, shouldSave) {
    var target = value !== undefined ? value : state.input;
    var saveFlag = shouldSave !== undefined ? shouldSave : true;
    try {
      var next = analyze(target, state.settings);
      state.input = target;
      state.result = next;
      state.error = '';
      if (saveFlag) {
        saveResultToHistory(next);
      }
    } catch (err) {
      state.result = null;
      state.error = err instanceof Error ? err.message : 'URL을 분석하지 못했습니다.';
    }
    renderAll();
  }

  function runCompare(urlA, urlB, silentToast) {
    var rawA = urlA !== undefined ? urlA : state.compareA;
    var rawB = urlB !== undefined ? urlB : state.compareB;
    try {
      var resA = analyze(rawA, state.settings);
      var resB = analyze(rawB, state.settings);
      state.compareA = rawA;
      state.compareB = rawB;
      state.compareResultA = resA;
      state.compareResultB = resB;
      state.error = '';
      if (!silentToast) {
        showToast('기준(A) vs 비교(B) 1:1 대조 분석이 완료되었습니다.');
      }
    } catch (err) {
      state.error = err instanceof Error ? ('A/B 비교 오류: ' + err.message) : '두 URL을 비교 분석하지 못했습니다.';
    }
    renderAll();
  }

  function runBatch() {
    var textarea = document.getElementById('batch-input');
    if (textarea) {
      state.batchText = textarea.value;
    }
    var lines = state.batchText
      .split(/\r?\n/)
      .map(function (l) { return l.trim(); })
      .filter(Boolean);

    if (lines.length === 0) {
      state.error = '일괄 검사할 URL을 한 줄 이상 입력해 주세요.';
      renderAll();
      return;
    }
    if (lines.length > 500) {
      state.error = '일괄 검사는 한 번에 최대 500줄까지 가능합니다.';
      renderAll();
      return;
    }

    var sources = lines;
    if (state.removeDuplicates) {
      sources = Array.from(new Set(lines));
    }

    var rows = sources.map(function (source) {
      try {
        return { source: source, result: analyze(source, state.settings) };
      } catch (err) {
        return {
          source: source,
          error: err instanceof Error ? err.message : '해석 불가'
        };
      }
    });

    state.batchRows = rows;
    state.error = '';

    var validResults = [];
    rows.forEach(function (r) {
      if (r.result) validResults.push(r.result);
    });
    if (state.settings.saveHistory && validResults.length > 0) {
      state.history = validResults.slice().reverse().concat(state.history).slice(0, 200);
      persistHistory();
    }
    showToast('총 ' + rows.length + '건의 URL 일괄 진단이 완료되었습니다.');
    renderAll();
  }

  function exportCsv() {
    if (state.batchRows.length === 0) return;
    var protect = function (val) {
      var text = String(val);
      var safe = /^[=+\-@]/.test(text) ? "'" + text : text;
      return '"' + safe.replace(/"/g, '""') + '"';
    };
    var header = [
      'url', 'score', 'level', 'length', 'host_hyphens', 'path_hyphens',
      'at', 'equals', 'slashes', 'dots', 'signals'
    ];
    var lines = state.batchRows.map(function (row) {
      if (!row.result) {
        return [row.source, '', '해석 불가', '', '', '', '', '', '', '', row.error || ''];
      }
      var item = row.result;
      return [
        row.source,
        item.score,
        LEVEL_LABEL[item.level],
        item.length,
        item.hostHyphens,
        item.pathHyphens,
        item.at,
        item.equal,
        item.slashes,
        item.dots,
        item.signals.join(' · ')
      ];
    });

    var allRows = [header].concat(lines);
    var csvContent = '\uFEFF' + allRows.map(function (row) {
      return row.map(protect).join(',');
    }).join('\r\n');

    var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'lexical-url-scan.csv';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    showToast('CSV 리포트(lexical-url-scan.csv)를 내려받았습니다.');
  }

  // 기존 포트폴리오2/phishing-detector.html 샘플 호출 함수 100% 호환
  window.loadSample = function (key) {
    if (SAMPLES[key]) {
      state.input = SAMPLES[key];
      var inputEl = document.getElementById('url-input');
      if (inputEl) inputEl.value = state.input;
      runScan(state.input, true);
      showToast('예시 샘플을 불러와 진단을 완료했습니다.');
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    var initialHash = window.location.hash ? window.location.hash.slice(1) : '';
    if (TABS.indexOf(initialHash) !== -1) {
      state.tab = initialHash;
    }

    // 초기 A/B 비교 기본 샘플 자동 계산
    runCompare(state.compareA, state.compareB, true);

    // 모션 줄이기 토글 버튼 (포트폴리오2 공통 UX)
    var motionBtn = document.getElementById('btn-motion-toggle');
    if (motionBtn) {
      motionBtn.addEventListener('click', function () {
        state.reduceMotion = !state.reduceMotion;
        document.body.classList.toggle('reduce-motion', state.reduceMotion);
        motionBtn.setAttribute('aria-pressed', state.reduceMotion ? 'true' : 'false');
        motionBtn.textContent = '모션 줄이기: ' + (state.reduceMotion ? 'ON' : 'OFF');
        showToast(state.reduceMotion ? '화면 모션 줄이기 모드가 켜졌습니다.' : '화면 모션이 기본 상태로 복원되었습니다.');
      });
    }

    // 전역 키보드 단축키 지원 (1번 UX 기능: /, 1~6, Esc)
    document.addEventListener('keydown', function (event) {
      var activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      var isTyping = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select';

      if (event.key === 'Escape') {
        if (state.tab === 'scan') {
          state.input = '';
          state.error = '';
          var urlInputEl = document.getElementById('url-input');
          if (urlInputEl) urlInputEl.value = '';
          renderAll();
          showToast('입력창을 초기화했습니다.');
        }
        return;
      }

      if (isTyping) return;

      if (event.key === '/') {
        event.preventDefault();
        if (state.tab !== 'scan') navigate('scan');
        var targetInput = document.getElementById('url-input');
        if (targetInput) targetInput.focus();
        showToast('URL 입력창으로 포커스되었습니다.');
        return;
      }

      var num = parseInt(event.key, 10);
      if (num >= 1 && num <= TABS.length && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        navigate(TABS[num - 1]);
      }
    });

    // 탭 전환 및 좌우 방향키 접근성
    TABS.forEach(function (tabId, index) {
      var btn = document.getElementById('tab-btn-' + tabId);
      if (!btn) return;
      btn.addEventListener('click', function () {
        navigate(tabId);
      });
      btn.addEventListener('keydown', function (event) {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        var offset = event.key === 'ArrowRight' ? 1 : -1;
        var nextIndex = (index + offset + TABS.length) % TABS.length;
        var nextTabId = TABS[nextIndex];
        navigate(nextTabId);
        var nextBtn = document.getElementById('tab-btn-' + nextTabId);
        if (nextBtn) nextBtn.focus();
      });
    });

    // 단일 검사 폼 및 클립보드 원클릭 붙여넣기
    var scanForm = document.getElementById('scan-form');
    var urlInput = document.getElementById('url-input');
    if (urlInput) {
      urlInput.addEventListener('input', function (e) {
        state.input = e.target.value;
      });
    }
    if (scanForm) {
      scanForm.addEventListener('submit', function (e) {
        e.preventDefault();
        if (urlInput) state.input = urlInput.value;
        runScan(state.input, true);
      });
    }

    var btnPasteRun = document.getElementById('btn-paste-run');
    if (btnPasteRun) {
      btnPasteRun.addEventListener('click', function () {
        if (navigator.clipboard && navigator.clipboard.readText) {
          navigator.clipboard.readText().then(function (clipText) {
            var trimmed = String(clipText || '').trim();
            if (!trimmed) {
              showToast('클립보드에 복사된 텍스트가 없습니다. 직접 붙여넣어 주세요.');
              if (urlInput) urlInput.focus();
              return;
            }
            state.input = trimmed;
            if (urlInput) urlInput.value = trimmed;
            runScan(trimmed, true);
            showToast('클립보드 URL을 붙여넣어 즉시 진단을 완료했습니다.');
          }).catch(function () {
            if (urlInput) urlInput.focus();
            showToast('브라우저 권한 정책상 입력창에서 Ctrl+V(또는 붙여넣기)를 눌러주세요.');
          });
        } else {
          if (urlInput) urlInput.focus();
          showToast('입력창에서 Ctrl+V(또는 길게 눌러 붙여넣기)를 사용해 주세요.');
        }
      });
    }

    var btnClearInput = document.getElementById('btn-clear-input');
    if (btnClearInput) {
      btnClearInput.addEventListener('click', function () {
        state.input = '';
        state.result = null;
        state.error = '';
        if (urlInput) {
          urlInput.value = '';
          urlInput.focus();
        }
        renderAll();
        showToast('입력값과 결과 화면을 초기화했습니다.');
      });
    }

    // 진단 결과 리포트 원클릭 복사 & A/B 비교 연동 버튼
    var btnCopyReport = document.getElementById('btn-copy-report');
    if (btnCopyReport) {
      btnCopyReport.addEventListener('click', function () {
        if (!state.result) return;
        var r = state.result;
        var reportText = [
          '[Lexical Phishing Detector 진단 리포트]',
          '• 검사 URL: ' + r.raw,
          '• 종합 위험도: ' + r.score + ' / 100점 (' + LEVEL_LABEL[r.level] + ' - ' + LEVEL_COPY[r.level].title + ')',
          '• 실제 접속 호스트: ' + r.hostname,
          '• 주요 측정치: 전체 길이 ' + r.length + '자 | 호스트 하이픈 ' + r.hostHyphens + '개 | 경로 하이픈 ' + r.pathHyphens + '개(중립) | 특수문자(@ ' + r.at + ', = ' + r.equal + ', / ' + r.slashes + ', . ' + r.dots + ')',
          '• 검출 신호: ' + (r.signals.join(' · ') || '두드러진 위험 신호 없음')
        ].join('\n');
        copyTextToClipboard(reportText, '진단 요약 리포트가 클립보드에 복사되었습니다.');
      });
    }

    var btnSendCompare = document.getElementById('btn-send-compare');
    if (btnSendCompare) {
      btnSendCompare.addEventListener('click', function () {
        if (!state.result) return;
        state.compareB = state.result.raw;
        runCompare(state.compareA, state.compareB, true);
        navigate('compare');
        showToast('현재 URL을 02 A/B 비교 탭의 비교군(B)으로 보냈습니다.');
      });
    }

    var sampleBtns = document.querySelectorAll('[data-sample]');
    sampleBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-sample');
        if (key) window.loadSample(key);
      });
    });

    var btnGoResearch = document.getElementById('btn-go-research');
    if (btnGoResearch) {
      btnGoResearch.addEventListener('click', function () {
        navigate('research');
      });
    }

    // 02 A/B 비교 탭 이벤트 바인딩
    var compareForm = document.getElementById('compare-form');
    var compareInputA = document.getElementById('compare-input-a');
    var compareInputB = document.getElementById('compare-input-b');
    if (compareInputA) {
      compareInputA.addEventListener('input', function (e) {
        state.compareA = e.target.value;
      });
    }
    if (compareInputB) {
      compareInputB.addEventListener('input', function (e) {
        state.compareB = e.target.value;
      });
    }
    if (compareForm) {
      compareForm.addEventListener('submit', function (e) {
        e.preventDefault();
        if (compareInputA) state.compareA = compareInputA.value;
        if (compareInputB) state.compareB = compareInputB.value;
        runCompare(state.compareA, state.compareB, false);
      });
    }

    var btnCompareSwap = document.getElementById('btn-compare-swap');
    if (btnCompareSwap) {
      btnCompareSwap.addEventListener('click', function () {
        var tmp = state.compareA;
        state.compareA = state.compareB;
        state.compareB = tmp;
        runCompare(state.compareA, state.compareB, true);
        showToast('기준 URL(A)과 비교 URL(B)의 위치를 맞바꾸었습니다.');
      });
    }

    var comparePresetBtns = document.querySelectorAll('[data-compare-pair]');
    comparePresetBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-compare-pair');
        if (key && COMPARE_PAIRS[key]) {
          state.compareA = COMPARE_PAIRS[key].a;
          state.compareB = COMPARE_PAIRS[key].b;
          runCompare(state.compareA, state.compareB, false);
        }
      });
    });

    var btnCopyCompare = document.getElementById('btn-copy-compare');
    if (btnCopyCompare) {
      btnCopyCompare.addEventListener('click', function () {
        if (!state.compareResultA || !state.compareResultB) return;
        var a = state.compareResultA;
        var b = state.compareResultB;
        var diffScore = b.score - a.score;
        var text = [
          '[Lexical Phishing Detector — URL 1:1 A/B 비교 리포트]',
          '• 기준 URL (A): ' + a.raw + ' -> ' + a.score + '점 (' + LEVEL_LABEL[a.level] + ', 호스트: ' + a.hostname + ')',
          '• 비교 URL (B): ' + b.raw + ' -> ' + b.score + '점 (' + LEVEL_LABEL[b.level] + ', 호스트: ' + b.hostname + ')',
          '• 점수 차이: ' + (diffScore > 0 ? '+' : '') + diffScore + '점 | 호스트 일치 여부: ' + (a.hostname.toLowerCase() === b.hostname.toLowerCase() ? '일치' : '불일치(사칭 주의)'),
          '• 핵심 지표 대비: 길이 ' + a.length + '자 vs ' + b.length + '자 | 호스트 하이픈 ' + a.hostHyphens + '개 vs ' + b.hostHyphens + '개 | @ 기호 ' + a.at + '개 vs ' + b.at + '개'
        ].join('\n');
        copyTextToClipboard(text, 'A/B 비교 분석 리포트가 클립보드에 복사되었습니다.');
      });
    }

    // 03 일괄 검사 컨트롤
    var batchInput = document.getElementById('batch-input');
    if (batchInput) {
      batchInput.addEventListener('input', function (e) {
        state.batchText = e.target.value;
      });
    }
    var dupCheck = document.getElementById('remove-duplicates');
    if (dupCheck) {
      dupCheck.addEventListener('change', function (e) {
        state.removeDuplicates = e.target.checked;
      });
    }
    var btnBatchRun = document.getElementById('btn-batch-run');
    if (btnBatchRun) {
      btnBatchRun.addEventListener('click', runBatch);
    }
    var btnBatchSample = document.getElementById('btn-batch-sample');
    if (btnBatchSample) {
      btnBatchSample.addEventListener('click', function () {
        var sampleLines = [
          'https://www.naver.com',
          'https://github.com/wonq-Port',
          'https://news.example.com/2026/10/how-to-analyze-data-with-ai',
          'https://secure-bank-login-update.example/verify',
          'https://trusted.example@account-security-confirmation.example/verify?id=4820'
        ].join('\n');
        state.batchText = sampleLines;
        if (batchInput) batchInput.value = sampleLines;
        runBatch();
      });
    }
    ['all', 'danger', 'warning', 'safe'].forEach(function (filterKey) {
      var filterBtn = document.getElementById('batch-filter-' + filterKey);
      if (filterBtn) {
        filterBtn.addEventListener('click', function () {
          state.batchFilter = filterKey;
          renderBatchPanel();
        });
      }
    });
    var sortScoreBtn = document.getElementById('batch-sort-score');
    if (sortScoreBtn) {
      sortScoreBtn.addEventListener('click', function () {
        state.batchSort = 'score';
        renderBatchPanel();
      });
    }
    var sortLenBtn = document.getElementById('batch-sort-length');
    if (sortLenBtn) {
      sortLenBtn.addEventListener('click', function () {
        state.batchSort = 'length';
        renderBatchPanel();
      });
    }
    var exportCsvBtn = document.getElementById('btn-export-csv');
    if (exportCsvBtn) {
      exportCsvBtn.addEventListener('click', exportCsv);
    }
    var batchTbody = document.getElementById('batch-tbody');
    if (batchTbody) {
      batchTbody.addEventListener('click', function (e) {
        var tr = e.target.closest('tr[data-batch-index]');
        if (!tr) return;
        var idx = Number(tr.getAttribute('data-batch-index'));
        var row = state.batchRows[idx];
        if (!row || !row.result) return;
        state.input = row.source;
        state.result = row.result;
        state.error = '';
        navigate('scan');
      });
    }

    // 04 기록 탭 컨트롤 및 통계 필터
    ['all', 'danger', 'warning', 'safe', 'pinned'].forEach(function (fKey) {
      var fBtn = document.getElementById('hist-filter-' + fKey);
      if (fBtn) {
        fBtn.addEventListener('click', function () {
          state.historyFilter = fKey;
          renderHistoryPanel();
        });
      }
    });
    var histSearchInput = document.getElementById('history-search');
    if (histSearchInput) {
      histSearchInput.addEventListener('input', function (e) {
        state.historySearch = e.target.value;
        renderHistoryPanel();
      });
    }

    var btnClearHistory = document.getElementById('btn-clear-history');
    if (btnClearHistory) {
      btnClearHistory.addEventListener('click', function () {
        state.confirmClearOpen = true;
        renderHistoryPanel();
      });
    }
    var btnConfirmClearYes = document.getElementById('btn-confirm-clear-yes');
    if (btnConfirmClearYes) {
      btnConfirmClearYes.addEventListener('click', function () {
        state.history = [];
        state.confirmClearOpen = false;
        persistHistory();
        renderHistoryPanel();
        showToast('저장된 모든 검사 기록을 삭제했습니다.');
      });
    }
    var btnConfirmClearNo = document.getElementById('btn-confirm-clear-no');
    if (btnConfirmClearNo) {
      btnConfirmClearNo.addEventListener('click', function () {
        state.confirmClearOpen = false;
        renderHistoryPanel();
      });
    }
    var historyList = document.getElementById('history-list');
    if (historyList) {
      historyList.addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-history-action]');
        if (!btn) return;
        var action = btn.getAttribute('data-history-action');
        var id = btn.getAttribute('data-id');
        if (!id) return;

        if (action === 'pin') {
          state.history = state.history.map(function (entry) {
            return entry.id === id ? Object.assign({}, entry, { pinned: !entry.pinned }) : entry;
          });
          persistHistory();
          renderHistoryPanel();
          showToast('기록 상단 고정(PIN) 상태를 변경했습니다.');
        } else if (action === 'compare') {
          var compItem = state.history.find(function (entry) { return entry.id === id; });
          if (compItem) {
            state.compareB = compItem.raw;
            runCompare(state.compareA, state.compareB, true);
            navigate('compare');
            showToast('선택한 기록을 A/B 비교 탭의 비교군(B)으로 불러왔습니다.');
          }
        } else if (action === 'rescan') {
          var targetItem = state.history.find(function (entry) { return entry.id === id; });
          if (targetItem) {
            state.input = targetItem.raw;
            runScan(targetItem.raw, false);
            navigate('scan');
          }
        } else if (action === 'delete') {
          state.history = state.history.filter(function (entry) { return entry.id !== id; });
          persistHistory();
          renderHistoryPanel();
          showToast('검사 기록 1건을 삭제했습니다.');
        }
      });
    }

    // 05 민감도 설정 컨트롤
    var presetBtns = document.querySelectorAll('[data-preset]');
    presetBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-preset');
        if (key && PRESETS[key]) {
          state.settings.threshold = PRESETS[key].threshold;
          state.settings.weights = Object.assign({}, PRESETS[key].weights);
          persistSettings();
          recalculateActiveResults();
          renderAll();
          showToast('민감도 프리셋이 적용되어 현재 결과가 재계산되었습니다.');
        }
      });
    });
    var btnResetSettings = document.getElementById('btn-reset-settings');
    if (btnResetSettings) {
      btnResetSettings.addEventListener('click', function () {
        state.settings = cloneSettings(DEFAULT_SETTINGS);
        persistSettings();
        recalculateActiveResults();
        renderAll();
        showToast('민감도 설정을 논문 기본값(29자 기준)으로 복원했습니다.');
      });
    }

    var bindRange = function (id, onUpdate) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', function (e) {
        onUpdate(Number(e.target.value));
        persistSettings();
        recalculateActiveResults();
        renderAll();
      });
    };

    bindRange('range-threshold', function (val) { state.settings.threshold = val; });
    bindRange('range-length', function (val) { state.settings.weights.length = val; });
    bindRange('range-hyphen', function (val) { state.settings.weights.hyphen = val; });
    bindRange('range-at', function (val) { state.settings.weights.at = val; });
    bindRange('range-equal', function (val) { state.settings.weights.equal = val; });
    bindRange('range-slash', function (val) { state.settings.weights.slash = val; });
    bindRange('range-dot', function (val) { state.settings.weights.dot = val; });

    var btnToggleStorage = document.getElementById('btn-toggle-storage');
    if (btnToggleStorage) {
      btnToggleStorage.addEventListener('click', function () {
        state.settings.saveHistory = !state.settings.saveHistory;
        persistSettings();
        renderAll();
        showToast(state.settings.saveHistory ? '로컬 검사 기록 저장이 켜졌습니다.' : '로컬 검사 기록 저장이 일시 중지되었습니다.');
      });
    }

    renderAll();
  });
})();
