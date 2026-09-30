// ===== CONSTANTS & STORAGE KEYS =====
const LS = {
  plans: 'pds2_plans',
  planVers: 'pds2_plan_versions',
  tasks: 'pds2_tasks',
  execs: 'pds2_executions',
  sees: 'pds2_sees',
  sbUrl: 'pds2_sb_url',
  sbKey: 'pds2_sb_key',
};

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
        S.planVers = results.data || [];
        S.tasks = results.data || [];
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
  if (diff >= 0 && document.getElementById('exec-actual')) {
    document.getElementById('exec-actual').value = diff;
  }
}

// ===== SUBMIT EXECUTION (DOUBLE-SUBMISSION PREVENTION) =====
async function submitExec() {
  var taskId = document.getElementById('exec-task').value;
  if (!taskId) { alert('할 일을 선택하세요.'); return; }
  if (S.pending.has(taskId)) return;

  var sv = document.getElementById('exec-start').value;
  var ev = document.getElementById('exec-end').value;
  var actual = parseInt(document.getElementById('exec-actual').value) || 0;
  var blocker = document.getElementById('exec-blocker').value.trim();

  if (sv && ev && new Date(ev) < new Date(sv)) {
    alert('종료 시각은 시작 시각 이후여야 합니다.');
    return;
  }

  S.pending.add(taskId);
  var submitBtn = document.getElementById('exec-submit-btn');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '기록 중...'; }

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

    document.getElementById('exec-start').value = '';
    document.getElementById('exec-end').value = '';
    document.getElementById('exec-actual').value = '';
    document.getElementById('exec-blocker').value = '';
    renderDo();
    renderTasks();
  } finally {
    S.pending.delete(taskId);
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '실행 완료 기록'; }
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
  if (id) {
    var p = S.plans.find(function(x) { return x.id === id; });
    if (!p) return;
    if (titleEl) titleEl.textContent = '계획 수정';
    document.getElementById('plan-title').value = p.title || '';
    document.getElementById('plan-start').value = fmtDate(p.period_start);
    document.getElementById('plan-end').value = fmtDate(p.period_end);
    document.getElementById('plan-priority').value = p.priority || 'medium';
    document.getElementById('plan-criteria').value = p.success_criteria || '';
    document.getElementById('plan-minutes').value = p.estimated_minutes || '';
    document.getElementById('plan-notes').value = p.notes || '';
  } else {
    if (titleEl) titleEl.textContent = '새 계획 만들기';
    document.getElementById('plan-title').value = '';
    document.getElementById('plan-start').value = '';
    document.getElementById('plan-end').value = '';
    document.getElementById('plan-priority').value = 'medium';
    document.getElementById('plan-criteria').value = '';
    document.getElementById('plan-minutes').value = '';
    document.getElementById('plan-notes').value = '';
  }
  openModal('modal-plan');
}

async function savePlan() {
  var title = document.getElementById('plan-title').value.trim();
  if (!title) { alert('계획 제목을 입력하세요.'); return; }
  var start = document.getElementById('plan-start').value || null;
  var end = document.getElementById('plan-end').value || null;
  if (start && end && end < start) { alert('종료일은 시작일 이후여야 합니다.'); return; }

  var data = {
    title: title,
    period_start: start,
    period_end: end,
    priority: document.getElementById('plan-priority').value,
    success_criteria: document.getElementById('plan-criteria').value.trim(),
    estimated_minutes: parseInt(document.getElementById('plan-minutes').value) || 0,
    notes: document.getElementById('plan-notes').value.trim(),
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
  document.getElementById('history-plan-title').textContent = '"' + plan.title + '" 수정 이력 (' + vers.length + '건)';
  var body = document.getElementById('history-list');
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
  if (id) {
    var t = S.tasks.find(function(x) { return x.id === id; });
    if (!t) return;
    if (titleEl) titleEl.textContent = '할 일 수정';
    document.getElementById('task-plan-id').value = t.plan_id || '';
    document.getElementById('task-title').value = t.title || '';
    document.getElementById('task-due').value = fmtDate(t.due_date);
    document.getElementById('task-priority').value = t.priority || 'medium';
    document.getElementById('task-tags').value = t.tags || '';
    document.getElementById('task-minutes').value = t.estimated_minutes || '';
    document.getElementById('task-notes').value = t.notes || '';
  } else {
    if (titleEl) titleEl.textContent = '새 할 일 만들기';
    document.getElementById('task-plan-id').value = S.tPlan || '';
    document.getElementById('task-title').value = '';
    document.getElementById('task-due').value = '';
    document.getElementById('task-priority').value = 'medium';
    document.getElementById('task-tags').value = '';
    document.getElementById('task-minutes').value = '';
    document.getElementById('task-notes').value = '';
  }
  openModal('modal-task');
}

async function saveTask() {
  var title = document.getElementById('task-title').value.trim();
  if (!title) { alert('할 일 제목을 입력하세요.'); return; }
  var planId = document.getElementById('task-plan-id').value || null;
  var due = document.getElementById('task-due').value || null;

  var task;
  if (S.editTaskId) {
    var current = S.tasks.find(function(t) { return t.id === S.editTaskId; });
    task = Object.assign({}, current, {
      plan_id: planId,
      title: title,
      due_date: due,
      priority: document.getElementById('task-priority').value,
      tags: document.getElementById('task-tags').value.trim(),
      estimated_minutes: parseInt(document.getElementById('task-minutes').value) || 0,
      notes: document.getElementById('task-notes').value.trim(),
    });
    await DB.saveTask(task);
  } else {
    task = {
      id: uuid(),
      plan_id: planId,
      title: title,
      status: 'todo',
      due_date: due,
      priority: document.getElementById('task-priority').value,
      tags: document.getElementById('task-tags').value.trim(),
      estimated_minutes: parseInt(document.getElementById('task-minutes').value) || 0,
      notes: document.getElementById('task-notes').value.trim(),
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

    return '<div class="card">' +
      '<div class="card-header">' +
        '<div style="flex:1;">' +
          '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">' +
            '<span class="badge ' + prioBadgeClass(p.priority) + '">' + priorityLabel(p.priority) + '</span>' +
            '<span class="card-title">' + esc(p.title) + '</span>' +
          '</div>' +
          '<div class="card-meta">' +
            (p.period_start || p.period_end ? (fmtDate(p.period_start) + ' ~ ' + fmtDate(p.period_end) + ' | ') : '') +
            (p.estimated_minutes ? '예상: ' + p.estimated_minutes + '분 | ' : '') +
            '할 일 ' + doneTasks.length + '/' + planTasks.length + ' (' + progress + '%)' +
          '</div>' +
        '</div>' +
        '<div class="card-actions">' +
          (vCount > 0 ? '<button class="btn-icon" onclick="openHistoryModal(\'' + p.id + '\')">수정 이력 (' + vCount + ')</button>' : '') +
          '<button class="btn-icon" onclick="openPlanModal(\'' + p.id + '\')">수정</button>' +
          '<button class="btn-danger" onclick="deletePlan(\'' + p.id + '\')">삭제</button>' +
        '</div>' +
      '</div>' +
      (p.success_criteria ? '<div style="font-size:12px;color:var(--secondary);margin-top:8px;"><strong>성공 기준:</strong> ' + esc(p.success_criteria) + '</div>' : '') +
      (p.notes ? '<div style="font-size:12px;color:var(--muted);margin-top:4px;">' + esc(p.notes) + '</div>' : '') +
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
        '<div style="flex:1;">' +
          '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;">' +
            '<span class="status-btn ' + statusBadgeClass(t.status) + '" onclick="toggleTaskStatus(\'' + t.id + '\')" title="클릭하여 상태 변경">' + statusLabel(t.status) + '</span>' +
            '<span class="badge ' + prioBadgeClass(t.priority) + '">' + priorityLabel(t.priority) + '</span>' +
            (delayed ? '<span class="badge badge-delayed">지연됨</span>' : '') +
            '<span class="card-title">' + esc(t.title) + '</span>' +
          '</div>' +
          '<div class="card-meta">' +
            (plan ? '계획: ' + esc(plan.title) + ' | ' : '') +
            (t.due_date ? '마감: ' + fmtDate(t.due_date) + ' | ' : '') +
            (t.estimated_minutes ? '예상: ' + t.estimated_minutes + '분 | ' : '') +
            '등록: ' + fmtCreated(t.created_at) +
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
  var list = document.getElementById('exec-list');
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

  var c = document.getElementById('see-container');
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
         .map(function(n) { return '<button type="button" class="star-btn' + (seeRating >= n ? ' active' : '') + '" onclick="setSeeRating(' + n + ')">' + n + '</button>'; }).join('') +
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
    var sEl = document.getElementById('t-status');
    if (sEl) sEl.value = '';
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
// ===== SUPABASE 듀얼 연결 & 철통 로그인 게이트 제어 =====
// ==============================================================================

async function initSupabaseClient() {
  if (SB) return true;
  if (typeof window === 'undefined' || !window.supabase) return false;

  // 1. 브라우저 localStorage 우선 확인 (GitHub Pages 및 오프라인 호환)
  try {
    var lsUrl = localStorage.getItem(LS.sbUrl);
    var lsKey = localStorage.getItem(LS.sbKey);
    if (lsUrl && lsKey) {
      SB = window.supabase.createClient(lsUrl, lsKey);
      return true;
    }
  } catch(e) {}

  // 2. Vercel 서버리스 API (/api/config) 확인
  try {
    var res = await fetch('/api/config');
    if (res.ok) {
      var cfg = await res.json();
      if (cfg.supabaseUrl && cfg.supabaseAnonKey) {
        SB = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
        localStorage.setItem(LS.sbUrl, cfg.supabaseUrl);
        localStorage.setItem(LS.sbKey, cfg.supabaseAnonKey);
        return true;
      }
    }
  } catch(e) {}

  return false;
}

function showGateMessage(msg, isError) {
  var errEl = document.getElementById('gate-error-msg') || document.getElementById('auth-error-msg');
  if (errEl) {
    errEl.innerHTML = msg;
    errEl.style.display = 'block';
    errEl.style.color = isError ? 'var(--accent)' : 'var(--green)';
    errEl.style.background = isError ? 'var(--accent-dim)' : 'var(--green-dim)';
  } else {
    alert(msg);
  }
}

function toggleManualDb() {
  var area = document.getElementById('gate-manual-db');
  if (area) {
    area.style.display = (area.style.display === 'none' || area.style.display === '') ? 'block' : 'none';
  }
}

async function saveManualDbAndConnect() {
  var urlEl = document.getElementById('manual-sb-url') || document.getElementById('sb-url');
  var keyEl = document.getElementById('manual-sb-key') || document.getElementById('sb-key');
  var url = urlEl ? urlEl.value.trim() : '';
  var key = keyEl ? keyEl.value.trim() : '';

  if (!url || !key) {
    alert('Supabase Project URL과 anon 키를 모두 입력해 주세요.');
    return;
  }

  try {
    if (!window.supabase) {
      alert('Supabase 라이브러리를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.');
      return;
    }
    SB = window.supabase.createClient(url, key);
    localStorage.setItem(LS.sbUrl, url);
    localStorage.setItem(LS.sbKey, key);
    alert('데이터베이스 연결 정보가 브라우저에 저장되었습니다!\n이제 이메일과 비밀번호를 입력하고 [로그인]을 누르세요.');
    var manualArea = document.getElementById('gate-manual-db');
    if (manualArea) manualArea.style.display = 'none';
    showGateMessage('데이터베이스가 연결되었습니다. 로그인해 주세요.', false);
  } catch(e) {
    alert('DB 연결 실패: ' + e.message);
  }
}

async function gateSignIn() {
  var btn = document.getElementById('btn-gate-signin');
  var origText = btn ? btn.textContent : '로그인';
  if (btn) { btn.textContent = '로그인 중...'; btn.disabled = true; }

  try {
    var emailEl = document.getElementById('gate-email') || document.getElementById('auth-email');
    var passEl = document.getElementById('gate-password') || document.getElementById('auth-password');
    var email = emailEl ? emailEl.value.trim() : '';
    var password = passEl ? passEl.value.trim() : '';

    if (!email || !password) {
      showGateMessage('이메일과 비밀번호를 모두 입력해 주세요.', true);
      return;
    }

    if (!SB) {
      await initSupabaseClient();
    }

    if (!SB) {
      showGateMessage('데이터베이스에 연결되지 않았습니다.<br>아래 <strong>[⚙️ 데이터베이스 직접 연결 설정]</strong>에 Supabase URL과 키를 1회 입력해 주세요.', true);
      var manualArea = document.getElementById('gate-manual-db');
      if (manualArea) manualArea.style.display = 'block';
      return;
    }

    var res = await SB.auth.signInWithPassword({ email: email, password: password });
    if (res.error) {
      showGateMessage('로그인 실패: ' + res.error.message, true);
    } else {
      showGateMessage('로그인 성공! 다이어리를 불러옵니다...', false);
      var gate = document.getElementById('login-gate');
      if (gate) gate.style.display = 'none';
      await checkGateAuth();
    }
  } catch(err) {
    alert('로그인 처리 중 오류 발생: ' + err.message);
  } finally {
    if (btn) { btn.textContent = origText; btn.disabled = false; }
  }
}

async function gateSignUp() {
  var btn = document.getElementById('btn-gate-signup');
  var origText = btn ? btn.textContent : '회원가입';
  if (btn) { btn.textContent = '가입 중...'; btn.disabled = true; }

  try {
    var emailEl = document.getElementById('gate-email') || document.getElementById('auth-email');
    var passEl = document.getElementById('gate-password') || document.getElementById('auth-password');
    var email = emailEl ? emailEl.value.trim() : '';
    var password = passEl ? passEl.value.trim() : '';

    if (!email || !password) {
      showGateMessage('이메일과 비밀번호를 모두 입력해 주세요.', true);
      return;
    }
    if (password.length < 6) {
      showGateMessage('비밀번호는 최소 6자 이상이어야 합니다.', true);
      return;
    }

    if (!SB) {
      await initSupabaseClient();
    }

    if (!SB) {
      showGateMessage('데이터베이스에 연결되지 않았습니다.<br>아래 <strong>[⚙️ 데이터베이스 직접 연결 설정]</strong>에 Supabase URL과 키를 1회 입력해 주세요.', true);
      var manualArea = document.getElementById('gate-manual-db');
      if (manualArea) manualArea.style.display = 'block';
      return;
    }

    var res = await SB.auth.signUp({ email: email, password: password });
    if (res.error) {
      showGateMessage('회원가입 실패: ' + res.error.message, true);
    } else {
      alert('회원가입이 완료되었습니다!\n이제 이메일과 비밀번호를 그대로 두고 [로그인] 버튼을 눌러 접속하세요.');
      showGateMessage('회원가입 성공! 이제 [로그인] 버튼을 눌러주세요.', false);
    }
  } catch(err) {
    alert('회원가입 처리 중 오류 발생: ' + err.message);
  } finally {
    if (btn) { btn.textContent = origText; btn.disabled = false; }
  }
}

async function gateSignOut() {
  if (!confirm('로그아웃 하시겠습니까?')) return;
  if (SB) await SB.auth.signOut();
  location.reload();
}

async function checkGateAuth() {
  var gate = document.getElementById('login-gate');

  await initSupabaseClient();

  if (SB) {
    var sessionRes = await SB.auth.getSession();
    var session = sessionRes.data && sessionRes.data.session;

    if (session && session.user) {
      if (gate) gate.style.display = 'none';
      var userEmailEl = document.getElementById('header-user-email');
      var logoutBtnEl = document.getElementById('header-logout-btn');
      if (userEmailEl) {
        userEmailEl.textContent = '👤 ' + session.user.email;
        userEmailEl.style.display = 'inline-block';
      }
      if (logoutBtnEl) logoutBtnEl.style.display = 'inline-block';
      await DB.loadAll();
      renderAll();
    } else {
      if (gate) gate.style.display = 'flex';
    }
  } else {
    if (gate) gate.style.display = 'flex';
  }
}

// ===== EVENT LISTENERS ATTACHMENT =====
document.addEventListener('DOMContentLoaded', function() {
  checkGateAuth();

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
  var tDir = document.getElementById('t-dir');
  if (tDir) tDir.addEventListener('click', function() {
    S.tDir = S.tDir === 'asc' ? 'desc' : 'asc';
    tDir.textContent = S.tDir === 'asc' ? '오름차순' : '내림차순';
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
});
