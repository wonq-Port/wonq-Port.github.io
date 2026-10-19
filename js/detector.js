/**
 * Lexical Phishing Detector — 통합 클라이언트 스크립트 (js/detector.js)
 * - 기존 포트폴리오2/phishing-detector.html (BRB-C01~C05 과제 요건 및 DOM ID) 100% 호환
 * - 13번 과제 확장 웹앱 5대 탭(단일 검사·URL 분해 시각화·일괄 검사·기록·설정·연구 근거) 통합
 * - 외부 프레임워크 및 외부 네트워크 통신 없음 (Pure Vanilla JS)
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

  var TABS = ['scan', 'batch', 'history', 'settings', 'research'];

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
    error: '',
    storageNotice: '',
    batchText: '',
    batchRows: [],
    batchFilter: 'all',
    batchSort: 'score',
    removeDuplicates: true,
    confirmClearOpen: false
  };

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

    // Feature Card 1: Length
    var statLenEl = document.getElementById('stat-len');
    if (statLenEl) statLenEl.textContent = String(r.length);
    var lenBenchmarkEl = document.getElementById('len-benchmark-text');
    if (lenBenchmarkEl) {
      lenBenchmarkEl.innerHTML = '• 현재 임계 기준선: <strong>' + threshold + '자</strong> (논문 기본 29자, 스킴 제외)<br />• 정상 평균: 23.59자 / 피싱 평균: 66.49자';
    }
    var lenLevel = r.length >= Math.max(50, threshold + 21) ? 'danger' : r.length >= threshold ? 'warning' : 'safe';
    var lenBadgeText = r.length >= threshold ? '주의 (' + threshold + '자 기준 이상)' : '기준치 이내 (' + threshold + '자 미만)';
    setStatusBadge(document.getElementById('badge-len'), lenLevel, lenBadgeText);

    // Feature Card 2: Host Hyphens
    var statHyphenEl = document.getElementById('stat-hyphen');
    if (statHyphenEl) statHyphenEl.textContent = String(r.hostHyphens);
    var pathHyphenNoteEl = document.getElementById('path-hyphen-note');
    if (pathHyphenNoteEl) {
      pathHyphenNoteEl.innerHTML = '• 논문 기준선: <strong>피싱 사이트에서 3.88배 높음</strong> (정상 0.06 vs 피싱 0.22)<br />• 경로 하이픈 <strong>' + r.pathHyphens + '개</strong>는 SEO 관행으로 점수 미반영';
    }
    var hyphenLevel = r.hostHyphens >= 2 ? 'danger' : r.hostHyphens ? 'warning' : 'safe';
    var hyphenBadgeText = r.hostHyphens ? '위험 (호스트 하이픈 ' + r.hostHyphens + '개)' : '하이픈 없음';
    setStatusBadge(document.getElementById('badge-hyphen'), hyphenLevel, hyphenBadgeText);

    // Feature Card 3: Special Chars
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

    // Evidence Comparison Table (6 rows)
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
    if (countEl) countEl.textContent = state.history.length + ' / 200건';
    if (confirmBar) {
      confirmBar.classList.toggle('hidden', !state.confirmClearOpen);
    }

    var sorted = state.history.slice().sort(function (a, b) {
      return Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
    });

    if (listEl) {
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
  }

  // 기존 포트폴리오2/phishing-detector.html 샘플 호출 함수 100% 호환
  window.loadSample = function (key) {
    if (SAMPLES[key]) {
      state.input = SAMPLES[key];
      var inputEl = document.getElementById('url-input');
      if (inputEl) inputEl.value = state.input;
      runScan(state.input, true);
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    var initialHash = window.location.hash ? window.location.hash.slice(1) : '';
    if (TABS.indexOf(initialHash) !== -1) {
      state.tab = initialHash;
    }

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

    // 단일 검사 폼 및 버튼 이벤트
    var scanForm = document.getElementById('scan-form');
    var urlInput = document.getElementById('url-input');
    var btnRun = document.getElementById('btn-run');
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
    if (btnRun && !scanForm) {
      btnRun.addEventListener('click', function () {
        if (urlInput) state.input = urlInput.value;
        runScan(state.input, true);
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

    // 일괄 검사 컨트롤
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

    // 기록 탭 컨트롤
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
        }
      });
    }

    // 민감도 설정 컨트롤
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
      });
    }

    renderAll();
  });
})();
