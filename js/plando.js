// ===== STATE =====
const S = {
  plans: [], planVers: [], tasks: [], execs: [], see: null,
  tSearch: '', tPlan: '', tStatus: '', tPrio: '', tTag: '',
  tDelayed: false, tSort: 'priority', tDir: 'asc',
  seePlan: '',
  doBlocked: false,
  pending: new Set(),
  editPlanId: null, editTaskId: null,
  activeTab: 'plan',
};

let SB = null;
let seeRating = 0;

// ===== UTILS =====
function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function kstToday() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
    .toISOString().split('T')[0];
}

function fmtDate(d) {
  if (!d) return '';
  return String(d).slice(0, 10);
}

function fmtDatetime(d) {
  if (!d) return '';
  var dt = new Date(d);
  return dt.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function fmtCreated(d) {
  if (!d) return '';
  var dt = new Date(d);
  return dt.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });
}

function priorityLabel(p) {
  return p === 'high' ? '높음' : p === 'medium' ? '보통' : '낮음';
}

function statusLabel(s) {
  return s === 'todo' ? '할 일' : s === 'in_progress' ? '진행 중' : '완료';
}

// ===== LOCALSTORAGE =====
var LS = {
  plans: 'pds2_plans',
  planVers: 'pds2_plan_versions',
  tasks: 'pds2_tasks',
  execs: 'pds2_executions',
  sees: 'pds2_sees',
  sbUrl: 'pds2_sb_url',
  sbKey: 'pds2_sb_key',
};

function lsLoad(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch(e) { return []; }
}
function lsSave(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

// ===== DB LAYER =====
var DB = {
  loadAll: async function() {
    if (SB) {
      var results = await Promise.all([
        SB.from('plans').select('*').order('created_at'),
        SB.from('plan_versions').select('*').order('saved_at'),
        SB.from('tasks').select('*').order('created_at'),
        SB.from('executions').select('*').order('created_at'),
        SB.from('sees').select('*'),
      ]);
      S.plans = results[0].data || [];
      S.planVers = results[1].data || [];
      S.tasks = results[2].data || [];
      S.execs = results[3].data || [];
      S.see = (results[4].data || []).find(function(r) { return r.date === kstToday(); }) || null;
    } else {
      S.plans = lsLoad(LS.plans);
      S.planVers = lsLoad(LS.planVers);
      S.tasks = lsLoad(LS.tasks);
      S.execs = lsLoad(LS.execs);
      var sees = lsLoad(LS.sees);
      S.see = sees.find(function(r) { return r.date === kstToday(); }) || null;
    }
  },
  savePlan: async function(plan) {
    if (SB) { await SB.from('plans').upsert(plan); }
    else {
      var arr = lsLoad(LS.plans);
      var i = arr.findIndex(function(p) { return p.id === plan.id; });
      if (i >= 0) arr[i] = plan; else arr.push(plan);
      lsSave(LS.plans, arr);
    }
    S.plans = S.plans.filter(function(p) { return p.id !== plan.id; });
    S.plans.push(plan);
  },
  deletePlan: async function(id) {
    if (SB) { await SB.from('plans').delete().eq('id', id); }
    else {
      lsSave(LS.plans, lsLoad(LS.plans).filter(function(p) { return p.id !== id; }));
      lsSave(LS.planVers, lsLoad(LS.planVers).filter(function(v) { return v.plan_id !== id; }));
      lsSave(LS.tasks, lsLoad(LS.tasks).map(function(t) { return t.plan_id === id ? Object.assign({}, t, { plan_id: null }) : t; }));
    }
    S.plans = S.plans.filter(function(p) { return p.id !== id; });
    S.planVers = S.planVers.filter(function(v) { return v.plan_id !== id; });
    S.tasks = S.tasks.map(function(t) { return t.plan_id === id ? Object.assign({}, t, { plan_id: null }) : t; });
  },
  savePlanVer: async function(ver) {
    if (SB) { await SB.from('plan_versions').insert(ver); }
    else {
      var arr = lsLoad(LS.planVers);
      arr.push(ver);
      lsSave(LS.planVers, arr);
    }
    S.planVers.push(ver);
  },
  saveTask: async function(task) {
    if (SB) { await SB.from('tasks').upsert(task); }
    else {
      var arr = lsLoad(LS.tasks);
      var i = arr.findIndex(function(t) { return t.id === task.id; });
      if (i >= 0) arr[i] = task; else arr.push(task);
      lsSave(LS.tasks, arr);
    }
    S.tasks = S.tasks.filter(function(t) { return t.id !== task.id; });
    S.tasks.push(task);
  },
  deleteTask: async function(id) {
    if (SB) { await SB.from('tasks').delete().eq('id', id); }
    else {
      lsSave(LS.tasks, lsLoad(LS.tasks).filter(function(t) { return t.id !== id; }));
      lsSave(LS.execs, lsLoad(LS.execs).filter(function(e) { return e.task_id !== id; }));
    }
    S.tasks = S.tasks.filter(function(t) { return t.id !== id; });
    S.execs = S.execs.filter(function(e) { return e.task_id !== id; });
  },
  saveExec: async function(exec) {
    if (SB) { await SB.from('executions').insert(exec); }
    else {
      var arr = lsLoad(LS.execs);
      arr.push(exec);
      lsSave(LS.execs, arr);
    }
    S.execs.push(exec);
  },
  deleteExec: async function(id) {
    if (SB) { await SB.from('executions').delete().eq('id', id); }
    else { lsSave(LS.execs, lsLoad(LS.execs).filter(function(e) { return e.id !== id; })); }
    S.execs = S.execs.filter(function(e) { return e.id !== id; });
  },
  saveSee: async function(see) {
    if (SB) { await SB.from('sees').upsert(see, { onConflict: 'date' }); }
    else {
      var arr = lsLoad(LS.sees);
      var i = arr.findIndex(function(s) { return s.date === see.date; });
      if (i >= 0) arr[i] = see; else arr.push(see);
      lsSave(LS.sees, arr);
    }
    S.see = see;
  },
};

// ===== PLAN EDIT WITH VERSION (T06-C08) =====
async function savePlanEdit(id, updates) {
  var current = S.plans.find(function(p) { return p.id === id; });
  if (!current) return;
  var vNum = S.planVers.filter(function(v) { return v.plan_id === id; }).length + 1;
  var ver = {
    id: uuid(),
    plan_id: id,
    version_num: vNum,
    title: current.title,
    period_start: current.period_start || null,
    period_end: current.period_end || null,
    priority: current.priority,
    success_criteria: current.success_criteria || '',
    estimated_minutes: current.estimated_minutes || 0,
    notes: current.notes || '',
    saved_at: new Date().toISOString(),
  };
  await DB.savePlanVer(ver);
  var updated = Object.assign({}, current, updates);
  await DB.savePlan(updated);
}

// ===== TOGGLE TASK STATUS (T06-C11, C12) =====
async function toggleTaskStatus(id) {
  var task = S.tasks.find(function(t) { return t.id === id; });
  if (!task) return;
  var cycle = { todo: 'in_progress', in_progress: 'done', done: 'todo' };
  var newStatus = cycle[task.status] || 'todo';
  var completed_at = newStatus === 'done' ? new Date().toISOString() : null;
  await DB.saveTask(Object.assign({}, task, { status: newStatus, completed_at: completed_at }));
  renderTasks();
}

// ===== EXEC AUTO-CALC (T06-C25) =====
function autoCalcMinutes() {
  var sv = document.getElementById('exec-start').value;
  var ev = document.getElementById('exec-end').value;
  if (sv && ev) {
    var diff = (new Date(ev) - new Date(sv)) / 60000;
    if (diff > 0) {
      document.getElementById('exec-minutes').value = Math.round(diff);
    }
  }
}

// ===== SUBMIT EXEC (T06-C21) =====
async function submitExec() {
  var taskId = document.getElementById('exec-task').value;
  if (!taskId) { alert('할 일을 선택하세요.'); return; }
  if (S.pending.has(taskId)) return;
  S.pending.add(taskId);
  try {
    var startVal = document.getElementById('exec-start').value;
    var endVal = document.getElementById('exec-end').value;
    var actualMin = parseInt(document.getElementById('exec-minutes').value) || 0;
    if (startVal && endVal) {
      var diff = (new Date(endVal) - new Date(startVal)) / 60000;
      if (diff > 0) actualMin = Math.round(diff);
    }
    var blocker = document.getElementById('exec-blocker').value.trim();
    var bucket = startVal ? startVal.slice(0, 16) : null;
    if (bucket && S.execs.some(function(e) { return e.task_id === taskId && e.start_at && e.start_at.slice(0, 16) === bucket; })) {
      alert('이미 같은 시간에 기록이 있습니다.');
      return;
    }
    var exec = {
      id: uuid(),
      task_id: taskId,
      start_at: startVal ? new Date(startVal).toISOString() : null,
      end_at: endVal ? new Date(endVal).toISOString() : null,
      actual_minutes: actualMin,
      blocker_reason: blocker,
      created_at: new Date().toISOString(),
    };
    await DB.saveExec(exec);
    document.getElementById('exec-task').value = '';
    document.getElementById('exec-start').value = '';
    document.getElementById('exec-end').value = '';
    document.getElementById('exec-minutes').value = '';
    document.getElementById('exec-blocker').value = '';
    renderDo();
  } finally {
    S.pending.delete(taskId);
  }
}

// ===== SORT / FILTER (T06-C18, C19, C20) =====
function sortedTasks(tasks) {
  var priorityRank = { high: 0, medium: 1, low: 2 };
  return tasks.slice().sort(function(a, b) {
    var cmp = 0;
    if (S.tSort === 'priority') {
      cmp = (priorityRank[a.priority] != null ? priorityRank[a.priority] : 1) - (priorityRank[b.priority] != null ? priorityRank[b.priority] : 1);
    } else if (S.tSort === 'due_date') {
      var da = a.due_date || '9999', db = b.due_date || '9999';
      cmp = da < db ? -1 : da > db ? 1 : 0;
    } else if (S.tSort === 'title') {
      cmp = a.title.localeCompare(b.title, 'ko');
    } else if (S.tSort === 'created_at') {
      cmp = (a.created_at || '') < (b.created_at || '') ? -1 : 1;
    }
    if (S.tDir === 'desc') cmp = -cmp;
    if (cmp === 0) {
      return (a.created_at || '') < (b.created_at || '') ? -1 : 1;
    }
    return cmp;
  });
}

function filteredTasks() {
  var today = kstToday();
  return S.tasks.filter(function(t) {
    if (S.tSearch && !t.title.toLowerCase().includes(S.tSearch.toLowerCase())) return false;
    if (S.tPlan && t.plan_id !== S.tPlan) return false;
    if (S.tStatus && t.status !== S.tStatus) return false;
    if (S.tPrio && t.priority !== S.tPrio) return false;
    if (S.tTag) {
      var tags = (t.tags || '').split(',').map(function(x) { return x.trim(); });
      if (!tags.some(function(tag) { return tag.toLowerCase().includes(S.tTag.toLowerCase()); })) return false;
    }
    if (S.tDelayed) {
      if (t.status === 'done' || !t.due_date || t.due_date >= today) return false;
    }
    return true;
  });
}

function getSortLabel() {
  if (S.tSort === 'due_date') return '정렬: 마감일 ' + (S.tDir === 'asc' ? '빠른 순' : '늦은 순');
  if (S.tSort === 'title') return '정렬: 제목 ' + (S.tDir === 'asc' ? '가나다 순' : '역순');
  if (S.tSort === 'created_at') return '정렬: 생성일 ' + (S.tDir === 'asc' ? '오래된 순' : '최신 순');
  if (S.tSort === 'priority') return '정렬: 우선순위 ' + (S.tDir === 'asc' ? '높은 순' : '낮은 순');
  return '정렬: ' + S.tSort;
}

// ===== EXPORT (T06-C36) =====
function exportData() {
  var data = {
    exported_at: new Date().toISOString(),
    plans: S.plans,
    plan_versions: S.planVers,
    tasks: S.tasks,
    executions: S.execs,
    sees: lsLoad(LS.sees),
  };
  var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'plando-export-' + kstToday() + '.json';
  a.click();
}

// ===== SEE NAV (T06-C83) =====
function seeNavTasks(tPlan, tStatus, tDelayed) {
  S.tPlan = tPlan || '';
  S.tStatus = tStatus || '';
  S.tPrio = '';
  S.tTag = '';
  S.tDelayed = !!tDelayed;
  showTab('tasks');
  syncTaskFilterUI();
  renderTasks();
}

function seeNavDo(blocked) {
  S.doBlocked = !!blocked;
  showTab('do');
  renderDo();
}

function syncTaskFilterUI() {
  var tPlanEl = document.getElementById('t-plan');
  var tStatusEl = document.getElementById('t-status');
  var tSearchEl = document.getElementById('t-search');
  var tPrioEl = document.getElementById('t-prio');
  var tTagEl = document.getElementById('t-tag');
  var tSortEl = document.getElementById('t-sort');
  if (tPlanEl) tPlanEl.value = S.tPlan || '';
  if (tStatusEl) tStatusEl.value = S.tStatus || '';
  if (tSearchEl) tSearchEl.value = S.tSearch || '';
  if (tPrioEl) tPrioEl.value = S.tPrio || '';
  if (tTagEl) tTagEl.value = S.tTag || '';
  if (tSortEl) tSortEl.value = S.tSort || 'priority';
}

// ===== TAB =====
function showTab(name) {
  S.activeTab = name;
  document.querySelectorAll('.tab-panel').forEach(function(p) { p.classList.remove('active'); });
  document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
  var panel = document.getElementById('tab-' + name);
  if (panel) panel.classList.add('active');
  var btn = document.querySelector('.tab-btn[data-tab="' + name + '"]');
  if (btn) btn.classList.add('active');
  if (name === 'plan') renderPlans();
  if (name === 'tasks') { populatePlanSelects(); renderTasks(); }
  if (name === 'do') renderDo();
  if (name === 'see') { populatePlanSelects(); renderSee(); }
}

// ===== MODALS =====
function openModal(id) {
  document.getElementById(id).classList.add('open');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

document.addEventListener('click', function(e) {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
  }
});

// ===== PLAN MODAL =====
function openPlanModal(id) {
  S.editPlanId = id || null;
  var titleEl = document.getElementById('modal-plan-title');
  if (id) {
    var p = S.plans.find(function(x) { return x.id === id; });
    if (!p) return;
    titleEl.textContent = '계획 수정';
    document.getElementById('plan-title').value = p.title || '';
    document.getElementById('plan-start').value = p.period_start || '';
    document.getElementById('plan-end').value = p.period_end || '';
    document.getElementById('plan-prio').value = p.priority || 'medium';
    document.getElementById('plan-criteria').value = p.success_criteria || '';
    document.getElementById('plan-minutes').value = p.estimated_minutes || 0;
    document.getElementById('plan-notes').value = p.notes || '';
  } else {
    titleEl.textContent = '계획 추가';
    document.getElementById('plan-title').value = '';
    document.getElementById('plan-start').value = '';
    document.getElementById('plan-end').value = '';
    document.getElementById('plan-prio').value = 'medium';
    document.getElementById('plan-criteria').value = '';
    document.getElementById('plan-minutes').value = '';
    document.getElementById('plan-notes').value = '';
  }
  openModal('modal-plan');
}

async function savePlan() {
  var title = document.getElementById('plan-title').value.trim();
  if (!title) { alert('제목을 입력하세요.'); return; }
  var updates = {
    title: title,
    period_start: document.getElementById('plan-start').value || null,
    period_end: document.getElementById('plan-end').value || null,
    priority: document.getElementById('plan-prio').value,
    success_criteria: document.getElementById('plan-criteria').value.trim(),
    estimated_minutes: parseInt(document.getElementById('plan-minutes').value) || 0,
    notes: document.getElementById('plan-notes').value.trim(),
  };
  if (S.editPlanId) {
    await savePlanEdit(S.editPlanId, updates);
  } else {
    var plan = Object.assign({ id: uuid(), created_at: new Date().toISOString() }, updates);
    await DB.savePlan(plan);
  }
  closeModal('modal-plan');
  renderPlans();
  populatePlanSelects();
}

async function deletePlan(id) {
  if (!confirm('계획을 삭제하시겠습니까? 연결된 할 일의 계획 연결이 해제됩니다.')) return;
  await DB.deletePlan(id);
  renderPlans();
  populatePlanSelects();
}

// ===== HISTORY MODAL =====
function openHistoryModal(planId) {
  var versions = S.planVers.filter(function(v) { return v.plan_id === planId; }).slice().sort(function(a, b) { return b.version_num - a.version_num; });
  var container = document.getElementById('history-list');
  if (versions.length === 0) {
    container.innerHTML = '<div class="empty-state">수정 이력이 없습니다.</div>';
  } else {
    container.innerHTML = versions.map(function(v) {
      return '<div class="version-item">' +
        '<div class="version-num">v' + esc(String(v.version_num)) + ' &nbsp;<span style="font-size:11px;font-weight:400;color:var(--muted)">' + esc(fmtDatetime(v.saved_at)) + '</span></div>' +
        '<div class="version-field"><strong>제목:</strong> ' + esc(v.title) + '</div>' +
        (v.period_start ? '<div class="version-field"><strong>기간:</strong> ' + esc(v.period_start) + ' ~ ' + esc(v.period_end || '') + '</div>' : '') +
        '<div class="version-field"><strong>우선순위:</strong> ' + esc(priorityLabel(v.priority)) + '</div>' +
        (v.success_criteria ? '<div class="version-field"><strong>성공 기준:</strong> ' + esc(v.success_criteria) + '</div>' : '') +
        '<div class="version-field"><strong>예상 시간:</strong> ' + esc(String(v.estimated_minutes || 0)) + '분</div>' +
        (v.notes ? '<div class="version-field"><strong>메모:</strong> ' + esc(v.notes) + '</div>' : '') +
        '</div>';
    }).join('');
  }
  openModal('modal-history');
}

// ===== TASK MODAL =====
function openTaskModal(id) {
  S.editTaskId = id || null;
  var titleEl = document.getElementById('modal-task-title');
  populateTaskPlanSelect();
  if (id) {
    var t = S.tasks.find(function(x) { return x.id === id; });
    if (!t) return;
    titleEl.textContent = '할 일 수정';
    document.getElementById('task-title').value = t.title || '';
    document.getElementById('task-plan-id').value = t.plan_id || '';
    document.getElementById('task-status').value = t.status || 'todo';
    document.getElementById('task-prio').value = t.priority || 'medium';
    document.getElementById('task-due').value = t.due_date || '';
    document.getElementById('task-minutes').value = t.estimated_minutes || 0;
    document.getElementById('task-tags').value = t.tags || '';
    document.getElementById('task-notes').value = t.notes || '';
  } else {
    titleEl.textContent = '할 일 추가';
    document.getElementById('task-title').value = '';
    document.getElementById('task-plan-id').value = '';
    document.getElementById('task-status').value = 'todo';
    document.getElementById('task-prio').value = 'medium';
    document.getElementById('task-due').value = '';
    document.getElementById('task-minutes').value = '';
    document.getElementById('task-tags').value = '';
    document.getElementById('task-notes').value = '';
  }
  openModal('modal-task');
}

async function saveTask() {
  var title = document.getElementById('task-title').value.trim();
  if (!title) { alert('제목을 입력하세요.'); return; }
  var planId = document.getElementById('task-plan-id').value || null;
  var status = document.getElementById('task-status').value;
  var updates = {
    title: title,
    plan_id: planId,
    status: status,
    priority: document.getElementById('task-prio').value,
    due_date: document.getElementById('task-due').value || null,
    estimated_minutes: parseInt(document.getElementById('task-minutes').value) || 0,
    tags: document.getElementById('task-tags').value.trim(),
    notes: document.getElementById('task-notes').value.trim(),
  };
  if (S.editTaskId) {
    var existing = S.tasks.find(function(t) { return t.id === S.editTaskId; });
    var completed_at = status === 'done' ? (existing && existing.completed_at ? existing.completed_at : new Date().toISOString()) : null;
    await DB.saveTask(Object.assign({}, existing, updates, { completed_at: completed_at }));
  } else {
    var task = Object.assign({ id: uuid(), completed_at: status === 'done' ? new Date().toISOString() : null, created_at: new Date().toISOString() }, updates);
    await DB.saveTask(task);
  }
  closeModal('modal-task');
  renderTasks();
}

async function deleteTask(id) {
  if (!confirm('할 일을 삭제하시겠습니까? 연결된 실행 기록도 삭제됩니다.')) return;
  await DB.deleteTask(id);
  renderTasks();
  renderDo();
}

async function deleteExec(id) {
  if (!confirm('실행 기록을 삭제하시겠습니까?')) return;
  await DB.deleteExec(id);
  renderDo();
}

// ===== DB CONFIG MODAL =====
function openDbModal() {
  var sbUrl = localStorage.getItem(LS.sbUrl) || '';
  var sbKey = localStorage.getItem(LS.sbKey) || '';
  document.getElementById('sb-url').value = sbUrl;
  document.getElementById('sb-key').value = sbKey;
  openModal('modal-db');
}

async function connectSupabase() {
  var url = document.getElementById('sb-url').value.trim();
  var key = document.getElementById('sb-key').value.trim();
  if (!url || !key) { alert('URL과 키를 모두 입력하세요.'); return; }
  try {
    var client = window.supabase.createClient(url, key);
    // Verify connection by testing query
    var testRes = await client.from('plans').select('id').limit(1);
    if (testRes.error) {
      throw new Error(testRes.error.message || '데이터베이스 조회 실패');
    }
    SB = client;
    localStorage.setItem(LS.sbUrl, url);
    localStorage.setItem(LS.sbKey, key);
    SB.auth.onAuthStateChange(function(event, session) {
      checkAuthSession();
    });
    await checkAuthSession();
    await DB.loadAll();
    renderAll();
    updateDbStatus();
    closeModal('modal-db');
    alert('Supabase에 성공적으로 연결되었습니다.');
  } catch(e) {
    alert('연결 실패: ' + e.message + ' (Supabase SQL Editor에서 5개 테이블이 정상 생성되었는지 확인하세요.)');
  }
}

function disconnectSupabase() {
  SB = null;
  localStorage.removeItem(LS.sbUrl);
  localStorage.removeItem(LS.sbKey);
  updateDbStatus();
  closeModal('modal-db');
}

function updateDbStatus() {
  var dot = document.getElementById('db-dot');
  var txt = document.getElementById('db-status-text');
  if (SB) {
    dot.classList.add('connected');
    var url = localStorage.getItem(LS.sbUrl) || '';
    var shortUrl = url.replace('https://', '').split('.')[0];
    txt.textContent = 'Supabase 연결됨: ' + shortUrl;
  } else {
    dot.classList.remove('connected');
    txt.textContent = '로컬 저장소 사용 중';
  }
}

// ===== POPULATE SELECTS =====
function populatePlanSelects() {
  var tPlanEl = document.getElementById('t-plan');
  if (tPlanEl) {
    tPlanEl.innerHTML = '<option value="">모든 계획</option>' +
      S.plans.map(function(p) { return '<option value="' + esc(p.id) + '">' + esc(p.title) + '</option>'; }).join('');
    tPlanEl.value = S.tPlan || '';
  }
  var seePlanEl = document.getElementById('see-plan');
  if (seePlanEl) {
    seePlanEl.innerHTML = '<option value="">모든 계획</option>' +
      S.plans.map(function(p) { return '<option value="' + esc(p.id) + '">' + esc(p.title) + '</option>'; }).join('');
    seePlanEl.value = S.seePlan || '';
  }
  populateExecTaskSelect();
}

function populateTaskPlanSelect() {
  var el = document.getElementById('task-plan-id');
  if (el) {
    el.innerHTML = '<option value="">계획 없음</option>' +
      S.plans.map(function(p) { return '<option value="' + esc(p.id) + '">' + esc(p.title) + '</option>'; }).join('');
  }
}

function populateExecTaskSelect() {
  var el = document.getElementById('exec-task');
  if (!el) return;
  var byPlan = {};
  var noPlan = [];
  S.tasks.forEach(function(t) {
    if (t.plan_id) {
      if (!byPlan[t.plan_id]) byPlan[t.plan_id] = [];
      byPlan[t.plan_id].push(t);
    } else {
      noPlan.push(t);
    }
  });
  var html = '<option value="">할 일을 선택하세요</option>';
  S.plans.forEach(function(p) {
    var tasks = byPlan[p.id] || [];
    if (tasks.length > 0) {
      html += '<optgroup label="' + esc(p.title) + '">';
      tasks.forEach(function(t) {
        html += '<option value="' + esc(t.id) + '">[' + esc(statusLabel(t.status)) + '] ' + esc(t.title) + '</option>';
      });
      html += '</optgroup>';
    }
  });
  if (noPlan.length > 0) {
    html += '<optgroup label="계획 없음">';
    noPlan.forEach(function(t) {
      html += '<option value="' + esc(t.id) + '">[' + esc(statusLabel(t.status)) + '] ' + esc(t.title) + '</option>';
    });
    html += '</optgroup>';
  }
  el.innerHTML = html;
}

// ===== RENDER PLANS =====
function renderPlans() {
  var container = document.getElementById('plan-list');
  if (!container) return;
  populatePlanSelects();
  if (S.plans.length === 0) {
    container.innerHTML = '<div class="empty-state">아직 계획이 없습니다. 계획을 추가해보세요!</div>';
    return;
  }
  var sorted = S.plans.slice().sort(function(a, b) { return (a.created_at || '') > (b.created_at || '') ? -1 : 1; });
  container.innerHTML = sorted.map(function(p) {
    var taskCount = S.tasks.filter(function(t) { return t.plan_id === p.id; }).length;
    var doneCount = S.tasks.filter(function(t) { return t.plan_id === p.id && t.status === 'done'; }).length;
    var period = p.period_start ? esc(fmtDate(p.period_start)) + ' ~ ' + esc(fmtDate(p.period_end || '')) : '';
    return '<div class="plan-card">' +
      '<div class="plan-card-title">' + esc(p.title) + '</div>' +
      '<div class="plan-card-meta">' +
        (period ? '<span>' + period + '</span>' : '') +
        '<span class="badge badge-' + esc(p.priority) + '">' + esc(priorityLabel(p.priority)) + '</span>' +
        '<span style="font-size:11px;color:var(--muted)">할 일 ' + taskCount + '개 / 완료 ' + doneCount + '개</span>' +
      '</div>' +
      (p.success_criteria ? '<div class="plan-card-criteria">' + esc(p.success_criteria) + '</div>' : '') +
      '<div style="font-size:11px;color:var(--muted);">예상 ' + (p.estimated_minutes || 0) + '분 &nbsp;·&nbsp; ' + esc(fmtCreated(p.created_at)) + '</div>' +
      '<div class="plan-card-actions">' +
        '<button class="btn-icon" onclick="openPlanModal(\'' + esc(p.id) + '\')">수정</button>' +
        '<button class="btn-icon" onclick="openHistoryModal(\'' + esc(p.id) + '\')">이력</button>' +
        '<button class="btn-danger" onclick="deletePlan(\'' + esc(p.id) + '\')">삭제</button>' +
      '</div>' +
      '</div>';
  }).join('');
}

// ===== RENDER TASKS =====
function renderTasks() {
  var container = document.getElementById('task-list');
  var labelEl = document.getElementById('sort-label');
  if (labelEl) labelEl.textContent = getSortLabel();

  var sortEl = document.getElementById('t-sort');
  if (sortEl) sortEl.value = S.tSort;

  populatePlanSelects();

  var today = kstToday();
  var tasks = sortedTasks(filteredTasks());

  if (!container) return;
  if (tasks.length === 0) {
    container.innerHTML = '<div class="empty-state">조건에 맞는 할 일이 없습니다.</div>';
    return;
  }
  var nextStatusLabel = { todo: '진행 중', in_progress: '완료', done: '할 일' };
  container.innerHTML = tasks.map(function(t) {
    var plan = S.plans.find(function(p) { return p.id === t.plan_id; });
    var isOverdue = t.status !== 'done' && t.due_date && t.due_date < today;
    var dueStr = t.due_date ? '<span class="task-due' + (isOverdue ? ' overdue' : '') + '">' + (isOverdue ? '&#9888; ' : '') + esc(fmtDate(t.due_date)) + '</span>' : '';
    var tags = (t.tags || '').split(',').map(function(x) { return x.trim(); }).filter(Boolean);
    var tagHtml = tags.map(function(tag) { return '<span class="tag-chip">' + esc(tag) + '</span>'; }).join('');
    return '<div class="task-item">' +
      '<div class="task-item-main">' +
        '<div class="task-item-title' + (t.status === 'done' ? ' done-title' : '') + '">' + esc(t.title) + '</div>' +
        '<div class="task-item-meta">' +
          '<span class="badge badge-' + esc(t.status) + '">' + esc(statusLabel(t.status)) + '</span>' +
          '<span class="badge badge-' + esc(t.priority) + '">' + esc(priorityLabel(t.priority)) + '</span>' +
          dueStr +
          (plan ? '<span style="font-size:11px;color:var(--muted)">&#128203; ' + esc(plan.title) + '</span>' : '') +
          (t.estimated_minutes ? '<span style="font-size:11px;color:var(--muted)">' + esc(String(t.estimated_minutes)) + '분</span>' : '') +
        '</div>' +
        (tagHtml ? '<div style="margin-top:4px;">' + tagHtml + '</div>' : '') +
      '</div>' +
      '<div class="task-item-actions">' +
        '<button class="btn-icon" onclick="toggleTaskStatus(\'' + esc(t.id) + '\')">&rarr; ' + esc(nextStatusLabel[t.status] || '할 일') + '</button>' +
        '<button class="btn-icon" onclick="openTaskModal(\'' + esc(t.id) + '\')">수정</button>' +
        '<button class="btn-danger" onclick="deleteTask(\'' + esc(t.id) + '\')">삭제</button>' +
      '</div>' +
      '</div>';
  }).join('');
}

// ===== RENDER DO =====
function renderDo() {
  populateExecTaskSelect();
  var container = document.getElementById('do-content');
  if (!container) return;

  var execs = S.execs;
  if (S.doBlocked) {
    execs = execs.filter(function(e) { return e.blocker_reason && e.blocker_reason.trim() !== ''; });
  }

  var byTask = {};
  execs.forEach(function(e) {
    if (!byTask[e.task_id]) byTask[e.task_id] = [];
    byTask[e.task_id].push(e);
  });

  var taskIds = Object.keys(byTask);
  if (taskIds.length === 0) {
    container.innerHTML = S.doBlocked
      ? '<div class="empty-state">막힌 실행 기록이 없습니다.</div>'
      : '<div class="empty-state">실행 기록이 없습니다. 위 폼으로 추가해보세요.</div>';
    return;
  }

  var html = '';
  if (S.doBlocked) {
    html += '<div style="background:var(--orange-dim);border:1px solid var(--orange);border-radius:7px;padding:10px 14px;margin-bottom:16px;font-size:13px;color:var(--orange);font-weight:500;">막힌 기록만 표시 중 &nbsp;<button class="btn-sm" onclick="S.doBlocked=false;renderDo()">전체 보기</button></div>';
  }

  taskIds.forEach(function(taskId) {
    var task = S.tasks.find(function(t) { return t.id === taskId; });
    var taskTitle = task ? task.title : '(삭제된 할 일)';
    var plan = task && task.plan_id ? S.plans.find(function(p) { return p.id === task.plan_id; }) : null;
    var taskExecs = byTask[taskId].slice().sort(function(a, b) { return (a.start_at || '') > (b.start_at || '') ? -1 : 1; });

    html += '<div class="exec-group-title">' + esc(taskTitle) + (plan ? ' <span style="font-size:12px;font-weight:400;color:var(--muted)">· ' + esc(plan.title) + '</span>' : '') + '</div>';
    taskExecs.forEach(function(e) {
      var hasBlocker = e.blocker_reason && e.blocker_reason.trim();
      html += '<div class="exec-item">' +
        '<div class="exec-item-info">' +
          '<div class="exec-item-time">' +
            (e.start_at ? esc(fmtDatetime(e.start_at)) : '시작 미입력') +
            (e.end_at ? ' ~ ' + esc(fmtDatetime(e.end_at)) : '') +
            ' &nbsp;·&nbsp; ' + esc(String(e.actual_minutes || 0)) + '분' +
          '</div>' +
          (hasBlocker ? '<div class="exec-item-blocker">&#9888; ' + esc(e.blocker_reason) + '</div>' : '') +
        '</div>' +
        '<button class="btn-danger" onclick="deleteExec(\'' + esc(e.id) + '\')">삭제</button>' +
        '</div>';
    });
  });

  container.innerHTML = html;
}

// ===== RENDER SEE =====
function setSeeRating(n) {
  seeRating = n;
  document.querySelectorAll('.star-btn').forEach(function(btn, i) {
    if (i < n) btn.classList.add('active');
    else btn.classList.remove('active');
  });
}

function renderSee() {
  populatePlanSelects();
  var container = document.getElementById('see-content');
  if (!container) return;

  var today = kstToday();
  var planId = S.seePlan;

  var tasks = S.tasks;
  if (planId) tasks = tasks.filter(function(t) { return t.plan_id === planId; });

  var totalTasks = tasks.length;
  var doneTasks = tasks.filter(function(t) { return t.status === 'done'; }).length;
  var delayedTasks = tasks.filter(function(t) { return t.status !== 'done' && t.due_date && t.due_date < today; }).length;
  var taskIdSet = {};
  tasks.forEach(function(t) { taskIdSet[t.id] = true; });

  var blockedTaskIds = {};
  S.execs.forEach(function(e) {
    if (taskIdSet[e.task_id] && e.blocker_reason && e.blocker_reason.trim()) {
      blockedTaskIds[e.task_id] = true;
    }
  });
  var blockedCount = Object.keys(blockedTaskIds).length;

  var expectedMin = tasks.reduce(function(s, t) { return s + (t.estimated_minutes || 0); }, 0);
  var planExecs = S.execs.filter(function(e) { return taskIdSet[e.task_id]; });
  var actualMin = planExecs.reduce(function(s, e) { return s + (e.actual_minutes || 0); }, 0);
  var diffMin = actualMin - expectedMin;

  var doneRate = totalTasks > 0 ? Math.round(doneTasks / totalTasks * 100) : 0;
  var timeAccuracy = expectedMin > 0 ? Math.min(Math.round(actualMin / expectedMin * 100), 100) : 0;

  seeRating = S.see ? (S.see.rating || 0) : 0;

  var planArg = planId ? "'" + esc(planId) + "'" : "''";

  container.innerHTML =
    '<div class="stat-grid">' +
      '<div class="stat-cell" onclick="seeNavTasks(' + planArg + ", '', false)\">" +
        '<div class="stat-cell-num" style="color:var(--blue)">' + totalTasks + '</div>' +
        '<div class="stat-cell-label">계획 수 (할 일 전체)</div>' +
      '</div>' +
      '<div class="stat-cell" onclick="seeNavTasks(' + planArg + ", 'done', false)\">" +
        '<div class="stat-cell-num" style="color:var(--green)">' + doneTasks + '</div>' +
        '<div class="stat-cell-label">완료 수</div>' +
      '</div>' +
      '<div class="stat-cell" onclick="seeNavTasks(' + planArg + ", '', true)\">" +
        '<div class="stat-cell-num" style="color:var(--accent)">' + delayedTasks + '</div>' +
        '<div class="stat-cell-label">지연 수</div>' +
      '</div>' +
      '<div class="stat-cell" onclick="seeNavDo(true)">' +
        '<div class="stat-cell-num" style="color:var(--orange)">' + blockedCount + '</div>' +
        '<div class="stat-cell-label">막힘 수</div>' +
      '</div>' +
    '</div>' +

    '<div class="time-stats">' +
      '<div class="time-stat-box"><div class="time-stat-label">예상 합계</div><div class="time-stat-val">' + expectedMin + '분</div></div>' +
      '<div class="time-stat-box"><div class="time-stat-label">실제 합계</div><div class="time-stat-val">' + actualMin + '분</div></div>' +
      '<div class="time-stat-box"><div class="time-stat-label">차이 (실제 - 예상)</div><div class="time-stat-val" style="color:' + (diffMin > 0 ? 'var(--accent)' : diffMin < 0 ? 'var(--green)' : 'var(--primary)') + '">' + (diffMin > 0 ? '+' : '') + diffMin + '분</div></div>' +
    '</div>' +

    '<div class="progress-section">' +
      '<div class="progress-item">' +
        '<div class="progress-header"><span>달성률</span><span>' + doneRate + '%</span></div>' +
        '<div class="progress-bar-bg"><div class="progress-bar-fill" style="width:' + doneRate + '%;background:var(--green);"></div></div>' +
      '</div>' +
      '<div class="progress-item">' +
        '<div class="progress-header"><span>시간 정확도</span><span>' + timeAccuracy + '%</span></div>' +
        '<div class="progress-bar-bg"><div class="progress-bar-fill" style="width:' + timeAccuracy + '%;background:var(--blue);"></div></div>' +
      '</div>' +
    '</div>' +

    '<div class="reflection-form">' +
      '<div class="reflection-title">오늘의 돌아보기 <span style="font-size:14px;font-weight:400;color:var(--muted)">' + today + '</span></div>' +
      '<div class="form-group">' +
        '<label>만족도</label>' +
        '<div class="star-row" id="star-row">' +
          [1,2,3,4,5].map(function(n) { return '<button class="star-btn' + (seeRating >= n ? ' active' : '') + '" onclick="setSeeRating(' + n + ')">' + n + '</button>'; }).join('') +
        '</div>' +
      '</div>' +
      '<div class="form-group"><label>잘 된 것</label><textarea id="see-good" placeholder="오늘 잘 된 일을 적어보세요">' + esc(S.see ? S.see.good || '' : '') + '</textarea></div>' +
      '<div class="form-group"><label>아쉬운 것</label><textarea id="see-bad" placeholder="아쉬웠던 점을 적어보세요">' + esc(S.see ? S.see.bad || '' : '') + '</textarea></div>' +
      '<div class="form-group"><label>다음 계획에 반영할 것</label><textarea id="see-next" placeholder="다음 계획에 어떻게 반영할지 적어보세요">' + esc(S.see ? S.see.next_plan || '' : '') + '</textarea></div>' +
      '<div class="form-group"><label>이전 돌아보기에서 넘길 한 줄</label><textarea id="see-carry" placeholder="다음 계획으로 넘길 한 줄 메모">' + esc(S.see ? S.see.carry_forward || '' : '') + '</textarea></div>' +
      '<div class="see-actions">' +
        '<button class="btn-primary" onclick="saveSee()">저장</button>' +
        '<button class="btn-sm" onclick="nextPlanFromSee()">다음 계획으로 &rarr;</button>' +
      '</div>' +
    '</div>';
}

async function saveSee() {
  var see = {
    id: S.see ? S.see.id : uuid(),
    date: kstToday(),
    good: document.getElementById('see-good').value.trim(),
    bad: document.getElementById('see-bad').value.trim(),
    next_plan: document.getElementById('see-next').value.trim(),
    carry_forward: document.getElementById('see-carry').value.trim(),
    rating: seeRating,
    updated_at: new Date().toISOString(),
  };
  await DB.saveSee(see);
  alert('돌아보기가 저장되었습니다.');
}

async function nextPlanFromSee() {
  var carry = document.getElementById('see-carry').value.trim();
  if (!carry && !confirm('넘길 한 줄이 비어 있습니다. 그래도 계획을 만드시겠습니까?')) return;
  var plan = {
    id: uuid(),
    title: carry ? carry.slice(0, 60) : '새 계획',
    period_start: null,
    period_end: null,
    priority: 'medium',
    success_criteria: carry,
    estimated_minutes: 0,
    notes: '',
    created_at: new Date().toISOString(),
  };
  await DB.savePlan(plan);
  showTab('plan');
  renderPlans();
  populatePlanSelects();
}

// ===== RENDER ALL =====
function renderAll() {
  populatePlanSelects();
  renderPlans();
  renderTasks();
  renderDo();
  renderSee();
}

// ===== INIT =====
async function init() {
  var sbUrl = localStorage.getItem(LS.sbUrl);
  var sbKey = localStorage.getItem(LS.sbKey);
  if (sbUrl && sbKey && window.supabase) {
    try {
      SB = window.supabase.createClient(sbUrl, sbKey);
      SB.auth.onAuthStateChange(function(event, session) {
        checkAuthSession();
      });
    } catch(e) { SB = null; }
  }
  await DB.loadAll();
  renderAll();
  updateDbStatus();
  await checkAuthSession();
}


// ===== SUPABASE AUTH & LOGIN (T07) =====
function openAuthModal() {
  var errEl = document.getElementById('auth-error-msg');
  if (errEl) errEl.style.display = 'none';
  openModal('modal-auth');
}

function showAuthError(msg) {
  var errEl = document.getElementById('auth-error-msg');
  if (errEl) {
    errEl.textContent = msg;
    errEl.style.display = 'block';
  } else {
    alert(msg);
  }
}

async function handleSignUp() {
  var email = document.getElementById('auth-email').value.trim();
  var password = document.getElementById('auth-password').value.trim();
  if (!email || !password) { showAuthError('이메일과 비밀번호를 모두 입력하세요.'); return; }
  if (password.length < 6) { showAuthError('비밀번호는 최소 6자 이상이어야 합니다.'); return; }
  if (!SB) { showAuthError('먼저 [DB 연결]에서 Supabase URL과 키를 설정하세요.'); return; }

  try {
    var res = await SB.auth.signUp({ email: email, password: password });
    if (res.error) {
      showAuthError('회원가입 오류: ' + res.error.message);
    } else {
      alert('회원가입이 완료되었습니다! ' + (res.data.user && res.data.user.identities && res.data.user.identities.length === 0 ? '이미 등록된 이메일일 수 있습니다.' : '로그인되었습니다.'));
      closeModal('modal-auth');
      await checkAuthSession();
    }
  } catch(e) {
    showAuthError('회원가입 예외: ' + e.message);
  }
}

async function handleSignIn() {
  var email = document.getElementById('auth-email').value.trim();
  var password = document.getElementById('auth-password').value.trim();
  if (!email || !password) { showAuthError('이메일과 비밀번호를 모두 입력하세요.'); return; }
  if (!SB) { showAuthError('먼저 [DB 연결]에서 Supabase URL과 키를 설정하세요.'); return; }

  try {
    var res = await SB.auth.signInWithPassword({ email: email, password: password });
    if (res.error) {
      showAuthError('로그인 실패: ' + res.error.message);
    } else {
      closeModal('modal-auth');
      await checkAuthSession();
      await DB.loadAll();
      renderAll();
      alert('로그인되었습니다: ' + res.data.user.email);
    }
  } catch(e) {
    showAuthError('로그인 예외: ' + e.message);
  }
}

async function handleSignOut() {
  if (!confirm('로그아웃 하시겠습니까?')) return;
  if (SB) {
    await SB.auth.signOut();
  }
  await checkAuthSession();
  await DB.loadAll();
  renderAll();
  alert('로그아웃되었습니다.');
}

async function checkAuthSession() {
  var emailDisplay = document.getElementById('user-email-display');
  var loginBtn = document.getElementById('btn-open-auth-modal');
  var logoutBtn = document.getElementById('btn-sign-out');

  if (!SB) {
    if (emailDisplay) emailDisplay.style.display = 'none';
    if (loginBtn) loginBtn.style.display = 'inline-block';
    if (logoutBtn) logoutBtn.style.display = 'none';
    return;
  }

  try {
    var sessionRes = await SB.auth.getSession();
    var session = sessionRes.data && sessionRes.data.session;
    if (session && session.user) {
      if (emailDisplay) {
        emailDisplay.textContent = '👤 ' + session.user.email;
        emailDisplay.style.display = 'inline-block';
      }
      if (loginBtn) loginBtn.style.display = 'none';
      if (logoutBtn) logoutBtn.style.display = 'inline-block';
    } else {
      if (emailDisplay) emailDisplay.style.display = 'none';
      if (loginBtn) loginBtn.style.display = 'inline-block';
      if (logoutBtn) logoutBtn.style.display = 'none';
    }
  } catch(e) {
    if (emailDisplay) emailDisplay.style.display = 'none';
    if (loginBtn) loginBtn.style.display = 'inline-block';
    if (logoutBtn) logoutBtn.style.display = 'none';
  }
}


document.addEventListener('DOMContentLoaded', init);