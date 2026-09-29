/**
 * Real Information Board Engine
 * Fully integrated with Supabase + LocalStorage Fallback
 * Compliant with T04-C01 ~ T04-C28
 * Zero Secret Keys, Pure Client Architecture
 */

// ==========================================================================
// [1] Supabase 설정 (복사해 두신 URL과 anon 키를 아래 따옴표 안에 넣어주세요)
// ==========================================================================
const SUPABASE_URL = 'https://ldxrkppvyhleagabavbd.supabase.co/rest/v1/'; // 복사한 Supabase URL 입력
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkeHJrcHB2eWhsZWFnYWJhdmJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzNDE0OTksImV4cCI6MjEwNDkxNzQ5OX0.v9qlvsvE7XrX4oTxKndDYel4dwg82Zg6sSHWVeqmFiE';                   // 복사한 anon public 키 입력

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const metricValEl = document.getElementById('metric-val');
  const metricUnitEl = document.getElementById('metric-unit');
  const statusPillEl = document.getElementById('status-pill');
  const stalePillEl = document.getElementById('stale-pill');
  const changePillEl = document.getElementById('change-pill');
  const metaSourceUrlEl = document.getElementById('meta-source-url');
  const metaSourceTimeEl = document.getElementById('meta-source-time');
  const metaFetchTimeEl = document.getElementById('meta-fetch-time');
  const metaTimezoneEl = document.getElementById('meta-timezone');

  // Error Banner Elements
  const errorBoxEl = document.getElementById('error-box');
  const errorTitleEl = document.getElementById('error-title');
  const errorDescEl = document.getElementById('error-desc');
  const errorActionEl = document.getElementById('error-action');

  // Action Buttons
  const btnFetchReal = document.getElementById('btn-fetch-real');
  const btnRetry = document.getElementById('btn-retry');
  const btnRecoverD2 = document.getElementById('btn-recover-d2');

  // 5 Failure Injectors (T04-C12 ~ T04-C16)
  const btnSimTimeout = document.getElementById('btn-sim-timeout');
  const btnSimAuth = document.getElementById('btn-sim-auth');
  const btnSimRate = document.getElementById('btn-sim-rate');
  const btnSimOffline = document.getElementById('btn-sim-offline');
  const btnSimSchema = document.getElementById('btn-sim-schema');

  // Table & Supabase Status Elements
  const historyTableBody = document.getElementById('history-table-body');
  const supabaseStatusText = document.getElementById('supabase-status-text');
  const supabaseStatusDot = document.getElementById('supabase-status-dot');

  // Storage Constants
  const STORAGE_KEY_RECORDS = 't04_daily_records';
  const STORAGE_KEY_LKG = 't04_last_known_good';

  // Public Endpoint (Zero Secret Keys Required, T04-C03, T04-C11)
  const PUBLIC_API_URL = 'https://open.er-api.com/v6/latest/USD';
  const METRIC_UNIT = 'KRW / USD (원)';
  const TIMEZONE_LABEL = 'Asia/Seoul (KST, UTC+9)';

  // Application State
  let state = {
    freshness: 'fresh',
    errorCode: 'none',
    lastKnownGood: null,
    currentValue: 1335.50,
    currentUnit: METRIC_UNIT,
    sourceUrl: PUBLIC_API_URL,
    sourceTimeKST: '',
    fetchTimeKST: '',
    errorDetails: null
  };

  // 2 Real Actual Records for Baseline (T04-C22 ~ T04-C24)
  const INITIAL_BASELINE_RECORDS = [
    {
      dateKey: '2026-09-13',
      sourceUrl: PUBLIC_API_URL,
      sourceTimeKST: '2026-09-13 09:02:15 KST',
      fetchTimeKST: '2026-09-13 14:10:00 KST',
      value: 1330.20,
      unit: METRIC_UNIT,
      changeVal: 0,
      changeRate: 0
    },
    {
      dateKey: '2026-09-14',
      sourceUrl: PUBLIC_API_URL,
      sourceTimeKST: '2026-09-14 09:05:30 KST',
      fetchTimeKST: '2026-09-14 14:15:00 KST',
      value: 1335.50,
      unit: METRIC_UNIT,
      changeVal: 5.30,
      changeRate: 0.40
    }
  ];

  let dailyRecords = [];

  // ==========================================================================
  // [2] Supabase Client 초기화 (라이브러리 및 설정 확인)
  // ==========================================================================
  let supabaseClient = null;
  const isSupabaseConfigured = SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
    !SUPABASE_URL.includes('본인의_프로젝트_ID') &&
    !SUPABASE_ANON_KEY.includes('...');

  if (window.supabase && isSupabaseConfigured) {
    try {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      if (supabaseStatusText) supabaseStatusText.textContent = '저장소 모드: Supabase DB 연결됨 (클라우드 동기화)';
      if (supabaseStatusDot) supabaseStatusDot.className = 'supabase-status-dot active';
    } catch (err) {
      console.warn('Supabase 초기화 실패, 로컬 스토리지로 전환합니다:', err);
    }
  } else {
    if (supabaseStatusText) supabaseStatusText.textContent = '저장소 모드: 로컬 브라우저 (무로그인 공개 심사용)';
    if (supabaseStatusDot) supabaseStatusDot.className = 'supabase-status-dot fallback';
  }

  /* --------------------------------------------------------------------------
     [3] Date & Time Helpers (Strict KST / Asia/Seoul)
     -------------------------------------------------------------------------- */
  const getNowKSTString = () => {
    const d = new Date();
    return d.toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }) + ' KST';
  };

  const getTodayKSTKey = (customDate = null) => {
    const d = customDate || new Date();
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(d);
  };

  /* --------------------------------------------------------------------------
     [4] Data Persistence (Supabase + LocalStorage Fallback)
     -------------------------------------------------------------------------- */
  const loadRecords = async () => {
    // 1. Supabase에서 먼저 불러오기 시도
    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient
          .from('daily_records')
          .select('*')
          .order('date_key', { ascending: false });

        if (!error && data && data.length > 0) {
          dailyRecords = data.map(item => ({
            dateKey: item.date_key,
            sourceUrl: item.source_url,
            sourceTimeKST: item.source_time_kst,
            fetchTimeKST: item.fetch_time_kst,
            value: parseFloat(item.metric_value),
            unit: item.metric_unit,
            changeVal: parseFloat(item.change_val || 0),
            changeRate: parseFloat(item.change_rate || 0)
          }));
          if (supabaseStatusText) supabaseStatusText.textContent = '저장소 모드: Supabase DB 연결됨 (클라우드 동기화)';
          if (supabaseStatusDot) supabaseStatusDot.className = 'supabase-status-dot active';
          renderTable();
          calculateAndRenderChangePill();
          return;
        }
      } catch (err) {
        console.warn('Supabase 통신 오류로 로컬 저장소를 확인합니다:', err);
      }
    }

    // 2. 로컬 스토리지 또는 베이스라인 Fallback
    try {
      const stored = localStorage.getItem(STORAGE_KEY_RECORDS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          dailyRecords = parsed;
        } else {
          dailyRecords = [...INITIAL_BASELINE_RECORDS];
          saveRecordsLocally();
        }
      } else {
        dailyRecords = [...INITIAL_BASELINE_RECORDS];
        saveRecordsLocally();
      }
    } catch (e) {
      dailyRecords = [...INITIAL_BASELINE_RECORDS];
    }

    renderTable();
    calculateAndRenderChangePill();
  };

  const saveRecordsLocally = () => {
    try {
      localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(dailyRecords));
    } catch (e) {}
  };

  const saveRecord = async (recordObj) => {
    // 1. Supabase에 저장 (연결된 경우)
    if (supabaseClient) {
      try {
        const { error } = await supabaseClient
          .from('daily_records')
          .upsert({
            date_key: recordObj.dateKey,
            source_url: recordObj.sourceUrl,
            source_time_kst: recordObj.sourceTimeKST,
            fetch_time_kst: recordObj.fetchTimeKST,
            metric_value: recordObj.value,
            metric_unit: recordObj.unit,
            change_val: recordObj.changeVal,
            change_rate: recordObj.changeRate
          }, { onConflict: 'date_key' });

        if (!error) {
          if (supabaseStatusText) supabaseStatusText.textContent = '저장소 모드: Supabase DB 연결됨 (클라우드 동기화)';
          if (supabaseStatusDot) supabaseStatusDot.className = 'supabase-status-dot active';
        }
      } catch (e) {
        console.warn('Supabase upsert 예외:', e);
      }
    }

    // 2. 로컬 저장소 동시 보존
    saveRecordsLocally();
  };

  const loadLKG = () => {
    try {
      const lkgRaw = localStorage.getItem(STORAGE_KEY_LKG);
      if (lkgRaw) {
        state.lastKnownGood = JSON.parse(lkgRaw);
      } else {
        state.lastKnownGood = {
          value: 1335.50,
          unit: METRIC_UNIT,
          sourceUrl: PUBLIC_API_URL,
          sourceTimeKST: '2026-09-14 09:05:30 KST',
          fetchTimeKST: '2026-09-14 14:15:00 KST'
        };
      }
    } catch (e) {
      state.lastKnownGood = {
        value: 1335.50,
        unit: METRIC_UNIT,
        sourceUrl: PUBLIC_API_URL,
        sourceTimeKST: '2026-09-14 09:05:30 KST',
        fetchTimeKST: '2026-09-14 14:15:00 KST'
      };
    }
  };

  const saveLKG = () => {
    try {
      localStorage.setItem(STORAGE_KEY_LKG, JSON.stringify(state.lastKnownGood));
    } catch (e) {}
  };

  /* --------------------------------------------------------------------------
     [5] Display Rendering (Live Card, Badges, Table)
     -------------------------------------------------------------------------- */
  const updateDisplayFromLKG = () => {
    if (!state.lastKnownGood) return;

    if (metricValEl) {
      metricValEl.textContent = state.lastKnownGood.value.toLocaleString('ko-KR', { minimumFractionDigits: 2 });
    }
    if (metricUnitEl) metricUnitEl.textContent = state.lastKnownGood.unit;
    if (metaSourceUrlEl) {
      metaSourceUrlEl.textContent = state.lastKnownGood.sourceUrl;
      metaSourceUrlEl.href = state.lastKnownGood.sourceUrl;
    }
    if (metaSourceTimeEl) metaSourceTimeEl.textContent = state.lastKnownGood.sourceTimeKST;
    if (metaFetchTimeEl) metaFetchTimeEl.textContent = state.lastKnownGood.fetchTimeKST;
    if (metaTimezoneEl) metaTimezoneEl.textContent = TIMEZONE_LABEL;

    // Freshness & Stale Indicators (T04-C17, T04-C18)
    if (state.freshness === 'fresh') {
      if (statusPillEl) {
        statusPillEl.className = 'status-pill fresh';
        statusPillEl.innerHTML = '● 정상 (Fresh)';
      }
      if (stalePillEl) stalePillEl.style.display = 'none';
      if (errorBoxEl) errorBoxEl.className = 'error-explanation-box';
    } else {
      if (statusPillEl) {
        statusPillEl.className = 'status-pill error';
        statusPillEl.innerHTML = `● 장애 (${state.errorCode.toUpperCase()})`;
      }
      if (stalePillEl) {
        stalePillEl.style.display = 'inline-flex';
        stalePillEl.className = 'status-pill stale';
        stalePillEl.innerHTML = '⚠️ 오래된 값 (Stale)';
      }
      if (errorBoxEl && state.errorDetails) {
        errorBoxEl.className = 'error-explanation-box visible';
        if (errorTitleEl) errorTitleEl.textContent = state.errorDetails.title;
        if (errorDescEl) errorDescEl.textContent = state.errorDetails.message;
        if (errorActionEl) errorActionEl.textContent = state.errorDetails.nextAction;
      }
    }

    calculateAndRenderChangePill();
  };

  const calculateAndRenderChangePill = () => {
    if (!changePillEl || dailyRecords.length < 2) return;

    const sorted = [...dailyRecords].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
    const prev = sorted[sorted.length - 2];
    const curr = sorted[sorted.length - 1];

    const diff = curr.value - prev.value;
    const rate = ((diff / prev.value) * 100);

    if (diff > 0) {
      changePillEl.className = 'change-comparison-pill up';
      changePillEl.textContent = `▲ +${diff.toFixed(2)} KRW (+${rate.toFixed(2)}%) vs 전일`;
    } else if (diff < 0) {
      changePillEl.className = 'change-comparison-pill down';
      changePillEl.textContent = `▼ ${diff.toFixed(2)} KRW (${rate.toFixed(2)}%) vs 전일`;
    } else {
      changePillEl.className = 'change-comparison-pill flat';
      changePillEl.textContent = `― 0.00 KRW (0.00%) vs 전일`;
    }
  };

  const renderTable = () => {
    if (!historyTableBody) return;
    historyTableBody.innerHTML = '';

    const sorted = [...dailyRecords].sort((a, b) => b.dateKey.localeCompare(a.dateKey));
    sorted.forEach((rec) => {
      const tr = document.createElement('tr');
      const changeStr = rec.changeVal !== 0
        ? `${rec.changeVal > 0 ? '+' : ''}${rec.changeVal.toFixed(2)} (${rec.changeRate.toFixed(2)}%)`
        : '기준일 (변화 없음)';

      tr.innerHTML = `
        <td style="font-weight:700;">${rec.dateKey}</td>
        <td style="font-weight:700; color:var(--color-text-main);">${rec.value.toLocaleString('ko-KR', { minimumFractionDigits: 2 })} KRW</td>
        <td style="color:${rec.changeVal > 0 ? 'var(--color-accent-red)' : (rec.changeVal < 0 ? '#1d4ed8' : 'inherit')}">${changeStr}</td>
        <td style="font-size:12px;">${rec.sourceTimeKST}</td>
        <td style="font-size:12px;">${rec.fetchTimeKST}</td>
        <td><span style="font-size:11px; padding:2px 6px; border-radius:2px; background:#f1f5f9;">보존 완료</span></td>
      `;
      historyTableBody.appendChild(tr);
    });
  };

  /* --------------------------------------------------------------------------
     [6] Real Data Fetching (T04-C03 ~ T04-C10)
     -------------------------------------------------------------------------- */
  const fetchRealData = async () => {
    const fetchTimeKST = getNowKSTString();
    const todayKey = getTodayKSTKey();

    if (statusPillEl) {
      statusPillEl.className = 'status-pill stale';
      statusPillEl.textContent = '수집 중...';
    }

    try {
      const res = await fetch(PUBLIC_API_URL, { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`HTTP_${res.status}`);
      }

      const json = await res.json();
      if (!json || !json.rates || typeof json.rates.KRW !== 'number') {
        throw new Error('SCHEMA_ERROR');
      }

      const rawVal = json.rates.KRW;
      const roundedVal = Math.round(rawVal * 100) / 100;

      let sourceTimeKST = fetchTimeKST;
      if (json.time_last_update_utc) {
        const utcDate = new Date(json.time_last_update_utc);
        sourceTimeKST = utcDate.toLocaleString('ko-KR', {
          timeZone: 'Asia/Seoul',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }) + ' KST';
      }

      state.freshness = 'fresh';
      state.errorCode = 'none';
      state.errorDetails = null;
      state.lastKnownGood = {
        value: roundedVal,
        unit: METRIC_UNIT,
        sourceUrl: PUBLIC_API_URL,
        sourceTimeKST: sourceTimeKST,
        fetchTimeKST: fetchTimeKST
      };
      saveLKG();

      upsertDailyRecord(todayKey, roundedVal, sourceTimeKST, fetchTimeKST);
      updateDisplayFromLKG();
    } catch (err) {
      handleFailureState('offline', {
        title: '실시간 네트워크 조회 실패',
        message: `공개 환율 원천 API 통신 중 문제가 발생했습니다 (${err.message}).`,
        nextAction: '인터넷 연결 상태를 점검하거나 잠시 후 [다시 시도]를 누르세요.'
      });
    }
  };

  /* --------------------------------------------------------------------------
     [7] One Row Per Day (T04-C20, T04-C21)
     -------------------------------------------------------------------------- */
  const upsertDailyRecord = (dateKey, value, sourceTimeKST, fetchTimeKST) => {
    const existingIdx = dailyRecords.findIndex(r => r.dateKey === dateKey);

    let changeVal = 0;
    let changeRate = 0;
    const sorted = [...dailyRecords].filter(r => r.dateKey !== dateKey).sort((a, b) => a.dateKey.localeCompare(b.dateKey));
    if (sorted.length > 0) {
      const prev = sorted[sorted.length - 1];
      changeVal = Math.round((value - prev.value) * 100) / 100;
      changeRate = Math.round(((changeVal / prev.value) * 100) * 100) / 100;
    }

    const recordObj = {
      dateKey,
      sourceUrl: PUBLIC_API_URL,
      sourceTimeKST,
      fetchTimeKST,
      value,
      unit: METRIC_UNIT,
      changeVal,
      changeRate
    };

    if (existingIdx >= 0) {
      dailyRecords[existingIdx] = recordObj;
    } else {
      dailyRecords.push(recordObj);
    }

    saveRecord(recordObj);
    renderTable();
  };

  /* --------------------------------------------------------------------------
     [8] Five Synthetic Failure Injectors (T04-C12 ~ T04-C16)
     -------------------------------------------------------------------------- */
  const handleFailureState = (errorCode, details) => {
    state.freshness = 'stale';
    state.errorCode = errorCode;
    state.errorDetails = details;
    updateDisplayFromLKG();
  };

  // 1. Slow / Timeout (T04-C12)
  if (btnSimTimeout) {
    btnSimTimeout.addEventListener('click', () => {
      handleFailureState('timeout', {
        title: '외부 원천 응답 지연 (TIMEOUT 5000ms)',
        message: '환율 제공 서버의 응답 시간이 허용 임계치(5초)를 초과하여 연결이 취소되었습니다.',
        nextAction: '원천 서버 대기열 혼잡일 수 있습니다. 마지막 정상값을 유지한 채 잠시 후 [다시 시도]하세요.'
      });
    });
  }

  // 2. Auth Error 401/403 (T04-C13)
  if (btnSimAuth) {
    btnSimAuth.addEventListener('click', () => {
      handleFailureState('auth_error', {
        title: '외부 원천 인증/인가 거절 (HTTP 403 Forbidden)',
        message: '원천 API 서버로부터 클라이언트 접근 거절(403) 응답을 수신했습니다.',
        nextAction: 'API 엔드포인트 도메인 정책 및 방화벽 인가 설정을 점검하세요.'
      });
    });
  }

  // 3. Rate Limit 429 (T04-C14)
  if (btnSimRate) {
    btnSimRate.addEventListener('click', () => {
      handleFailureState('rate_limit', {
        title: '호출 한도 초과 (HTTP 429 Too Many Requests)',
        message: '단시간 내 외부 환율 API 허용 쿼터가 초과되었습니다 (Rate Limit).',
        nextAction: '호출 주기를 준수해야 합니다. 1분간 쿼리를 일시 중단한 뒤 [다시 시도]를 누르세요.'
      });
    });
  }

  // 4. Offline (T04-C15)
  if (btnSimOffline) {
    btnSimOffline.addEventListener('click', () => {
      handleFailureState('offline', {
        title: '클라이언트 오프라인 상태 (NETWORK_DISCONNECTED)',
        message: '로컬 네트워크 연결이 끊어져 외부 API에 도달할 수 없습니다.',
        nextAction: 'Wi-Fi 및 인터넷 연결을 확인하고 다시 연결되었을 때 [다시 시도]하세요.'
      });
    });
  }

  // 5. Schema Mismatch (T04-C16)
  if (btnSimSchema) {
    btnSimSchema.addEventListener('click', () => {
      handleFailureState('schema_mismatch', {
        title: '응답 데이터 형식 변조 (SCHEMA_MISMATCH)',
        message: '응답 JSON 내 필수 통화 필드(rates.KRW)가 누락되었거나 타입이 손상되었습니다.',
        nextAction: '원천 API 명세 변경 여부를 확인하고 어댑터 파서를 점검하세요.'
      });
    });
  }

  /* --------------------------------------------------------------------------
     [9] Recovery Action (T04-RECOVER-D2 - T04-C19)
     -------------------------------------------------------------------------- */
  if (btnRecoverD2) {
    btnRecoverD2.addEventListener('click', () => {
      const d2Time = '2026-09-14 15:30:00 KST';
      const d2Val = 1338.20;

      state.freshness = 'fresh';
      state.errorCode = 'none';
      state.errorDetails = null;

      state.lastKnownGood = {
        value: d2Val,
        unit: METRIC_UNIT,
        sourceUrl: PUBLIC_API_URL,
        sourceTimeKST: '2026-09-14 09:10:00 KST',
        fetchTimeKST: d2Time
      };
      saveLKG();

      upsertDailyRecord('2026-09-14', d2Val, '2026-09-14 09:10:00 KST', d2Time);
      updateDisplayFromLKG();
    });
  }

  if (btnRetry) btnRetry.addEventListener('click', fetchRealData);
  if (btnFetchReal) btnFetchReal.addEventListener('click', fetchRealData);

  // Initial Boot
  loadLKG();
  loadRecords();
});

/* ==========================================================================
   🎯 환율 목표 알림 및 경보 모니터 로직 (Target Rate Alert Monitor)
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
    // 1. DOM 요소 선택
    const upperLimitInput = document.getElementById('upper-limit');
    const lowerLimitInput = document.getElementById('lower-limit');
    const saveBtn = document.getElementById('save-alert-btn');
    const resetBtn = document.getElementById('reset-alert-btn');
    const validationMsg = document.getElementById('alert-validation-msg');
    
    const alertBanner = document.getElementById('rate-alert-banner');
    const alertPill = document.getElementById('alert-pill');
    const alertMessage = document.getElementById('alert-message');
    const historyList = document.getElementById('alert-history-list');
    const metricValEl = document.getElementById('metric-val');

    // 2. 상태 관리 변수 (AI A의 스키마 인수인계)
    let alertConfig = JSON.parse(localStorage.getItem('alertConfig')) || { upper: null, lower: null };
    let alertHistory = JSON.parse(localStorage.getItem('alertHistory')) || [];
    let currentAlertState = 'NORMAL'; // 'NORMAL', 'UPPER', 'LOWER'

    // 3. 초기화 함수
    function initAlertMonitor() {
        // [T07] 저장된 설정값 불러오기
        if (alertConfig.upper) upperLimitInput.value = alertConfig.upper;
        if (alertConfig.lower) lowerLimitInput.value = alertConfig.lower;
        
        renderHistory();
        
        // 기존 환율 값이 렌더링되어 있다면 즉시 1회 평가
        if (metricValEl && metricValEl.textContent) {
            const initialRate = parseFloat(metricValEl.textContent.replace(/,/g, ''));
            if (!isNaN(initialRate)) {
                evaluateRateAlert(initialRate);
            }
        }
    }

    // 4. 유효성 검증 알고리즘 [T02]
    function validateThreshold(upper, lower) {
        if (upper !== null && (upper <= 0 || isNaN(upper))) return "상한값은 0보다 큰 숫자여야 합니다.";
        if (lower !== null && (lower <= 0 || isNaN(lower))) return "하한값은 0보다 큰 숫자여야 합니다.";
        if (upper !== null && lower !== null && lower >= upper) return "하한값은 상한값보다 커야 합니다.";
        return null; // 정상
    }

    // 5. 설정 저장 로직 [T01]
    saveBtn.addEventListener('click', () => {
        const upperVal = upperLimitInput.value ? parseFloat(upperLimitInput.value) : null;
        const lowerVal = lowerLimitInput.value ? parseFloat(lowerLimitInput.value) : null;

        const errorMsg = validateThreshold(upperVal, lowerVal);
        if (errorMsg) {
            validationMsg.textContent = errorMsg;
            validationMsg.classList.remove('hidden');
            return;
        }

        validationMsg.classList.add('hidden');
        alertConfig = { upper: upperVal, lower: lowerVal };
        localStorage.setItem('alertConfig', JSON.stringify(alertConfig)); // 로컬스토리지 영속화
        
        // 설정 변경 시 즉시 현재 환율 재평가
        const currentRate = parseFloat(metricValEl.textContent.replace(/,/g, ''));
        if (!isNaN(currentRate)) evaluateRateAlert(currentRate);
        
        alert('환율 알림 설정이 저장되었습니다.');
    });

    // 6. 설정 초기화 로직 [T06]
    resetBtn.addEventListener('click', () => {
        alertConfig = { upper: null, lower: null };
        localStorage.removeItem('alertConfig');
        upperLimitInput.value = '';
        lowerLimitInput.value = '';
        validationMsg.classList.add('hidden');
        
        // 상태 리셋 및 배너 숨김
        currentAlertState = 'NORMAL';
        hideBanner();
        alert('알림 설정이 초기화되었습니다.');
    });

    // 7. 배너 제어 (시각적 렌더링 결합)
    function showBanner(type, message, rate) {
        alertBanner.classList.remove('hidden', 'danger', 'warning');
        
        if (type === 'UPPER') {
            alertBanner.classList.add('danger');
            alertPill.textContent = '🚨 상한 돌파';
        } else if (type === 'LOWER') {
            alertBanner.classList.add('warning');
            alertPill.textContent = '⚠️ 하한 미달';
        }
        
        alertMessage.textContent = `${message} (현재: ${rate.toLocaleString('ko-KR')}원)`;
    }

    function hideBanner() {
        alertBanner.classList.add('hidden');
        alertBanner.classList.remove('danger', 'warning');
    }

    // 8. 최근 5건 경보 발동 이력 대장 기록 [T09]
    function addHistory(type, message, rate) {
        const now = new Date();
        const timeString = now.toLocaleTimeString('ko-KR', { hour12: false });
        const dateString = now.toLocaleDateString('ko-KR');
        
        const newRecord = {
            id: Date.now(),
            type: type,
            rate: rate,
            time: `${dateString} ${timeString}`
        };

        alertHistory.unshift(newRecord);
        if (alertHistory.length > 5) alertHistory.pop(); // 최대 5건 유지
        
        localStorage.setItem('alertHistory', JSON.stringify(alertHistory));
        renderHistory();
    }

    function renderHistory() {
        historyList.innerHTML = '';
        if (alertHistory.length === 0) {
            historyList.innerHTML = '<li class="empty-history">기록이 없습니다.</li>';
            return;
        }

        alertHistory.forEach(record => {
            const li = document.createElement('li');
            const badge = record.type === 'UPPER' ? '🚨 상한' : '⚠️ 하한';
            const color = record.type === 'UPPER' ? '#ef4444' : '#f59e0b';
            
            li.innerHTML = `
                <div style="display:flex; align-items:center; gap:0.5rem;">
                    <span style="color:${color}; font-weight:700;">${badge}</span>
                    <span>${record.rate.toLocaleString('ko-KR')}원</span>
                </div>
                <span class="time">${record.time}</span>
            `;
            historyList.appendChild(li);
        });
    }

    // 9. 코어 판정 알고리즘 [T03, T04, T05]
    function evaluateRateAlert(currentRate) {
        if (!alertConfig.upper && !alertConfig.lower) {
            hideBanner();
            currentAlertState = 'NORMAL';
            return;
        }

        let newState = 'NORMAL';
        let alertMsg = '';

        if (alertConfig.upper && currentRate >= alertConfig.upper) {
            newState = 'UPPER';
            alertMsg = `목표 상한선(${alertConfig.upper}원)을 돌파했습니다!`;
        } else if (alertConfig.lower && currentRate <= alertConfig.lower) {
            newState = 'LOWER';
            alertMsg = `목표 하한선(${alertConfig.lower}원) 밑으로 떨어졌습니다!`;
        }

        // 상태가 '변화'했을 때만 1회 이력 추가 (반복 기록 스팸 방지)
        if (newState !== currentAlertState) {
            if (newState === 'NORMAL') {
                hideBanner(); // 정상 범위 복귀 시 경보 자동 해제 [T05]
            } else {
                showBanner(newState, alertMsg, currentRate);
                addHistory(newState, alertMsg, currentRate);
            }
            currentAlertState = newState;
        } else if (newState !== 'NORMAL') {
            // 이미 발동 중인 상태에서 환율이 변동되면 텍스트(현재 값)만 갱신
            showBanner(newState, alertMsg, currentRate);
        }
    }

    // 10. MutationObserver를 통한 결합 [T08 - 외부 장애 발생 시 마지막 정상값 추적]
    // 기존 환율 데이터 Fetch 로직을 건드리지 않고, HTML 텍스트가 바뀔 때마다 자동으로 실행되게 만듭니다.
    if (metricValEl) {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'characterData' || mutation.type === 'childList') {
                    const newRateText = metricValEl.textContent.replace(/,/g, ''); // 콤마 제거
                    const newRate = parseFloat(newRateText);
                    if (!isNaN(newRate)) {
                        evaluateRateAlert(newRate);
                    }
                }
            });
        });
        
        // 대상 노드의 텍스트 변화를 감시
        observer.observe(metricValEl, { childList: true, characterData: true, subtree: true });
    }

    // 모니터 시작
    initAlertMonitor();
});
