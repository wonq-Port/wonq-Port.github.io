// ===== CONSTANTS & STORAGE KEYS =====
const BASE_LS = {
  plans: 'pds2_plans',
  planVers: 'pds2_plan_versions',
  tasks: 'pds2_tasks',
  execs: 'pds2_executions',
  sees: 'pds2_sees',
  sbUrl: 'pds2_sb_url',
  sbKey: 'pds2_sb_key',
};

const LS = Object.assign({}, BASE_LS);
const ACCOUNTS_STORAGE_KEY = 'pds_accounts_v2';

function readSessionUser() {
  try {
    var raw = localStorage.getItem('pds_user');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function applyUserStorageScope(username) {
  var clean = (username || '').trim().toLowerCase().replace(/[^a-z0-9가-힣_-]/g, '_');
  ['plans', 'planVers', 'tasks', 'execs', 'sees'].forEach(function(key) {
    LS[key] = clean ? (BASE_LS[key] + '_' + clean) : BASE_LS[key];
  });
}

var initialUser = readSessionUser();
if (initialUser && initialUser.username) {
  applyUserStorageScope(initialUser.username);
}

function loadLocalAccounts() {
  try {
    var raw = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
    var parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function saveLocalAccounts(accounts) {
  try {
    localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
  } catch (e) {}
}

// ===== STATE =====
const S = {
  plans: [],
  planVers: [],
  tasks: [],
  execs: [],
  see: null,
  tSearch: '',
  tPlan: '',
  tStatus: '',
  tPrio: '',
  tTag: '',
  tDelayed: false,
  tSort: 'priority',
  tDir: 'asc',
  seePlan: '',
  doBlocked: false,
  pending: new Set(),
  editPlanId: null,
  editTaskId: null,
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

function priorityOrder(p) {
  return p === 'high' ? 1 : p === 'medium' ? 2 : 3;
}

function statusLabel(s) {
  return s === 'todo' ? '할 일' : s === 'in_progress' ? '진행 중' : '완료';
}

function statusBadgeClass(s) {
  return s === 'todo' ? 'badge-todo' : s === 'in_progress' ? 'badge-in_progress' : 'badge-done';
}

function prioBadgeClass(p) {
  return p === 'high' ? 'badge-high' : p === 'medium' ? 'badge-medium' : 'badge-low';
}

function isDelayed(t) {
  if (!t.due_date) return false;
  if (t.status === 'done') return false;
  return fmtDate(t.due_date) < kstToday();
}

function lsLoad(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch(e) { return []; }
}

function lsSave(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

// 중복된 ID 중 사용자가 실제 값을 입력한 필드를 우선 탐색하는 헬퍼 함수
function getVal(idList) {
  for (var i = 0; i < idList.length; i++) {
    var el = document.getElementById(idList[i]);
    if (el && el.value && el.value.trim().length > 0) {
      return el.value.trim();
    }
  }
  return '';
}

// ===== DB OPERATIONS =====
const DB = {
  loadAll: async function() {
    if (SB) {
      try {
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
        return;
      } catch(e) {
        console.warn('Supabase 로드 오류, 로컬스토리지 대체:', e);
      }
    }
    S.plans = lsLoad(LS.plans);
    S.planVers = lsLoad(LS.planVers);
    S.tasks = lsLoad(LS.tasks);
    S.execs = lsLoad(LS.execs);
    var sees = lsLoad(LS.sees);
    S.see = sees.find(function(r) { return r.date === kstToday(); }) || null;
  },

  savePlan: async function(plan) {
    if (SB) {
      try { await SB.from('plans').upsert(plan); } catch(e) {}
    }
    var arr = lsLoad(LS.plans);
    var i = arr.findIndex(function(p) { return p.id === plan.id; });
    if (i >= 0) arr[i] = plan; else arr.push(plan);
    lsSave(LS.plans, arr);

    S.plans = S.plans.filter(function(p) { return p.id !== plan.id; });
    S.plans.push(plan);
  },

  deletePlan: async function(id) {
    if (SB) {
      try { await SB.from('plans').delete().eq('id', id); } catch(e) {}
    }
    lsSave(LS.plans, lsLoad(LS.plans).filter(function(p) { return p.id !== id; }));
    lsSave(LS.planVers, lsLoad(LS.planVers).filter(function(v) { return v.plan_id !== id; }));
    lsSave(LS.tasks, lsLoad(LS.tasks).map(function(t) { return t.plan_id === id ? Object.assign({}, t, { plan_id: null }) : t; }));

    S.plans = S.plans.filter(function(p) { return p.id !== id; });
    S.planVers = S.planVers.filter(function(v) { return v.plan_id !== id; });
    S.tasks = S.tasks.map(function(t) { return t.plan_id === id ? Object.assign({}, t, { plan_id: null }) : t; });
  },

  savePlanVer: async function(ver) {
    if (SB) {
      try { await SB.from('plan_versions').insert(ver); } catch(e) {}
    }
    var arr = lsLoad(LS.planVers);
    arr.push(ver);
    lsSave(LS.planVers, arr);
    S.planVers.push(ver);
  },

  saveTask: async function(task) {
    if (SB) {
      try { await SB.from('tasks').upsert(task); } catch(e) {}
    }
    var arr = lsLoad(LS.tasks);
    var i = arr.findIndex(function(t) { return t.id === task.id; });
    if (i >= 0) arr[i] = task; else arr.push(task);
    lsSave(LS.tasks, arr);

    S.tasks = S.tasks.filter(function(t) { return t.id !== task.id; });
    S.tasks.push(task);
  },

  deleteTask: async function(id) {
    if (SB) {
      try { await SB.from('tasks').delete().eq('id', id); } catch(e) {}
    }
    lsSave(LS.tasks, lsLoad(LS.tasks).filter(function(t) { return t.id !== id; }));
    lsSave(LS.execs, lsLoad(LS.execs).filter(function(e) { return e.task_id !== id; }));

    S.tasks = S.tasks.filter(function(t) { return t.id !== id; });
    S.execs = S.execs.filter(function(e) { return e.task_id !== id; });
  },

  saveExec: async function(exec) {
    if (SB) {
      try { await SB.from('executions').insert(exec); } catch(e) {}
    }
    var arr = lsLoad(LS.execs);
    arr.push(exec);
    lsSave(LS.execs, arr);
    S.execs.push(exec);
  },

  deleteExec: async function(id) {
    if (SB) {
      try { await SB.from('executions').delete().eq('id', id); } catch(e) {}
    }
    lsSave(LS.execs, lsLoad(LS.execs).filter(function(e) { return e.id !== id; }));
    S.execs = S.execs.filter(function(e) { return e.id !== id; });
  },

  saveSee: async function(see) {
    if (SB) {
      try { await SB.from('sees').upsert(see, { onConflict: 'date' }); } catch(e) {}
    }
    var arr = lsLoad(LS.sees);
    var i = arr.findIndex(function(s) { return s.date === see.date; });
    if (i >= 0) arr[i] = see; else arr.push(see);
    lsSave(LS.sees, arr);
    S.see = see;
  },
};

// ===== PLAN EDIT WITH VERSION HISTORY =====
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

// ===== TOGGLE TASK STATUS =====
async function toggleTaskStatus(id) {
  var task = S.tasks.find(function(t) { return t.id === id; });
  if (!task) return;
  var cycle = { todo: 'in_progress', in_progress: 'done', done: 'todo' };
  var newStatus = cycle[task.status] || 'todo';
  var completed_at = newStatus === 'done' ? new Date().toISOString() : null;
  await DB.saveTask(Object.assign({}, task, { status: newStatus, completed_at: completed_at }));
  renderTasks();
}

// ===== EXECUTION AUTO-CALCULATION =====
function autoCalcMinutes() {
  var sv = document.getElementById('exec-start') ? document.getElementById('exec-start').value : '';
  var ev = document.getElementById('exec-end') ? document.getElementById('exec-end').value : '';
  if (!sv || !ev) return;
  var s = new Date(sv);
  var e = new Date(ev);
  var diff = Math.round((e - s) / 60000);
  if (diff >= 0) {
    var minEl = document.getElementById('exec-minutes') || document.getElementById('exec-actual');
    if (minEl) minEl.value = diff;
  }
}

// ===== SUBMIT EXECUTION =====
async function submitExec() {
  var taskEl = document.getElementById('exec-task');
  var taskId = taskEl ? taskEl.value : '';
  if (!taskId) { alert('할 일을 선택하세요.'); return; }
  if (S.pending.has(taskId)) return;

  var sv = document.getElementById('exec-start') ? document.getElementById('exec-start').value : '';
  var ev = document.getElementById('exec-end') ? document.getElementById('exec-end').value : '';
  var minEl = document.getElementById('exec-minutes') || document.getElementById('exec-actual');
  var actual = minEl ? (parseInt(minEl.value) || 0) : 0;
  var blockerEl = document.getElementById('exec-blocker');
  var blocker = blockerEl ? blockerEl.value.trim() : '';

  if (sv && ev && new Date(ev) < new Date(sv)) {
    alert('종료 시각은 시작 시각 이후여야 합니다.');
    return;
  }

  S.pending.add(taskId);
  try {
    var exec = {
      id: uuid(),
      task_id: taskId,
      start_at: sv ? new Date(sv).toISOString() : null,
      end_at: ev ? new Date(ev).toISOString() : null,
      actual_minutes: actual,
      blocker_reason: blocker,
      created_at: new Date().toISOString(),
    };
    await DB.saveExec(exec);

    var task = S.tasks.find(function(t) { return t.id === taskId; });
    if (task && task.status !== 'done') {
      await DB.saveTask(Object.assign({}, task, { status: 'done', completed_at: new Date().toISOString() }));
    }

    if (document.getElementById('exec-start')) document.getElementById('exec-start').value = '';
    if (document.getElementById('exec-end')) document.getElementById('exec-end').value = '';
    if (minEl) minEl.value = '';
    if (blockerEl) blockerEl.value = '';
    renderDo();
    renderTasks();
  } finally {
    S.pending.delete(taskId);
  }
}

// ===== TABS & MODALS NAVIGATION =====
function showTab(name) {
  S.activeTab = name;
  document.querySelectorAll('.tab-btn').forEach(function(b) {
    b.classList.toggle('active', b.getAttribute('data-tab') === name);
  });
  document.querySelectorAll('.tab-panel').forEach(function(p) {
    p.classList.toggle('active', p.id === 'tab-' + name);
  });
  if (name === 'tasks') renderTasks();
  if (name === 'do') renderDo();
  if (name === 'see') renderSee();
  if (name === 'plan') renderPlans();
}

function openModal(id) {
  var el = document.getElementById(id);
  if (el) el.classList.add('open');
}

function closeModal(id) {
  var el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

function openPlanModal(id) {
  S.editPlanId = id || null;
  var titleEl = document.getElementById('modal-plan-title');
  var prioSelect = document.getElementById('plan-prio') || document.getElementById('plan-priority');
  if (id) {
    var p = S.plans.find(function(x) { return x.id === id; });
    if (!p) return;
    if (titleEl) titleEl.textContent = '계획 수정';
    if (document.getElementById('plan-title')) document.getElementById('plan-title').value = p.title || '';
    if (document.getElementById('plan-start')) document.getElementById('plan-start').value = fmtDate(p.period_start);
    if (document.getElementById('plan-end')) document.getElementById('plan-end').value = fmtDate(p.period_end);
    if (prioSelect) prioSelect.value = p.priority || 'medium';
    if (document.getElementById('plan-criteria')) document.getElementById('plan-criteria').value = p.success_criteria || '';
    if (document.getElementById('plan-minutes')) document.getElementById('plan-minutes').value = p.estimated_minutes || '';
    if (document.getElementById('plan-notes')) document.getElementById('plan-notes').value = p.notes || '';
  } else {
    if (titleEl) titleEl.textContent = '새 계획 만들기';
    if (document.getElementById('plan-title')) document.getElementById('plan-title').value = '';
    if (document.getElementById('plan-start')) document.getElementById('plan-start').value = '';
    if (document.getElementById('plan-end')) document.getElementById('plan-end').value = '';
    if (prioSelect) prioSelect.value = 'medium';
    if (document.getElementById('plan-criteria')) document.getElementById('plan-criteria').value = '';
    if (document.getElementById('plan-minutes')) document.getElementById('plan-minutes').value = '';
    if (document.getElementById('plan-notes')) document.getElementById('plan-notes').value = '';
  }
  openModal('modal-plan');
}

async function savePlan() {
  var titleEl = document.getElementById('plan-title');
  var title = titleEl ? titleEl.value.trim() : '';
  if (!title) { alert('계획 제목을 입력하세요.'); return; }
  var start = document.getElementById('plan-start') ? document.getElementById('plan-start').value : null;
  var end = document.getElementById('plan-end') ? document.getElementById('plan-end').value : null;
  if (start && end && end < start) { alert('종료일은 시작일 이후여야 합니다.'); return; }

  var prio = getVal(['plan-prio', 'plan-priority']) || 'medium';
  var critEl = document.getElementById('plan-criteria');
  var minEl = document.getElementById('plan-minutes');
  var notesEl = document.getElementById('plan-notes');

  var data = {
    title: title,
    period_start: start || null,
    period_end: end || null,
    priority: prio,
    success_criteria: critEl ? critEl.value.trim() : '',
    estimated_minutes: minEl ? (parseInt(minEl.value) || 0) : 0,
    notes: notesEl ? notesEl.value.trim() : '',
  };

  if (S.editPlanId) {
    await savePlanEdit(S.editPlanId, data);
  } else {
    data.id = uuid();
    data.created_at = new Date().toISOString();
    await DB.savePlan(data);
  }
  closeModal('modal-plan');
  renderPlans();
  populatePlanSelects();
}

async function deletePlan(id) {
  if (!confirm('계획을 삭제하시겠습니까? 연결된 할 일은 계획 없음으로 유지됩니다.')) return;
  await DB.deletePlan(id);
  renderPlans();
  populatePlanSelects();
}

function openHistoryModal(planId) {
  var plan = S.plans.find(function(p) { return p.id === planId; });
  if (!plan) return;
  var vers = S.planVers.filter(function(v) { return v.plan_id === planId; })
    .sort(function(a,b) { return b.version_num - a.version_num; });
  var titleEl = document.getElementById('history-plan-title');
  if (titleEl) titleEl.textContent = '"' + plan.title + '" 수정 이력 (' + vers.length + '건)';
  var body = document.getElementById('history-list');
  if (!body) return;
  if (vers.length === 0) {
    body.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:12px 0;">수정 이력이 없습니다.</div>';
  } else {
    body.innerHTML = vers.map(function(v) {
      return '<div class="history-item">' +
        '<div class="history-ver">v' + v.version_num + ' &mdash; ' + fmtDatetime(v.saved_at) + ' 저장된 이전 값</div>' +
        '<div style="font-weight:600;margin-bottom:3px;">' + esc(v.title) + '</div>' +
        '<div style="font-size:12px;color:var(--secondary);">' +
          (v.period_start || v.period_end ? (fmtDate(v.period_start) + ' ~ ' + fmtDate(v.period_end) + ' | ') : '') +
          '우선순위: ' + priorityLabel(v.priority) +
          (v.estimated_minutes ? ' | ' + v.estimated_minutes + '분' : '') +
        '</div>' +
        (v.success_criteria ? '<div style="font-size:12px;color:var(--muted);margin-top:2px;">기준: ' + esc(v.success_criteria) + '</div>' : '') +
      '</div>';
    }).join('');
  }
  openModal('modal-history');
}

function openTaskModal(id) {
  S.editTaskId = id || null;
  populateTaskPlanSelect();
  var titleEl = document.getElementById('modal-task-title');
  var prioSelect = document.getElementById('task-prio') || document.getElementById('task-priority');
  if (id) {
    var t = S.tasks.find(function(x) { return x.id === id; });
    if (!t) return;
    if (titleEl) titleEl.textContent = '할 일 수정';
    if (document.getElementById('task-plan-id')) document.getElementById('task-plan-id').value = t.plan_id || '';
    if (document.getElementById('task-title')) document.getElementById('task-title').value = t.title || '';
    if (document.getElementById('task-due')) document.getElementById('task-due').value = fmtDate(t.due_date);
    if (prioSelect) prioSelect.value = t.priority || 'medium';
    if (document.getElementById('task-tags')) document.getElementById('task-tags').value = t.tags || '';
    if (document.getElementById('task-minutes')) document.getElementById('task-minutes').value = t.estimated_minutes || '';
    if (document.getElementById('task-notes')) document.getElementById('task-notes').value = t.notes || '';
  } else {
    if (titleEl) titleEl.textContent = '새 할 일 만들기';
    if (document.getElementById('task-plan-id')) document.getElementById('task-plan-id').value = S.tPlan || '';
    if (document.getElementById('task-title')) document.getElementById('task-title').value = '';
    if (document.getElementById('task-due')) document.getElementById('task-due').value = '';
    if (prioSelect) prioSelect.value = 'medium';
    if (document.getElementById('task-tags')) document.getElementById('task-tags').value = '';
    if (document.getElementById('task-minutes')) document.getElementById('task-minutes').value = '';
    if (document.getElementById('task-notes')) document.getElementById('task-notes').value = '';
  }
  openModal('modal-task');
}

async function saveTask() {
  var titleEl = document.getElementById('task-title');
  var title = titleEl ? titleEl.value.trim() : '';
  if (!title) { alert('할 일 제목을 입력하세요.'); return; }
  var planId = document.getElementById('task-plan-id') ? document.getElementById('task-plan-id').value || null : null;
  var due = document.getElementById('task-due') ? document.getElementById('task-due').value || null : null;
  var prio = getVal(['task-prio', 'task-priority']) || 'medium';
  var tagsEl = document.getElementById('task-tags');
  var minEl = document.getElementById('task-minutes');
  var notesEl = document.getElementById('task-notes');

  var task;
  if (S.editTaskId) {
    var current = S.tasks.find(function(t) { return t.id === S.editTaskId; });
    task = Object.assign({}, current, {
      plan_id: planId,
      title: title,
      due_date: due,
      priority: prio,
      tags: tagsEl ? tagsEl.value.trim() : '',
      estimated_minutes: minEl ? (parseInt(minEl.value) || 0) : 0,
      notes: notesEl ? notesEl.value.trim() : '',
    });
    await DB.saveTask(task);
  } else {
    task = {
      id: uuid(),
      plan_id: planId,
      title: title,
      status: 'todo',
      due_date: due,
      priority: prio,
      tags: tagsEl ? tagsEl.value.trim() : '',
      estimated_minutes: minEl ? (parseInt(minEl.value) || 0) : 0,
      notes: notesEl ? notesEl.value.trim() : '',
      completed_at: null,
      created_at: new Date().toISOString(),
    };
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
    if (byPlan[p.id] && byPlan[p.id].length > 0) {
      html += '<optgroup label="' + esc(p.title) + '">';
      byPlan[p.id].forEach(function(t) {
        html += '<option value="' + esc(t.id) + '">' + esc(t.title) + ' (' + statusLabel(t.status) + ')</option>';
      });
      html += '</optgroup>';
    }
  });
  if (noPlan.length > 0) {
    html += '<optgroup label="계획 없음">';
    noPlan.forEach(function(t) {
      html += '<option value="' + esc(t.id) + '">' + esc(t.title) + ' (' + statusLabel(t.status) + ')</option>';
    });
    html += '</optgroup>';
  }
  el.innerHTML = html;
}

// ===== RENDER PLANS =====
function renderPlans() {
  var list = document.getElementById('plan-list');
  if (!list) return;
  if (S.plans.length === 0) {
    list.innerHTML = '<div class="empty-state">세워둔 계획이 없습니다. <strong>+ 새 계획</strong> 버튼을 눌러 첫 계획을 세워보세요.</div>';
    return;
  }
  list.innerHTML = S.plans.map(function(p) {
    var vCount = S.planVers.filter(function(v) { return v.plan_id === p.id; }).length;
    var planTasks = S.tasks.filter(function(t) { return t.plan_id === p.id; });
    var doneTasks = planTasks.filter(function(t) { return t.status === 'done'; });
    var progress = planTasks.length > 0 ? Math.round((doneTasks.length / planTasks.length) * 100) : 0;

    return '<div class="card plan-card">' +
      '<div class="card-header">' +
        '<div class="card-content">' +
          '<div class="card-heading">' +
            '<span class="badge ' + prioBadgeClass(p.priority) + '">' + priorityLabel(p.priority) + '</span>' +
            '<span class="card-title">' + esc(p.title) + '</span>' +
          '</div>' +
          '<div class="card-meta">' +
            (p.period_start || p.period_end ? '<span class="meta-item meta-date"><span class="meta-label">기간</span>' + fmtDate(p.period_start) + ' — ' + fmtDate(p.period_end) + '</span>' : '') +
            (p.estimated_minutes ? '<span class="meta-item"><span class="meta-label">예상</span>' + p.estimated_minutes + '분</span>' : '') +
            '<span class="meta-item meta-progress"><span class="meta-label">할 일</span>' + doneTasks.length + '/' + planTasks.length + ' · ' + progress + '%</span>' +
          '</div>' +
        '</div>' +
        '<div class="card-actions">' +
          (vCount > 0 ? '<button class="btn-icon" onclick="openHistoryModal(\'' + p.id + '\')">수정 이력 (' + vCount + ')</button>' : '') +
          '<button class="btn-icon" onclick="openPlanModal(\'' + p.id + '\')">수정</button>' +
          '<button class="btn-danger" onclick="deletePlan(\'' + p.id + '\')">삭제</button>' +
        '</div>' +
      '</div>' +
      (p.success_criteria ? '<div class="card-description"><strong>성공 기준</strong>' + esc(p.success_criteria) + '</div>' : '') +
      (p.notes ? '<div class="card-note">' + esc(p.notes) + '</div>' : '') +
    '</div>';
  }).join('');
}

// ===== RENDER TASKS =====
function renderTasks() {
  var list = document.getElementById('task-list');
  if (!list) return;

  var q = S.tSearch.toLowerCase();
  var filtered = S.tasks.filter(function(t) {
    if (q && t.title.toLowerCase().indexOf(q) === -1 && (!t.tags || t.tags.toLowerCase().indexOf(q) === -1)) return false;
    if (S.tPlan && t.plan_id !== S.tPlan) return false;
    if (S.tStatus && t.status !== S.tStatus) return false;
    if (S.tPrio && t.priority !== S.tPrio) return false;
    if (S.tTag && (!t.tags || t.tags.indexOf(S.tTag) === -1)) return false;
    if (S.tDelayed && !isDelayed(t)) return false;
    return true;
  });

  filtered.sort(function(a, b) {
    var d = S.tDir === 'asc' ? 1 : -1;
    if (S.tSort === 'priority') {
      var pa = priorityOrder(a.priority);
      var pb = priorityOrder(b.priority);
      return (pa - pb) * d;
    }
    if (S.tSort === 'due_date') {
      var da = a.due_date || '9999-99-99';
      var db = b.due_date || '9999-99-99';
      return da.localeCompare(db) * d;
    }
    if (S.tSort === 'created_at') {
      return (new Date(a.created_at || 0) - new Date(b.created_at || 0)) * d;
    }
    return 0;
  });

  var countEl = document.getElementById('task-count');
  if (countEl) countEl.textContent = '총 ' + filtered.length + '개';

  var delayedFilterBtn = document.getElementById('btn-filter-delayed');
  if (delayedFilterBtn) delayedFilterBtn.classList.toggle('active', S.tDelayed);

  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty-state">해당 조건에 맞는 할 일이 없습니다.</div>';
    return;
  }

  list.innerHTML = filtered.map(function(t) {
    var plan = S.plans.find(function(p) { return p.id === t.plan_id; });
    var delayed = isDelayed(t);
    var tags = (t.tags || '').split(',').map(function(s) { return s.trim(); }).filter(Boolean);

    return '<div class="card' + (t.status === 'done' ? ' done' : '') + '">' +
      '<div class="card-header">' +
        '<div class="card-content">' +
          '<div class="card-heading">' +
            '<button type="button" class="status-btn ' + statusBadgeClass(t.status) + '" onclick="toggleTaskStatus(\'' + t.id + '\')" title="클릭하여 상태 변경" aria-label="' + esc(t.title) + ' 상태 변경: ' + statusLabel(t.status) + '">' + statusLabel(t.status) + '</button>' +
            '<span class="badge ' + prioBadgeClass(t.priority) + '">' + priorityLabel(t.priority) + '</span>' +
            (delayed ? '<span class="badge badge-delayed">지연됨</span>' : '') +
            '<span class="card-title">' + esc(t.title) + '</span>' +
          '</div>' +
          '<div class="card-meta">' +
            (plan ? '<span class="meta-item"><span class="meta-label">계획</span>' + esc(plan.title) + '</span>' : '') +
            (t.due_date ? '<span class="meta-item meta-date"><span class="meta-label">마감</span>' + fmtDate(t.due_date) + '</span>' : '') +
            (t.estimated_minutes ? '<span class="meta-item"><span class="meta-label">예상</span>' + t.estimated_minutes + '분</span>' : '') +
            '<span class="meta-item"><span class="meta-label">등록</span>' + fmtCreated(t.created_at) + '</span>' +
          '</div>' +
          (tags.length > 0 ? '<div style="margin-top:4px;">' + tags.map(function(tg) { return '<span class="badge" style="background:var(--surface-hi);color:var(--secondary);margin-right:4px;">#' + esc(tg) + '</span>'; }).join('') + '</div>' : '') +
          (t.notes ? '<div style="font-size:12px;color:var(--muted);margin-top:4px;">' + esc(t.notes) + '</div>' : '') +
        '</div>' +
        '<div class="card-actions">' +
          '<button class="btn-icon" onclick="openTaskModal(\'' + t.id + '\')">수정</button>' +
          '<button class="btn-danger" onclick="deleteTask(\'' + t.id + '\')">삭제</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

// ===== RENDER DO (EXECUTIONS) =====
function renderDo() {
  populateExecTaskSelect();
  var list = document.getElementById('exec-list') || document.getElementById('do-content');
  if (!list) return;

  var q = S.doBlocked;
  var filtered = S.execs.filter(function(e) {
    if (q && !e.blocker_reason) return false;
    return true;
  });
  filtered.sort(function(a, b) {
    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
  });

  var totalMin = S.execs.reduce(function(acc, e) { return acc + (e.actual_minutes || 0); }, 0);
  var blockedCount = S.execs.filter(function(e) { return Boolean(e.blocker_reason); }).length;
  var sumEl = document.getElementById('do-summary');
  if (sumEl) sumEl.textContent = '총 실행 ' + S.execs.length + '회 | 누적 ' + totalMin + '분' + (blockedCount > 0 ? ' | 막힘 ' + blockedCount + '건' : '');

  var blockedBtn = document.getElementById('btn-filter-blocked');
  if (blockedBtn) blockedBtn.classList.toggle('active', S.doBlocked);

  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty-state">실행 기록이 없습니다. 위 폼에서 실행 완료 기록을 남겨보세요.</div>';
    return;
  }

  list.innerHTML = filtered.map(function(e) {
    var task = S.tasks.find(function(t) { return t.id === e.task_id; });
    var taskTitle = task ? task.title : '(삭제된 할 일)';
    var plan = task && task.plan_id ? S.plans.find(function(p) { return p.id === task.plan_id; }) : null;

    return '<div class="card">' +
      '<div class="card-header">' +
        '<div style="flex:1;">' +
          '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">' +
            '<span class="card-title">' + esc(taskTitle) + '</span>' +
            (e.actual_minutes ? '<span class="badge badge-done">' + e.actual_minutes + '분 수행</span>' : '') +
          '</div>' +
          '<div class="card-meta">' +
            (plan ? '계획: ' + esc(plan.title) + ' | ' : '') +
            (e.start_at ? fmtDatetime(e.start_at) : '') +
            (e.start_at && e.end_at ? ' ~ ' + fmtDatetime(e.end_at) : '') +
          '</div>' +
          (e.blocker_reason ? '<div style="margin-top:6px;font-size:12px;color:var(--accent);background:var(--accent-dim);padding:4px 8px;border-radius:4px;"><strong>막혔던 점:</strong> ' + esc(e.blocker_reason) + '</div>' : '') +
        '</div>' +
        '<div class="card-actions">' +
          '<button class="btn-danger" onclick="deleteExec(\'' + e.id + '\')">삭제</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

// ===== RENDER SEE (REFLECTION) =====
function renderSee() {
  populatePlanSelects();
  var planTasks = S.tasks.filter(function(t) {
    return !S.seePlan || t.plan_id === S.seePlan;
  });
  var totalTasks = planTasks.length;
  var doneTasks = planTasks.filter(function(t) { return t.status === 'done'; }).length;
  var delayedTasks = planTasks.filter(function(t) { return isDelayed(t); }).length;
  var blockedExecs = S.execs.filter(function(e) {
    if (!e.blocker_reason) return false;
    if (!S.seePlan) return true;
    var task = S.tasks.find(function(t) { return t.id === e.task_id; });
    return task && task.plan_id === S.seePlan;
  }).length;

  var planCount = S.seePlan ? 1 : S.plans.length;
  var today = kstToday();
  if (S.see && S.see.date === today) {
    seeRating = S.see.rating || 0;
  }

  var c = document.getElementById('see-container') || document.getElementById('see-content');
  if (!c) return;
  c.innerHTML =
    '<div class="stat-grid">' +
      '<div class="stat-card" onclick="goPlans()"><div class="stat-num">' + planCount + '</div><div class="stat-label">계획 수</div></div>' +
      '<div class="stat-card" onclick="goTasksWithFilter(\'done\')"><div class="stat-num" style="color:var(--green)">' + doneTasks + '</div><div class="stat-label">완료한 할 일</div></div>' +
      '<div class="stat-card" onclick="goTasksWithFilter(\'delayed\')"><div class="stat-num" style="color:var(--accent)">' + delayedTasks + '</div><div class="stat-label">지연된 할 일</div></div>' +
      '<div class="stat-card" onclick="goDoBlocked()"><div class="stat-num" style="color:var(--orange)">' + blockedExecs + '</div><div class="stat-label">막힘 발생</div></div>' +
    '</div>' +

    '<div class="reflection-form">' +
      '<div class="reflection-title">오늘의 돌아보기 <span style="font-size:14px;font-weight:400;color:var(--muted)">' + today + '</span></div>' +
      '<div class="form-group">' +
        '<label>만족도</label>' +
        '<div class="star-row" id="star-row">' +
          [1,2,3,4,5].map(function(n) { return '<button type="button" class="star-btn' + (seeRating >= n ? ' active' : '') + '" onclick="setSeeRating(' + n + ')">' + n + '</button>'; }).join('') +
        '</div>' +
      '</div>' +
      '<div class="form-group"><label>잘 된 것</label><textarea id="see-good" placeholder="오늘 잘 된 일을 적어보세요">' + esc(S.see ? S.see.good || '' : '') + '</textarea></div>' +
      '<div class="form-group"><label>아쉬운 것</label><textarea id="see-bad" placeholder="아쉬웠던 점을 적어보세요">' + esc(S.see ? S.see.bad || '' : '') + '</textarea></div>' +
      '<div class="form-group"><label>다음 계획에 반영할 것</label><textarea id="see-next" placeholder="다음 계획에 어떻게 반영할지 적어보세요">' + esc(S.see ? S.see.next_plan || '' : '') + '</textarea></div>' +
      '<div class="form-group"><label>이전 돌아보기에서 넘길 한 줄</label><textarea id="see-carry" placeholder="다음 계획으로 넘길 한 줄 메모">' + esc(S.see ? S.see.carry_forward || '' : '') + '</textarea></div>' +
      '<div class="see-actions">' +
        '<button type="button" class="btn-primary" onclick="saveSee()">저장</button>' +
        '<button type="button" class="btn-sm" onclick="nextPlanFromSee()">다음 계획으로 &rarr;</button>' +
      '</div>' +
    '</div>';
}

function setSeeRating(n) {
  seeRating = n;
  var row = document.getElementById('star-row');
  if (row) {
    row.querySelectorAll('.star-btn').forEach(function(b, idx) {
      b.classList.toggle('active', idx < n);
    });
  }
}

async function saveSee() {
  var goodEl = document.getElementById('see-good');
  var badEl = document.getElementById('see-bad');
  var nextEl = document.getElementById('see-next');
  var carryEl = document.getElementById('see-carry');

  var see = {
    id: S.see ? S.see.id : uuid(),
    date: kstToday(),
    good: goodEl ? goodEl.value.trim() : '',
    bad: badEl ? badEl.value.trim() : '',
    next_plan: nextEl ? nextEl.value.trim() : '',
    carry_forward: carryEl ? carryEl.value.trim() : '',
    rating: seeRating,
    updated_at: new Date().toISOString(),
  };
  await DB.saveSee(see);
  alert('돌아보기가 저장되었습니다.');
}

async function nextPlanFromSee() {
  var carryEl = document.getElementById('see-carry');
  var carry = carryEl ? carryEl.value.trim() : '';
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

function goPlans() {
  showTab('plan');
}

function goTasksWithFilter(type) {
  showTab('tasks');
  if (type === 'done') {
    S.tStatus = 'done';
    S.tDelayed = false;
    var sEl = document.getElementById('t-status');
    if (sEl) sEl.value = 'done';
  } else if (type === 'delayed') {
    S.tDelayed = true;
    S.tStatus = '';
    var sEl2 = document.getElementById('t-status');
    if (sEl2) sEl2.value = '';
  }
  renderTasks();
}

function goDoBlocked() {
  showTab('do');
  S.doBlocked = true;
  renderDo();
}

// ===== EXPORT JSON =====
function exportData() {
  var data = {
    version: '2.0',
    exported_at: new Date().toISOString(),
    plans: S.plans,
    plan_versions: S.planVers,
    tasks: S.tasks,
    executions: S.execs,
    see: S.see,
  };
  var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'plandosee_backup_' + kstToday() + '.json';
  a.click();
}

// ===== RENDER ALL =====
function renderAll() {
  populatePlanSelects();
  renderPlans();
  renderTasks();
  renderDo();
  renderSee();
}

// ==============================================================================
// ===== SUPABASE DB 연결 및 하이브리드 AUTH (로컬 계정 + 선택적 Supabase 동기화) =====
// ==============================================================================

// 1. Supabase 클라이언트 초기화 함수
async function initSupabaseClient() {
  if (SB) return true;
  if (typeof window === 'undefined' || !window.supabase) return false;

  try {
    var lsUrl = localStorage.getItem(LS.sbUrl);
    var lsKey = localStorage.getItem(LS.sbKey);
    if (lsUrl && lsKey) {
      SB = window.supabase.createClient(lsUrl, lsKey);
      return true;
    }
  } catch (e) {}

  return false;
}

// 2. 인라인 상태 메시지 알림 헬퍼 (에러 팝업 없이 깔끔한 배너 피드백 제공)
function notifyUser(msg, isError) {
  var gateErr = document.getElementById('gate-error-msg');
  var authErr = document.getElementById('auth-error-msg');
  [gateErr, authErr].forEach(function(el) {
    if (!el) return;
    el.innerHTML = msg;
    el.style.display = 'block';
    if (isError) {
      el.classList.remove('success');
      el.style.color = 'var(--accent)';
    } else {
      el.classList.add('success');
      el.style.color = 'var(--green)';
    }
  });
}

// 3. DB 연결 모달 열기
function openDbModal() {
  var urlEl = document.getElementById('sb-url') || document.getElementById('manual-sb-url');
  var keyEl = document.getElementById('sb-key') || document.getElementById('manual-sb-key');
  if (urlEl) urlEl.value = localStorage.getItem(LS.sbUrl) || '';
  if (keyEl) keyEl.value = localStorage.getItem(LS.sbKey) || '';
  openModal('modal-db');
}

// 4. DB 연결 실행
async function connectSupabase() {
  var url = getVal(['manual-sb-url', 'sb-url']);
  var key = getVal(['manual-sb-key', 'sb-key']);

  if (!url || !key) {
    notifyUser('Supabase Project URL과 Anon Key를 모두 입력해 주세요.', true);
    return;
  }

  if (!window.supabase) {
    notifyUser('Supabase 라이브러리를 불러오지 못했습니다.', true);
    return;
  }

  try {
    var client = window.supabase.createClient(url, key);
    SB = client;
    localStorage.setItem(LS.sbUrl, url);
    localStorage.setItem(LS.sbKey, key);

    updateDbStatus();
    closeModal('modal-db');
    var manualArea = document.getElementById('gate-manual-db');
    if (manualArea) manualArea.style.display = 'none';

    await DB.loadAll();
    renderAll();
    notifyUser('Supabase 데이터베이스가 연결되었습니다.', false);
  } catch (e) {
    notifyUser('데이터베이스 연결 실패: ' + e.message, true);
  }
}
const saveManualDbAndConnect = connectSupabase;

// 5. DB 연결 해제
function disconnectSupabase() {
  SB = null;
  localStorage.removeItem(LS.sbUrl);
  localStorage.removeItem(LS.sbKey);
  updateDbStatus();
  closeModal('modal-db');
}

// 6. DB 상태바 갱신
function updateDbStatus() {
  var dot = document.getElementById('db-dot');
  var txt = document.getElementById('db-status-text');
  var url = localStorage.getItem(LS.sbUrl) || '';
  var savedUser = readSessionUser();
  var userPrefix = (savedUser && savedUser.username) ? ('[' + savedUser.username + '] ') : '';
  if (SB || url) {
    if (dot) dot.classList.add('connected');
    var shortUrl = url.replace('https://', '').split('.')[0];
    if (txt) txt.textContent = userPrefix + 'Supabase 동기화 활성 (' + (shortUrl || 'DB') + ')';
  } else {
    if (dot) dot.classList.add('connected');
    if (txt) txt.textContent = userPrefix + '로컬 보안 스토리지 활성';
  }
}

// 7. 계정 모달 열기
function openAuthModal() {
  var errEl = document.getElementById('auth-error-msg') || document.getElementById('gate-error-msg');
  if (errEl) errEl.style.display = 'none';
  openModal('modal-auth');
}

// 8. 로그인 (로컬 계정 스토리지 + 선택적 Supabase app_users 연동)
async function handleSignIn() {
  var username = getVal(['auth-username', 'auth-email']);
  var password = getVal(['gate-password', 'auth-password']);

  if (!username || !password) {
    notifyUser('아이디와 비밀번호를 모두 입력해 주세요.', true);
    return;
  }

  try {
    var pwHash = await hashPassword(password);
    var accounts = loadLocalAccounts();
    var matchedUser = accounts.find(function(acc) {
      return acc.username.toLowerCase() === username.toLowerCase() && acc.password_hash === pwHash;
    });

    // 로컬에 없으면 Supabase가 연결된 경우 원격 테이블도 확인
    if (!matchedUser) {
      await initSupabaseClient();
      if (SB) {
        try {
          var res = await SB.from('app_users')
            .select('id, username, password_hash')
            .eq('username', username)
            .eq('password_hash', pwHash)
            .maybeSingle();
          if (!res.error && res.data) {
            matchedUser = res.data;
            accounts.push(matchedUser);
            saveLocalAccounts(accounts);
          }
        } catch (sbErr) {}
      }
    }

    if (!matchedUser) {
      var existsUsername = accounts.some(function(acc) {
        return acc.username.toLowerCase() === username.toLowerCase();
      });
      if (!existsUsername) {
        notifyUser('등록되지 않은 아이디입니다. [회원가입] 버튼을 눌러 먼저 계정을 생성해 주세요.', true);
      } else {
        notifyUser('비밀번호가 일치하지 않습니다. 다시 확인해 주세요.', true);
      }
      return;
    }

    var sessionData = { id: matchedUser.id, username: matchedUser.username };
    localStorage.setItem('pds_user', JSON.stringify(sessionData));
    applyUserStorageScope(matchedUser.username);
    notifyUser(matchedUser.username + '님, 환영합니다!', false);
    closeModal('modal-auth');

    await checkAuthSession();
    await DB.loadAll();
    renderAll();
  } catch (e) {
    notifyUser('로그인 처리 중 오류가 발생했습니다: ' + e.message, true);
  }
}
const gateSignIn = handleSignIn;

// 9. 회원가입 (DB 미연결 상태에서도 즉시 가입 및 자동 로그인 처리)
async function handleSignUp() {
  var username = getVal(['auth-username', 'auth-email']);
  var password = getVal(['gate-password', 'auth-password']);

  if (!username || !password) {
    notifyUser('아이디와 비밀번호를 모두 입력해 주세요.', true);
    return;
  }
  if (username.length < 2) {
    notifyUser('아이디는 최소 2자 이상 입력해 주세요.', true);
    return;
  }
  if (password.length < 4) {
    notifyUser('비밀번호는 최소 4자 이상 입력해 주세요.', true);
    return;
  }

  try {
    var accounts = loadLocalAccounts();
    var duplicate = accounts.some(function(acc) {
      return acc.username.toLowerCase() === username.toLowerCase();
    });

    if (duplicate) {
      notifyUser('이미 등록된 아이디입니다. [로그인] 버튼을 눌러 접속해 주세요.', true);
      return;
    }

    var pwHash = await hashPassword(password);
    var newUser = {
      id: uuid(),
      username: username,
      password_hash: pwHash,
      created_at: new Date().toISOString()
    };

    // 1) 로컬 계정 저장소에 즉시 보존
    accounts.push(newUser);
    saveLocalAccounts(accounts);

    // 2) Supabase 연결 시 비차단 동기화 시도 (테이블 미생성 환경에서도 에러 없이 통과)
    await initSupabaseClient();
    if (SB) {
      try {
        await SB.from('app_users').insert([{ username: username, password_hash: pwHash }]);
      } catch (sbErr) {}
    }

    // 3) 가입 즉시 로그인 세션 활성화 및 워크스페이스 진입
    var sessionData = { id: newUser.id, username: newUser.username };
    localStorage.setItem('pds_user', JSON.stringify(sessionData));
    applyUserStorageScope(newUser.username);
    notifyUser('회원가입이 완료되어 워크스페이스로 이동합니다.', false);
    closeModal('modal-auth');

    await checkAuthSession();
    await DB.loadAll();
    renderAll();
  } catch (e) {
    notifyUser('회원가입 처리 중 오류가 발생했습니다: ' + e.message, true);
  }
}
const gateSignUp = handleSignUp;

// 10. 로그아웃
async function handleSignOut() {
  localStorage.removeItem('pds_user');
  applyUserStorageScope('');
  var userInput = document.getElementById('auth-username');
  var passInput = document.getElementById('gate-password');
  var errEl = document.getElementById('gate-error-msg');
  if (passInput) passInput.value = '';
  if (errEl) errEl.style.display = 'none';
  await checkAuthSession();
}
const gateSignOut = handleSignOut;

// 11. 인증 세션 및 UI 동기화
async function checkAuthSession() {
  var gate = document.getElementById('login-gate');
  await initSupabaseClient();

  var savedUser = readSessionUser();
  if (savedUser && savedUser.username) {
    applyUserStorageScope(savedUser.username);
    if (gate) gate.style.display = 'none';
    var userEmailEl = document.getElementById('header-user-email') || document.getElementById('user-email-display');
    var logoutBtnEl = document.getElementById('header-logout-btn') || document.getElementById('btn-sign-out');
    var loginBtnEl = document.getElementById('btn-open-auth-modal');

    if (userEmailEl) {
      userEmailEl.textContent = savedUser.username + ' 계정';
      userEmailEl.style.display = 'inline-block';
    }
    if (logoutBtnEl) logoutBtnEl.style.display = 'inline-block';
    if (loginBtnEl) loginBtnEl.style.display = 'none';
  } else {
    if (gate) gate.style.display = 'flex';
  }
  updateDbStatus();
}
const checkGateAuth = checkAuthSession;

function toggleManualDb() {
  var area = document.getElementById('gate-manual-db');
  if (area) {
    area.style.display = (area.style.display === 'none' || area.style.display === '') ? 'block' : 'none';
  }
}

// ===== DOMContentLoaded 바인딩 =====
document.addEventListener('DOMContentLoaded', async function() {
  await initSupabaseClient();
  await DB.loadAll();
  renderAll();
  updateDbStatus();
  await checkAuthSession();

  var exportBtn = document.getElementById('export-btn');
  if (exportBtn) exportBtn.addEventListener('click', exportData);

  var execStart = document.getElementById('exec-start');
  if (execStart) execStart.addEventListener('change', autoCalcMinutes);
  var execEnd = document.getElementById('exec-end');
  if (execEnd) execEnd.addEventListener('change', autoCalcMinutes);

  var tSearch = document.getElementById('t-search');
  if (tSearch) tSearch.addEventListener('input', function(e) { S.tSearch = e.target.value; renderTasks(); });
  var tPlan = document.getElementById('t-plan');
  if (tPlan) tPlan.addEventListener('change', function(e) { S.tPlan = e.target.value; renderTasks(); });
  var tStatus = document.getElementById('t-status');
  if (tStatus) tStatus.addEventListener('change', function(e) { S.tStatus = e.target.value; renderTasks(); });
  var tPrio = document.getElementById('t-prio');
  if (tPrio) tPrio.addEventListener('change', function(e) { S.tPrio = e.target.value; renderTasks(); });
  var tTag = document.getElementById('t-tag');
  if (tTag) tTag.addEventListener('input', function(e) { S.tTag = e.target.value.trim(); renderTasks(); });

  var tSort = document.getElementById('t-sort');
  if (tSort) tSort.addEventListener('change', function(e) { S.tSort = e.target.value; renderTasks(); });
  var tDir = document.getElementById('t-dir') || document.getElementById('sort-dir-btn');
  if (tDir) tDir.addEventListener('click', function() {
    S.tDir = S.tDir === 'asc' ? 'desc' : 'asc';
    tDir.textContent = S.tDir === 'asc' ? '↑ 오름차순' : '↓ 내림차순';
    renderTasks();
  });

  var filterDelayed = document.getElementById('btn-filter-delayed');
  if (filterDelayed) filterDelayed.addEventListener('click', function() {
    S.tDelayed = !S.tDelayed;
    renderTasks();
  });

  var filterBlocked = document.getElementById('btn-filter-blocked');
  if (filterBlocked) filterBlocked.addEventListener('click', function() {
    S.doBlocked = !S.doBlocked;
    renderDo();
  });

  var seePlan = document.getElementById('see-plan');
  if (seePlan) seePlan.addEventListener('change', function(e) {
    S.seePlan = e.target.value;
    renderSee();
  });

  // Enter 키 로그인 지원
  ['gate-password', 'auth-password'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') handleSignIn();
    });
  });
});

async function hashPassword(plainText) {
  var str = String(plainText || '');
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle && typeof TextEncoder !== 'undefined') {
      var encoder = new TextEncoder();
      var data = encoder.encode(str);
      var hashBuffer = await crypto.subtle.digest('SHA-256', data);
      var hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
    }
  } catch (e) {}
  // Pure JS deterministic fallback hash
  var h1 = 0xdeadbeef ^ str.length;
  var h2 = 0x41c6ce57 ^ str.length;
  for (var i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}




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
