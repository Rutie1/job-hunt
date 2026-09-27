/* 求职助手 - Supabase 数据层 + 5 个 tab 渲染逻辑 */
var SUPABASE_URL = 'https://arvpykrfraabwbnwlgje.supabase.co';
var SUPABASE_KEY = 'sb_publishable_TjINRMrM7lD8E-BIcaOlRg_-gJznHwL'; // 公开钥匙，可嵌入网页
var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

var REGION_LABEL = { ny_metro: '纽约大都会', nc: '北卡', other_us: '美国其他' };
var CATEGORY_LABEL = { quant: '量化', risk: '风险', data: '数据 / 数科', economist: '经济学家', faculty: '教职', other: '其他' };
var APP_STATUS = {
  interested: '感兴趣', applied: '已投递', oa: '笔试 OA',
  interview: '面试中', offer: '已拿 offer', rejected: '被拒', withdrawn: '撤回'
};
var TASK_STATUS = { todo: '待办', doing: '进行中', done: '已完成' };

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function toast(msg) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(function () { t.classList.remove('show'); }, 2200);
}
function loadingHTML() { return '<div class="loading">加载中…</div>'; }
function emptyHTML(text) { return '<div class="empty">' + esc(text) + '</div>'; }
function fmtDate(d) {
  if (!d) return '';
  return String(d).slice(0, 10);
}
function fmtDateTime(d) {
  if (!d) return '';
  var x = new Date(d);
  if (isNaN(x)) return String(d);
  var p = function (n) { return (n < 10 ? '0' : '') + n; };
  return x.getFullYear() + '-' + p(x.getMonth() + 1) + '-' + p(x.getDate()) + ' ' + p(x.getHours()) + ':' + p(x.getMinutes());
}
function todayStr() {
  var n = new Date();
  var p = function (x) { return (x < 10 ? '0' : '') + x; };
  return n.getFullYear() + '-' + p(n.getMonth() + 1) + '-' + p(n.getDate());
}

/* ---------- tab 切换 ---------- */
document.querySelectorAll('.tabbar button').forEach(function (btn) {
  btn.addEventListener('click', function () {
    document.querySelectorAll('.tabbar button').forEach(function (b) { b.classList.remove('active'); });
    document.querySelectorAll('.tab-panel').forEach(function (p) { p.classList.remove('active'); });
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
    window.scrollTo(0, 0);
  });
});

/* ================= 岗位（业界 / 教职双列） ================= */
function jobCard(j) {
  return '<div class="card">' +
    '<h3>' + esc(j.title) + '</h3>' +
    '<div class="meta">' + esc(j.company || '') +
      (j.location ? ' · ' + esc(j.location) : '') +
      (j.posted_text ? ' · 发布于 ' + esc(j.posted_text) : '') + '</div>' +
    '<div style="margin-top:6px;">' +
      (j.region ? '<span class="tag region-' + esc(j.region) + '">' + esc(REGION_LABEL[j.region] || j.region) + '</span>' : '') +
      (j.category && j.category !== 'faculty' ? '<span class="tag">' + esc(CATEGORY_LABEL[j.category] || j.category) + '</span>' : '') +
    '</div>' +
    (j.match_note ? '<div class="match">' + esc(j.match_note) + '</div>' : '') +
    '<div class="actions">' +
      (j.url ? '<a class="link-btn" href="' + esc(j.url) + '" target="_blank" rel="noopener">查看详情 / 申请</a>' : '') +
      '<button class="btn small" data-add-app="' + esc(j.id) + '">加入投递</button>' +
    '</div>' +
  '</div>';
}
async function loadJobs() {
  var boxI = document.getElementById('jobs-industry');
  var boxF = document.getElementById('jobs-faculty');
  boxI.innerHTML = loadingHTML();
  boxF.innerHTML = loadingHTML();
  var region = document.getElementById('filter-region').value;
  try {
    var q = sb.from('jobs').select('*').eq('is_active', true).order('discovered_at', { ascending: false }).limit(200);
    if (region) q = q.eq('region', region);
    var res = await q;
    if (res.error) throw res.error;
    var rows = res.data || [];
    var ind = rows.filter(function (j) { return j.category !== 'faculty'; });
    var fac = rows.filter(function (j) { return j.category === 'faculty'; });
    boxI.innerHTML = ind.length ? ind.map(jobCard).join('') : emptyHTML('暂无业界岗位，下一轮自动更新（每天 9:00 / 17:00）后会显示在这里。');
    boxF.innerHTML = fac.length ? fac.map(jobCard).join('') : emptyHTML('暂无教职岗位，下一轮自动更新后会显示在这里。');
    [boxI, boxF].forEach(function (box) {
      box.querySelectorAll('[data-add-app]').forEach(function (b) {
        b.addEventListener('click', function () { addAppFromJob(b.dataset.addApp); });
      });
    });
  } catch (e) {
    boxI.innerHTML = emptyHTML('加载失败：' + e.message);
    boxF.innerHTML = '';
  }
}
async function addAppFromJob(jobId) {
  try {
    var r = await sb.from('jobs').select('*').eq('id', jobId).single();
    if (r.error) throw r.error;
    var j = r.data;
    var ins = await sb.from('applications').insert({
      job_id: j.id, company: j.company, title: j.title,
      location: j.location, url: j.url, status: 'interested',
      notes: '从岗位列表加入'
    });
    if (ins.error) throw ins.error;
    toast('已加入投递管理');
  } catch (e) {
    toast('加入失败：' + e.message);
  }
}
document.getElementById('filter-region').addEventListener('change', loadJobs);
document.getElementById('jobs-refresh').addEventListener('click', loadJobs);

/* ================= 求职计划 ================= */
async function loadPlan() {
  var box = document.getElementById('plan-list');
  box.innerHTML = loadingHTML();
  try {
    var res = await sb.from('timeline_tasks').select('*').order('sort_order', { ascending: true });
    if (res.error) throw res.error;
    var rows = res.data || [];
    if (!rows.length) {
      box.innerHTML = emptyHTML('暂无计划任务。');
      return;
    }
    var phases = [], seen = {};
    rows.forEach(function (t) {
      if (!seen[t.phase]) { seen[t.phase] = []; phases.push(t.phase); }
      seen[t.phase].push(t);
    });
    var today = todayStr();
    box.innerHTML = phases.map(function (ph) {
      var items = seen[ph].map(function (t) {
        var overdue = t.due_date && t.due_date < today && t.status !== 'done';
        var cls = 'task-row' + (overdue ? ' overdue' : '') + (t.status === 'done' ? ' done-task' : '');
        return '<div class="' + cls + '">' +
          '<div class="grow">' +
            '<div class="t-title">' + esc(t.title) + '</div>' +
            (t.detail ? '<div class="t-detail">' + esc(t.detail) + '</div>' : '') +
            '<div style="margin-top:4px;">' +
              (t.due_date ? '<span class="tag' + (overdue ? ' overdue' : '') + '">' +
                (overdue ? '已逾期 · ' : '') + '截止 ' + esc(fmtDate(t.due_date)) + '</span>' : '') +
              (t.status === 'done' ? '<span class="tag done">已完成</span>' : '') +
            '</div>' +
          '</div>' +
          '<select data-task="' + esc(t.id) + '">' +
            Object.keys(TASK_STATUS).map(function (k) {
              return '<option value="' + k + '"' + (t.status === k ? ' selected' : '') + '>' + TASK_STATUS[k] + '</option>';
            }).join('') +
          '</select>' +
        '</div>';
      }).join('');
      return '<div class="plan-phase"><h3>' + esc(ph) + '</h3>' + items + '</div>';
    }).join('');
    box.querySelectorAll('[data-task]').forEach(function (sel) {
      sel.addEventListener('change', async function () {
        var r = await sb.from('timeline_tasks').update({ status: sel.value }).eq('id', sel.dataset.task);
        if (r.error) { toast('更新失败：' + r.error.message); loadPlan(); }
        else { toast('已更新'); loadPlan(); }
      });
    });
  } catch (e) {
    box.innerHTML = emptyHTML('加载失败：' + e.message);
  }
}
document.getElementById('plan-refresh').addEventListener('click', loadPlan);

/* ================= 投递管理 ================= */
async function loadApps() {
  var box = document.getElementById('apps-list');
  box.innerHTML = loadingHTML();
  var f = document.getElementById('apps-status-filter').value;
  try {
    var q = sb.from('applications').select('*').order('created_at', { ascending: false }).limit(300);
    if (f) q = q.eq('status', f);
    var res = await q;
    if (res.error) throw res.error;
    var rows = res.data || [];
    if (!rows.length) {
      box.innerHTML = emptyHTML('还没有投递记录。在岗位 tab 点"加入投递"，或用上方表单手动添加。');
      return;
    }
    box.innerHTML = rows.map(function (a) {
      return '<div class="card">' +
        '<h3>' + esc(a.title) + '</h3>' +
        '<div class="meta">' + esc(a.company || '') +
          (a.location ? ' · ' + esc(a.location) : '') +
          (a.applied_at ? ' · 投递于 ' + esc(fmtDate(a.applied_at)) : '') + '</div>' +
        (a.notes ? '<div class="meta">' + esc(a.notes) + '</div>' : '') +
        '<div class="status-line">' +
          '<select data-app-status="' + esc(a.id) + '">' +
            Object.keys(APP_STATUS).map(function (k) {
              return '<option value="' + k + '"' + (a.status === k ? ' selected' : '') + '>' + APP_STATUS[k] + '</option>';
            }).join('') +
          '</select>' +
          (a.url ? '<a class="link-btn" style="flex:0 0 auto;" href="' + esc(a.url) + '" target="_blank" rel="noopener">岗位链接</a>' : '') +
          '<button class="mini-btn" data-app-del="' + esc(a.id) + '">删除</button>' +
        '</div>' +
      '</div>';
    }).join('');
    box.querySelectorAll('[data-app-status]').forEach(function (sel) {
      sel.addEventListener('change', async function () {
        var upd = { status: sel.value, updated_at: new Date().toISOString() };
        if (sel.value === 'applied') upd.applied_at = todayStr();
        var r = await sb.from('applications').update(upd).eq('id', sel.dataset.appStatus);
        if (r.error) { toast('更新失败：' + r.error.message); }
        else { toast('状态已更新'); }
        loadApps();
      });
    });
    box.querySelectorAll('[data-app-del]').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (!confirm('确定删除这条投递记录吗？')) return;
        var r = await sb.from('applications').delete().eq('id', b.dataset.appDel);
        if (r.error) toast('删除失败：' + r.error.message);
        else { toast('已删除'); loadApps(); }
      });
    });
  } catch (e) {
    box.innerHTML = emptyHTML('加载失败：' + e.message);
  }
}
document.getElementById('app-form').addEventListener('submit', async function (ev) {
  ev.preventDefault();
  var fd = new FormData(ev.target);
  var payload = {
    company: (fd.get('company') || '').trim(),
    title: (fd.get('title') || '').trim(),
    location: (fd.get('location') || '').trim() || null,
    url: (fd.get('url') || '').trim() || null,
    notes: (fd.get('notes') || '').trim() || null,
    status: 'interested'
  };
  if (!payload.company || !payload.title) { toast('请填写公司和岗位名称'); return; }
  var r = await sb.from('applications').insert(payload);
  if (r.error) toast('添加失败：' + r.error.message);
  else { toast('已添加'); ev.target.reset(); loadApps(); }
});
document.getElementById('apps-status-filter').addEventListener('change', loadApps);
document.getElementById('apps-refresh').addEventListener('click', loadApps);

/* ================= 面试记录 ================= */
async function loadAppOptions() {
  var sel = document.getElementById('iv-app-select');
  try {
    var res = await sb.from('applications').select('id, company, title').order('created_at', { ascending: false }).limit(200);
    if (res.error) throw res.error;
    sel.innerHTML = '<option value="">关联投递（可选）</option>' +
      (res.data || []).map(function (a) {
        return '<option value="' + esc(a.id) + '">' + esc(a.company + ' · ' + a.title) + '</option>';
      }).join('');
  } catch (e) { /* 保持默认选项 */ }
}
async function loadInterviews() {
  var box = document.getElementById('iv-list');
  box.innerHTML = loadingHTML();
  try {
    var res = await sb.from('interviews').select('*').order('interview_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(200);
    if (res.error) throw res.error;
    var rows = res.data || [];
    if (!rows.length) {
      box.innerHTML = emptyHTML('还没有面试记录。');
      return;
    }
    box.innerHTML = rows.map(function (v) {
      return '<div class="card">' +
        '<h3>' + esc(v.company) + (v.round_desc ? ' · ' + esc(v.round_desc) : '') + '</h3>' +
        '<div class="meta">' +
          (v.interview_at ? fmtDateTime(v.interview_at) : '') +
          (v.format ? ' · ' + esc(v.format) : '') + '</div>' +
        (v.notes ? '<div class="meta"><b>过程：</b>' + esc(v.notes) + '</div>' : '') +
        (v.feedback ? '<div class="meta"><b>复盘：</b>' + esc(v.feedback) + '</div>' : '') +
        (v.follow_up ? '<div class="meta"><b>跟进：</b>' + esc(v.follow_up) + '</div>' : '') +
        '<div class="status-line"><button class="mini-btn" data-iv-del="' + esc(v.id) + '">删除</button></div>' +
      '</div>';
    }).join('');
    box.querySelectorAll('[data-iv-del]').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (!confirm('确定删除这条面试记录吗？')) return;
        var r = await sb.from('interviews').delete().eq('id', b.dataset.ivDel);
        if (r.error) toast('删除失败：' + r.error.message);
        else { toast('已删除'); loadInterviews(); }
      });
    });
  } catch (e) {
    box.innerHTML = emptyHTML('加载失败：' + e.message);
  }
}
document.getElementById('iv-form').addEventListener('submit', async function (ev) {
  ev.preventDefault();
  var fd = new FormData(ev.target);
  var at = (fd.get('interview_at') || '').trim();
  var payload = {
    company: (fd.get('company') || '').trim(),
    round_desc: (fd.get('round_desc') || '').trim() || null,
    interview_at: at ? new Date(at).toISOString() : null,
    format: (fd.get('format') || '').trim() || null,
    application_id: (fd.get('application_id') || '').trim() || null,
    notes: (fd.get('notes') || '').trim() || null,
    feedback: (fd.get('feedback') || '').trim() || null,
    follow_up: (fd.get('follow_up') || '').trim() || null
  };
  if (!payload.company) { toast('请填写公司'); return; }
  var r = await sb.from('interviews').insert(payload);
  if (r.error) toast('保存失败：' + r.error.message);
  else { toast('已保存'); ev.target.reset(); loadAppOptions(); loadInterviews(); }
});
document.getElementById('iv-refresh').addEventListener('click', loadInterviews);

/* ================= 简历 ================= */
async function loadResumeNotes() {
  var box = document.getElementById('resume-list');
  box.innerHTML = loadingHTML();
  try {
    var res = await sb.from('resume_notes').select('*').order('created_at', { ascending: false }).limit(100);
    if (res.error) throw res.error;
    var rows = res.data || [];
    if (!rows.length) {
      box.innerHTML = emptyHTML('还没有简历记录。');
      return;
    }
    box.innerHTML = rows.map(function (n) {
      return '<div class="card" data-note="' + esc(n.id) + '">' +
        '<h3>' + esc(n.title) + '</h3>' +
        '<div class="meta">' + esc(fmtDateTime(n.created_at)) + '</div>' +
        (n.content ? '<pre class="note-content">' + esc(n.content) + '</pre>' : '') +
        '<div class="status-line">' +
          '<button class="mini-btn" style="color:#2456d6;" data-note-edit="' + esc(n.id) + '">编辑</button>' +
          '<button class="mini-btn" data-note-del="' + esc(n.id) + '">删除</button>' +
        '</div>' +
      '</div>';
    }).join('');
    box.querySelectorAll('[data-note-del]').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (!confirm('确定删除这条记录吗？')) return;
        var r = await sb.from('resume_notes').delete().eq('id', b.dataset.noteDel);
        if (r.error) toast('删除失败：' + r.error.message);
        else { toast('已删除'); loadResumeNotes(); }
      });
    });
    box.querySelectorAll('[data-note-edit]').forEach(function (b) {
      b.addEventListener('click', function () { editResumeNote(b.dataset.noteEdit); });
    });
  } catch (e) {
    box.innerHTML = emptyHTML('加载失败：' + e.message);
  }
}
async function editResumeNote(id) {
  var card = document.querySelector('[data-note="' + id + '"]');
  if (!card || card.querySelector('.edit-area')) return;
  var titleEl = card.querySelector('h3');
  var pre = card.querySelector('.note-content');
  var area = document.createElement('div');
  area.className = 'edit-area';
  area.innerHTML =
    '<input id="edit-title-' + id + '" value="' + esc(titleEl.textContent) + '">' +
    '<textarea id="edit-content-' + id + '" rows="5">' + esc(pre ? pre.textContent : '') + '</textarea>' +
    '<div class="status-line"><button class="btn small primary" id="edit-save-' + id + '">保存</button>' +
    '<button class="btn small" id="edit-cancel-' + id + '">取消</button></div>';
  card.appendChild(area);
  document.getElementById('edit-cancel-' + id).addEventListener('click', function () { area.remove(); });
  document.getElementById('edit-save-' + id).addEventListener('click', async function () {
    var r = await sb.from('resume_notes').update({
      title: document.getElementById('edit-title-' + id).value.trim(),
      content: document.getElementById('edit-content-' + id).value.trim() || null
    }).eq('id', id);
    if (r.error) toast('保存失败：' + r.error.message);
    else { toast('已保存'); loadResumeNotes(); }
  });
}
document.getElementById('resume-form').addEventListener('submit', async function (ev) {
  ev.preventDefault();
  var fd = new FormData(ev.target);
  var payload = {
    title: (fd.get('title') || '').trim(),
    content: (fd.get('content') || '').trim() || null
  };
  if (!payload.title) { toast('请填写标题'); return; }
  var r = await sb.from('resume_notes').insert(payload);
  if (r.error) toast('保存失败：' + r.error.message);
  else { toast('已保存'); ev.target.reset(); loadResumeNotes(); }
});
document.getElementById('resume-refresh').addEventListener('click', loadResumeNotes);

/* ---------- 初始化 ---------- */
loadJobs();
loadPlan();
loadApps();
loadAppOptions();
loadInterviews();
loadResumeNotes();
