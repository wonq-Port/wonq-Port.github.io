/**
 * Real Information Board Engine
 * Compliant with T04-C01 ~ T04-C28
 * Zero Secret Keys, Pure Client/Serverless Architecture
 */

document.addEventListener('DOMContentLoaded', () => {
  const metricValEl = document.getElementById('metric-val');
  const metricUnitEl = document.getElementById('metric-unit');
  const statusPillEl = document.getElementById('status-pill');
  const stalePillEl = document.getElementById('stale-pill');
  const changePillEl = document.getElementById('change-pill');
  const metaSourceUrlEl = document.getElementById('meta-source-url');
  const metaSourceTimeEl = document.getElementById('meta-source-time');
  const metaFetchTimeEl = document.getElementById('meta-fetch-time');
  const metaTimezoneEl = document.getElementById('meta-timezone');

  const errorBoxEl = document.getElementById('error-box');
  const errorTitleEl = document.getElementById('error-title');
  const errorDescEl = document.getElementById('error-desc');
  const errorActionEl = document.getElementById('error-action');

  const btnFetchReal = document.getElementById('btn-fetch-real');
  const btnRetry = document.getElementById('btn-retry');
  const btnRecoverD2 = document.getElementById('btn-recover-d2');

  const btnSimTimeout = document.getElementById('btn-sim-timeout');
  const btnSimAuth = document.getElementById('btn-sim-auth');
  const btnSimRate = document.getElementById('btn-sim-rate');
  const btnSimOffline = document.getElementById('btn-sim-offline');
  const btnSimSchema = document.getElementById('btn-sim-schema');

  const historyTableBody = document.getElementById('history-table-body');

  const STORAGE_KEY_RECORDS = 't04_daily_records';
  const STORAGE_KEY_LKG = 't04_last_known_good';

  const PUBLIC_API_URL = 'https://open.er-api.com/v6/latest/USD';
  const METRIC_UNIT = 'KRW / USD (원)';
  const TIMEZONE_LABEL = 'Asia/Seoul (KST, UTC+9)';

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
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(d);
    return parts;
  };

  const initStorage = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_RECORDS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          dailyRecords = parsed;
        } else {
          dailyRecords = [...INITIAL_BASELINE_RECORDS];
          saveRecords();
        }
      } else {
        dailyRecords = [...INITIAL_BASELINE_RECORDS];
        saveRecords();
      }
    } catch (e) {
      dailyRecords = [...INITIAL_BASELINE_RECORDS];
    }

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

    renderTable();
    updateDisplayFromLKG();
  };

  const saveRecords = () => {
    try {
      localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(dailyRecords));
    } catch (e) {}
  };

  const saveLKG = () => {
    try {
      localStorage.setItem(STORAGE_KEY_LKG, JSON.stringify(state.lastKnownGood));
    } catch (e) {}
  };

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
        <td><span style="font-size:11px; padding:2px 6px; border-radius:2px; background:#f1f5f9;">정상 보존</span></td>
      `;
      historyTableBody.appendChild(tr);
    });
  };

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
        sourceTimeKST
