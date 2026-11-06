'use strict';

/* ---------------- helpers ---------------- */
let _seq = 0;
function uid(prefix) {
  _seq += 1;
  return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + _seq.toString(36);
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function todayStr() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return fmtDate(d);
}

function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dayDiff(due) {
  if (!due) return null;
  const d = new Date(due + 'T00:00:00');
  if (isNaN(d)) return null;
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return Math.round((d - t) / 86400000);
}

function dueLabel(due) {
  const n = dayDiff(due);
  if (n === null) return null;
  let cls = '';
  let text;
  if (n < 0) { cls = 'overdue'; text = '逾期 ' + Math.abs(n) + ' 天'; }
  else if (n === 0) { cls = 'today'; text = '今天'; }
  else if (n === 1) { cls = 'soon'; text = '明天'; }
  else if (n <= 7) { cls = 'soon'; text = n + ' 天后'; }
  else { text = due.slice(5); }
  return { cls, text };
}

const PALETTE = ['#5b9dff', '#5ad1a8', '#ffb454', '#ff7eb3', '#a78bfa', '#4dd4d4', '#ff9f6b', '#8fbf5a'];

function colorFor(key) {
  let h = 0;
  const s = String(key || '');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

const PRIO_TEXT = { high: '高', medium: '中', low: '低' };

function compactNow() {
  return fmtYYMMDDHHMM(new Date());
}

function fmtYYMMDDHHMM(d) {
  if (!d || isNaN(d)) return '';
  const y = String(d.getFullYear()).slice(-2);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}${m}${day} ${h}:${min}`;
}

function parseCompact(s) {
  const m = String(s || '').trim().match(/^(\d{2})(\d{2})(\d{2})\s+(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const year = 2000 + parseInt(m[1], 10);
  const month = parseInt(m[2], 10) - 1;
  const day = parseInt(m[3], 10);
  const h = parseInt(m[4], 10);
  const min = parseInt(m[5], 10);
  const d = new Date(year, month, day, h, min);
  return isNaN(d) ? null : d;
}

function compactIsValid(s) {
  return parseCompact(s) !== null;
}

/* ---------------- state ---------------- */
const state = {
  members: [],
  tasks: [],
  ui: { memberFilter: null },
};

let saveTimer = null;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    window.api.save({ members: state.members, tasks: state.tasks });
  }, 250);
}

function memberById(id) { return state.members.find((m) => m.id === id); }
function isOpen(t) { return t.status !== 'done'; }

/* ---------------- filtering ---------------- */
function visibleTasks() {
  if (state.ui.memberFilter) {
    return state.tasks.filter((t) => t.memberId === state.ui.memberFilter);
  }
  return state.tasks;
}

function memberTaskCounts(memberId) {
  const mine = state.tasks.filter((t) => t.memberId === memberId);
  const open = mine.filter(isOpen);
  const od = open.filter((t) => { const n = dayDiff(t.due); return n !== null && n < 0; }).length;
  return { total: mine.length, open: open.length, overdue: od };
}

/* ---------------- render ---------------- */
function render() {
  renderMembersStrip();
  renderTasks();
  renderMiniStats();
}

function renderMiniStats() {
  const open = state.tasks.filter(isOpen);
  const od = open.filter((t) => { const n = dayDiff(t.due); return n !== null && n < 0; }).length;
  const td = open.filter((t) => dayDiff(t.due) === 0).length;
  const parts = [];
  if (od) parts.push('逾期 ' + od);
  if (td) parts.push('今日 ' + td);
  parts.push('待办 ' + open.length);
  document.getElementById('miniStats').textContent = parts.join(' · ');
}

/* ---- members strip ---- */
function renderMembersStrip() {
  const el = document.getElementById('membersStrip');
  const allActive = state.ui.memberFilter === null;
  const allCount = state.tasks.filter(isOpen).length;
  const allHtml = `
    <div class="all-chip ${allActive ? 'active' : ''}" data-filter="">
      <div class="av">全部</div>
      <div class="name">${allCount} 待办</div>
    </div>`;

  const membersHtml = state.members.map((m) => {
    const c = colorFor(m.name);
    const initial = (m.name || '?').trim().charAt(0);
    const active = state.ui.memberFilter === m.id;
    const cnt = memberTaskCounts(m.id).open;
    return `
      <div class="member-chip ${active ? 'active' : ''}" data-member="${m.id}">
        <div class="av" style="background:linear-gradient(150deg, ${c}, ${c}99)">${esc(initial)}</div>
        <div class="name" title="${esc(m.name)}">${esc(m.name)}${cnt ? ` · ${cnt}` : ''}</div>
      </div>`;
  }).join('');

  el.innerHTML = allHtml + membersHtml + `
    <button class="manage-btn" id="btn-manage" title="管理成员">
      <svg viewBox="0 0 24 24" width="16" height="16"><path d="M3 17h18M3 12h18M3 7h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
    </button>`;

  el.querySelector('.all-chip').addEventListener('click', () => {
    state.ui.memberFilter = null;
    render();
  });
  el.querySelectorAll('.member-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const id = chip.dataset.member;
      state.ui.memberFilter = state.ui.memberFilter === id ? null : id;
      render();
    });
    setupMemberDrag(chip);
  });
  el.querySelector('#btn-manage').addEventListener('click', () => openMemberListModal());
}

/* ---- tasks ---- */
function renderTasks() {
  const el = document.getElementById('content');
  const list = visibleTasks();

  if (!state.members.length && !state.tasks.length) {
    el.innerHTML = empty('☰', '先添加成员', '点顶部右侧菜单按钮添加课题组成员，再分配任务');
    return;
  }
  if (!list.length) {
    const m = state.ui.memberFilter ? memberById(state.ui.memberFilter) : null;
    const hint = m ? `${esc(m.name)} 暂无任务，点右下角 + 添加` : '暂无任务，点右下角 + 添加';
    el.innerHTML = empty('☰', m ? esc(m.name) : '暂无任务', hint);
    return;
  }

  let html = '';
  if (state.ui.memberFilter) {
    const m = memberById(state.ui.memberFilter);
    html += `<div class="section-label">${esc(m ? m.name : '')} 的任务</div>`;
  } else {
    html += `<div class="section-label">任务列表</div>`;
  }
  html += list.map(taskRow).join('');
  el.innerHTML = html;
  wireTasks();
}

function taskRow(t) {
  const mem = memberById(t.memberId);
  const dl = dueLabel(t.due);
  const tags = [];
  if (mem) {
    tags.push(`<span class="tag"><span class="dot" style="background:${colorFor(mem.name)}"></span>${esc(mem.name)}</span>`);
  }
  if (dl) tags.push(`<span class="tag due ${dl.cls}">${dl.text}</span>`);
  if (isOpen(t) && t.status === 'doing') tags.push('<span class="tag">进行中</span>');
  if (t.startAt) tags.push(`<span class="tag start">始 ${esc(t.startAt)}</span>`);
  const prio = t.priority || 'medium';
  return `
    <div class="item ${t.status === 'done' ? 'done' : ''}" data-task="${t.id}">
      <div class="prio ${prio}"></div>
      <span class="checkbox" data-check="${t.id}">
        <svg viewBox="0 0 24 24" width="10" height="10"><path d="M5 12l4 4 10-10" stroke="#0e1118" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </span>
      <div class="item-main">
        <div class="item-title">${esc(t.title)}</div>
        ${tags.length ? `<div class="item-meta">${tags.join('')}</div>` : ''}
      </div>
    </div>`;
}

function wireTasks() {
  const content = document.getElementById('content');
  content.querySelectorAll('[data-check]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleDone(el.dataset.check);
    });
  });
  content.querySelectorAll('[data-task]').forEach((el) => {
    el.addEventListener('click', () => openTaskModal(el.dataset.task));
    setupTaskDrag(el);
  });
}

function toggleDone(id) {
  const t = state.tasks.find((x) => x.id === id);
  if (!t) return;
  if (t.status === 'done') {
    t.status = 'todo';
    delete t.doneAt;
  } else {
    t.status = 'done';
    t.doneAt = todayStr();
  }
  persist();
  render();
}

function empty(icon, title, hint) {
  return `<div class="empty"><span class="big">${icon}</span>${title}<br><span style="color:var(--text-faint)">${hint}</span></div>`;
}

/* ---------------- drag & drop ---------------- */
function setupMemberDrag(chip) {
  chip.setAttribute('draggable', 'true');
  chip.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', chip.dataset.member);
    e.dataTransfer.effectAllowed = 'move';
    chip.classList.add('dragging');
  });
  chip.addEventListener('dragend', () => {
    chip.classList.remove('dragging');
    document.querySelectorAll('.member-chip').forEach((c) => c.classList.remove('drop-target'));
  });
  chip.addEventListener('dragover', (e) => {
    e.preventDefault();
    const dragging = document.querySelector('.member-chip.dragging');
    if (!dragging || dragging === chip) return;
    e.dataTransfer.dropEffect = 'move';
    chip.classList.add('drop-target');
  });
  chip.addEventListener('dragleave', () => chip.classList.remove('drop-target'));
  chip.addEventListener('drop', (e) => {
    e.preventDefault();
    chip.classList.remove('drop-target');
    const draggedId = e.dataTransfer.getData('text/plain');
    const targetId = chip.dataset.member;
    if (!draggedId || draggedId === targetId) return;
    const draggedIndex = state.members.findIndex((m) => m.id === draggedId);
    const targetIndex = state.members.findIndex((m) => m.id === targetId);
    if (draggedIndex < 0 || targetIndex < 0) return;
    const rect = chip.getBoundingClientRect();
    const before = e.clientX < rect.left + rect.width / 2;
    let insertIndex = before ? targetIndex : targetIndex + 1;
    const [moved] = state.members.splice(draggedIndex, 1);
    if (draggedIndex < insertIndex) insertIndex -= 1;
    state.members.splice(insertIndex, 0, moved);
    persist();
    render();
  });
}

function setupTaskDrag(item) {
  item.setAttribute('draggable', 'true');
  item.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', item.dataset.task);
    e.dataTransfer.effectAllowed = 'move';
    item.classList.add('dragging');
  });
  item.addEventListener('dragend', () => {
    item.classList.remove('dragging');
    document.querySelectorAll('.item').forEach((c) => c.classList.remove('drop-target'));
  });
  item.addEventListener('dragover', (e) => {
    e.preventDefault();
    const dragging = document.querySelector('.item.dragging');
    if (!dragging || dragging === item) return;
    e.dataTransfer.dropEffect = 'move';
    item.classList.add('drop-target');
  });
  item.addEventListener('dragleave', () => item.classList.remove('drop-target'));
  item.addEventListener('drop', (e) => {
    e.preventDefault();
    item.classList.remove('drop-target');
    const draggedId = e.dataTransfer.getData('text/plain');
    const targetId = item.dataset.task;
    if (!draggedId || draggedId === targetId) return;
    const draggedIndex = state.tasks.findIndex((t) => t.id === draggedId);
    const targetIndex = state.tasks.findIndex((t) => t.id === targetId);
    if (draggedIndex < 0 || targetIndex < 0) return;
    const rect = item.getBoundingClientRect();
    const before = e.clientY < rect.top + rect.height / 2;
    let insertIndex = before ? targetIndex : targetIndex + 1;
    const [moved] = state.tasks.splice(draggedIndex, 1);
    if (draggedIndex < insertIndex) insertIndex -= 1;
    state.tasks.splice(insertIndex, 0, moved);
    persist();
    render();
  });
}

/* ---------------- modal ---------------- */
function openModal(html, wire) {
  const mask = document.getElementById('modalMask');
  const modal = document.getElementById('modal');
  modal.innerHTML = html;
  mask.hidden = false;
  wire(modal);
  const first = modal.querySelector('input, select, textarea');
  if (first) setTimeout(() => first.focus(), 30);
}

function closeModal() {
  document.getElementById('modalMask').hidden = true;
  document.getElementById('modal').innerHTML = '';
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !document.getElementById('modalMask').hidden) closeModal();
});

document.getElementById('modalMask').addEventListener('click', (e) => {
  if (e.target.id === 'modalMask') closeModal();
});

function memberOptions(selected) {
  return ['<option value="">未指定</option>']
    .concat(state.members.map((m) => `<option value="${m.id}" ${m.id === selected ? 'selected' : ''}>${esc(m.name)}</option>`))
    .join('');
}

/* ---- task modal ---- */
function openTaskModal(id) {
  const t = id ? state.tasks.find((x) => x.id === id) : null;
  const isEdit = !!t;
  const v = t || {
    title: '',
    memberId: state.ui.memberFilter || '',
    priority: 'medium',
    status: 'todo',
    due: '',
    startAt: compactNow(),
    note: '',
  };
  const html = `
    <div class="modal-title">${isEdit ? '编辑任务' : '新建任务'}</div>
    <form id="taskForm">
      <label>任务内容<input name="title" autocomplete="off" placeholder="例如：完成第 3 章初稿" value="${esc(v.title)}"></label>
      <div class="row2">
        <label>负责人<select name="memberId">${memberOptions(v.memberId)}</select></label>
        <label>优先级<select name="priority">
          <option value="high" ${v.priority === 'high' ? 'selected' : ''}>高</option>
          <option value="medium" ${v.priority === 'medium' ? 'selected' : ''}>中</option>
          <option value="low" ${v.priority === 'low' ? 'selected' : ''}>低</option>
        </select></label>
      </div>
      <label>截止日期<input type="date" name="due" value="${esc(v.due)}"></label>
      <label>起始时间<input name="startAt" placeholder="261012 15:20" value="${esc(v.startAt || '')}"></label>
      <label>状态<select name="status">
        <option value="todo" ${v.status === 'todo' ? 'selected' : ''}>未开始</option>
        <option value="doing" ${v.status === 'doing' ? 'selected' : ''}>进行中</option>
        <option value="done" ${v.status === 'done' ? 'selected' : ''}>已完成</option>
      </select></label>
      <label>备注<textarea name="note" placeholder="可选">${esc(v.note || '')}</textarea></label>
      <div class="modal-actions">
        ${isEdit ? '<button type="button" class="del" id="mDel">删</button>' : ''}
        <button type="button" class="ghost" id="mCancel">取消</button>
        <button type="submit" class="primary">保存</button>
      </div>
    </form>`;

  openModal(html, (m) => {
    m.querySelector('#mCancel').addEventListener('click', closeModal);
    if (isEdit) m.querySelector('#mDel').addEventListener('click', () => {
      state.tasks = state.tasks.filter((x) => x.id !== id);
      persist(); closeModal(); render();
    });
    m.querySelector('#taskForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = e.target;
      const data = {
        title: f.title.value.trim(),
        memberId: f.memberId.value,
        priority: f.priority.value,
        status: f.status.value,
        due: f.due.value,
        startAt: compactIsValid(f.startAt.value) ? f.startAt.value.trim() : '',
        note: f.note.value.trim(),
      };
      if (!data.title) { f.title.focus(); return; }
      if (!compactIsValid(f.startAt.value) && f.startAt.value.trim()) {
        f.startAt.focus();
        return;
      }
      if (isEdit) Object.assign(t, data);
      else state.tasks.push(Object.assign({ id: uid('t') }, data));
      persist(); closeModal(); render();
    });
  });
}

/* ---- member list modal ---- */
function openMemberListModal() {
  const html = `
    <div class="modal-title">管理成员</div>
    <div id="mList">
      ${state.members.length ? state.members.map((m) => memberListItem(m)).join('') : '<div style="color:var(--text-faint);font-size:12px;padding:10px 2px">暂无成员，点击下方新增</div>'}
    </div>
    <div class="modal-actions" style="margin-top:10px">
      <button type="button" class="ghost" id="mCancel">关闭</button>
      <button type="button" class="add" id="mAdd">+ 新增成员</button>
    </div>`;

  openModal(html, (m) => {
    m.querySelector('#mCancel').addEventListener('click', closeModal);
    m.querySelector('#mAdd').addEventListener('click', () => openMemberModal(null, () => refreshMemberList(m)));
    m.querySelectorAll('.member-list-item').forEach((row) => {
      row.addEventListener('click', () => openMemberModal(row.dataset.id, () => refreshMemberList(m)));
    });
  });
}

function memberListItem(m) {
  const c = colorFor(m.name);
  const initial = (m.name || '?').trim().charAt(0);
  const cnt = memberTaskCounts(m.id);
  return `
    <div class="member-list-item" data-id="${m.id}">
      <div class="av" style="background:linear-gradient(150deg, ${c}, ${c}99)">${esc(initial)}</div>
      <div class="nm">${esc(m.name)}</div>
      <div class="rl">${esc(m.role || '未设置身份')} · ${cnt.open} 待办${cnt.overdue ? ' · ' + cnt.overdue + ' 逾期' : ''}</div>
    </div>`;
}

function refreshMemberList(modalEl) {
  const list = modalEl.querySelector('#mList');
  list.innerHTML = state.members.length
    ? state.members.map((m) => memberListItem(m)).join('')
    : '<div style="color:var(--text-faint);font-size:12px;padding:10px 2px">暂无成员，点击下方新增</div>';
  list.querySelectorAll('.member-list-item').forEach((row) => {
    row.addEventListener('click', () => openMemberModal(row.dataset.id, () => refreshMemberList(modalEl)));
  });
  render();
}

const ROLE_OPTIONS = ['博士研究生', '硕士研究生', '本科生', '博士后', '研究助理', '其他'];

function roleOptions(selected) {
  const opts = new Set(ROLE_OPTIONS);
  if (selected && !opts.has(selected)) opts.add(selected);
  return Array.from(opts).map((r) => `<option value="${r}" ${r === selected ? 'selected' : ''}>${r}</option>`).join('');
}

function openMemberModal(id, onDone) {
  const m = id ? memberById(id) : null;
  const isEdit = !!m;
  const v = m || { name: '', role: '硕士研究生', note: '' };
  const html = `
    <div class="modal-title">${isEdit ? '编辑成员' : '新增成员'}</div>
    <form id="memberForm">
      <label>姓名<input name="name" autocomplete="off" placeholder="例如：张三" value="${esc(v.name)}"></label>
      <label>身份<select name="role">${roleOptions(v.role)}</select></label>
      <label>备注<textarea name="note" placeholder="可选">${esc(v.note || '')}</textarea></label>
      <div class="modal-actions">
        ${isEdit ? '<button type="button" class="del" id="mDel">删</button>' : ''}
        <button type="button" class="ghost" id="mCancel2">取消</button>
        <button type="submit" class="primary">保存</button>
      </div>
    </form>`;

  openModal(html, (mm) => {
    mm.querySelector('#mCancel2').addEventListener('click', closeModal);
    if (isEdit) mm.querySelector('#mDel').addEventListener('click', () => {
      state.members = state.members.filter((x) => x.id !== id);
      state.tasks.forEach((t) => { if (t.memberId === id) t.memberId = ''; });
      persist(); closeModal();
      if (state.ui.memberFilter === id) state.ui.memberFilter = null;
      if (onDone) onDone();
      else render();
    });
    mm.querySelector('#memberForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = e.target;
      const data = {
        name: f.name.value.trim(),
        role: f.role.value.trim(),
        note: f.note.value.trim(),
      };
      if (!data.name) { f.name.focus(); return; }
      if (isEdit) Object.assign(m, data);
      else state.members.push(Object.assign({ id: uid('m') }, data));
      persist(); closeModal();
      if (onDone) onDone();
      else render();
    });
  });
}

/* ---------------- chrome wiring ---------------- */
document.getElementById('fab').addEventListener('click', () => openTaskModal(null));

document.getElementById('btn-close').addEventListener('click', () => window.api.hide());
document.getElementById('btn-collapse').addEventListener('click', async () => {
  const r = await window.api.toggleCollapse();
  document.getElementById('app').classList.toggle('collapsed', r.collapsed);
});

document.getElementById('btn-top').addEventListener('click', async () => {
  const cur = await window.api.getWindowState();
  const next = await window.api.setAlwaysOnTop(!cur.alwaysOnTop);
  document.getElementById('btn-top').classList.toggle('active', next);
  document.getElementById('btn-top').title = next ? '置顶：开（点击取消）' : '置顶：关（点击开启）';
});

/* ---------------- boot ---------------- */
async function boot() {
  const data = await window.api.load();
  state.members = data.members || [];
  state.tasks = data.tasks || [];
  const ws = await window.api.getWindowState();
  document.getElementById('app').classList.toggle('collapsed', ws.collapsed);
  document.getElementById('btn-top').classList.toggle('active', ws.alwaysOnTop);
  document.getElementById('btn-top').title = ws.alwaysOnTop ? '置顶：开（点击取消）' : '置顶：关（点击开启）';
  render();
}

boot();
