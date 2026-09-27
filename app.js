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
      '<button class="btn small" data-match-job="' + esc(j.id) + '">简历匹配</button>' +
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
      box.querySelectorAll('[data-match-job]').forEach(function (b) {
        b.addEventListener('click', function () { requestMatch(b.dataset.matchJob); });
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

/* ================= 简历模块 ================= */
var RESULT_CACHE = {};

function switchTab(id) {
  document.querySelectorAll('.tabbar button').forEach(function (b) {
    b.classList.toggle('active', b.dataset.tab === id);
  });
  document.querySelectorAll('.tab-panel').forEach(function (p) {
    p.classList.toggle('active', p.id === id);
  });
  window.scrollTo(0, 0);
}

async function extractTextFromFile(file) {
  var name = (file.name || '').toLowerCase();
  if (name.endsWith('.pdf')) {
    if (window.pdfjsLib && pdfjsLib.GlobalWorkerOptions) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
    var buf = await file.arrayBuffer();
    var pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    var parts = [];
    for (var i = 1; i <= pdf.numPages; i++) {
      var page = await pdf.getPage(i);
      var tc = await page.getTextContent();
      parts.push(tc.items.map(function (it) { return it.str; }).join(' '));
    }
    return parts.join('\n');
  }
  if (name.endsWith('.docx')) {
    var buf2 = await file.arrayBuffer();
    var res = await mammoth.extractRawText({ arrayBuffer: buf2 });
    return res.value;
  }
  return await file.text();
}

async function loadResumeMaster() {
  var box = document.getElementById('resume-master');
  try {
    var r = await sb.from('resumes').select('id,title,file_name,content_text,created_at').eq('is_master', true).order('created_at', { ascending: false }).limit(1);
    if (r.error) throw r.error;
    if (!r.data.length) { box.innerHTML = '<div class="hint">还没有上传简历。</div>'; return; }
    var m = r.data[0];
    var words = m.content_text.trim().split(/\s+/).length;
    box.innerHTML = '<div class="card"><h3>' + esc(m.title) + '</h3>' +
      '<div class="meta">' + esc(m.file_name || '') + ' · 约 ' + words + ' 词 · ' + esc(fmtDateTime(m.created_at)) + '</div>' +
      '<pre class="note-content">' + esc(m.content_text.slice(0, 600)) + (m.content_text.length > 600 ? '\n…' : '') + '</pre></div>';
  } catch (e) { box.innerHTML = emptyHTML('加载失败：' + e.message); }
}

async function loadMaterials() {
  var box = document.getElementById('material-list');
  try {
    var r = await sb.from('materials').select('*').order('created_at', { ascending: false }).limit(50);
    if (r.error) throw r.error;
    var rows = r.data || [];
    document.getElementById('material-update-btn').style.display = rows.length ? '' : 'none';
    box.innerHTML = rows.length ? rows.map(function (m) {
      return '<label class="mat-row"><input type="checkbox" data-mat="' + esc(m.id) + '"> ' +
        '<span class="grow"><b>' + esc(m.title) + '</b> <span class="meta">' + esc(fmtDate(m.created_at)) + '</span></span>' +
        '<button class="mini-btn" data-mat-del="' + esc(m.id) + '">删除</button></label>';
    }).join('') : '<div class="hint">还没有辅助材料。</div>';
    box.querySelectorAll('[data-mat-del]').forEach(function (b) {
      b.addEventListener('click', async function (ev) {
        ev.preventDefault();
        if (!confirm('删除这份材料？')) return;
        var del = await sb.from('materials').delete().eq('id', b.dataset.matDel);
        if (del.error) toast('删除失败：' + del.error.message);
        else { toast('已删除'); loadMaterials(); }
      });
    });
  } catch (e) { box.innerHTML = emptyHTML('加载失败：' + e.message); }
}

async function handleUpload(file, kind) {
  toast('正在解析…');
  try {
    var text = await extractTextFromFile(file);
    if (!text.trim()) { toast('没解析出文字，换一份试试'); return; }
    var name = prompt(kind === 'resume' ? '给这份简历起个名字：' : '给这份材料起个名字：', file.name.replace(/\.[^.]+$/, ''));
    if (name === null) return;
    if (kind === 'resume') {
      await sb.from('resumes').update({ is_master: false }).eq('is_master', true);
      var ins = await sb.from('resumes').insert({ title: (name || '主简历'), file_name: file.name, content_text: text, is_master: true });
      if (ins.error) throw ins.error;
      toast('简历已上传');
      loadResumeMaster();
    } else {
      var ins2 = await sb.from('materials').insert({ title: (name || file.name), file_name: file.name, content_text: text });
      if (ins2.error) throw ins2.error;
      toast('材料已上传');
      loadMaterials();
    }
  } catch (e) { toast('失败：' + e.message); }
}

async function requestMatch(jobId) {
  try {
    var r = await sb.from('resumes').select('id').eq('is_master', true).limit(1);
    if (r.error) throw r.error;
    if (!r.data.length) { toast('请先在"简历"页上传简历'); switchTab('tab-resume'); return; }
    var ins = await sb.from('resume_requests').insert({ type: 'match', resume_id: r.data[0].id, job_id: jobId, status: 'pending' });
    if (ins.error) throw ins.error;
    toast('已提交，约 20 分钟后在"简历"页查看结果');
  } catch (e) { toast('提交失败：' + e.message); }
}

async function loadResumeResults() {
  var box = document.getElementById('resume-results');
  box.innerHTML = loadingHTML();
  try {
    var r = await sb.from('resume_results').select('*').order('created_at', { ascending: false }).limit(50);
    if (r.error) throw r.error;
    var rows = r.data || [];
    if (!rows.length) { box.innerHTML = emptyHTML('还没有匹配结果。在"岗位"页点任意岗位的"简历匹配"即可。'); return; }
    rows.forEach(function (x) { RESULT_CACHE[x.id] = x; });
    box.innerHTML = rows.map(function (x) {
      var head = x.job_title ? ('针对 ' + x.company + ' · ' + x.job_title) : '简历更新版';
      return '<div class="card"><h3>' + esc(head) + '</h3>' +
        '<div class="meta">' + esc(fmtDateTime(x.created_at)) + '</div>' +
        (x.analysis ? '<div class="match"><b>匹配分析</b><pre class="note-content">' + esc(x.analysis) + '</pre></div>' : '') +
        (x.tailored_resume ? '<details><summary>查看定制版简历全文</summary><pre class="note-content">' + esc(x.tailored_resume) + '</pre></details>' : '') +
        (x.tailored_resume ? '<div class="actions"><button class="btn small" data-dl="' + esc(x.id) + '">下载定制简历 (.md)</button></div>' : '') +
      '</div>';
    }).join('');
    box.querySelectorAll('[data-dl]').forEach(function (b) {
      b.addEventListener('click', function () {
        var x = RESULT_CACHE[b.dataset.dl];
        if (!x || !x.tailored_resume) return;
        var blob = new Blob([x.tailored_resume], { type: 'text/markdown;charset=utf-8' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = ('resume_' + (x.company || 'custom')).replace(/\s+/g, '_') + '.md';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 5000);
      });
    });
  } catch (e) { box.innerHTML = emptyHTML('加载失败：' + e.message); }
}

document.getElementById('resume-upload').addEventListener('change', function (ev) {
  var f = ev.target.files[0];
  ev.target.value = '';
  if (f) handleUpload(f, 'resume');
});
document.getElementById('material-upload').addEventListener('change', function (ev) {
  var f = ev.target.files[0];
  ev.target.value = '';
  if (f) handleUpload(f, 'material');
});
document.getElementById('material-update-btn').addEventListener('click', async function () {
  var ids = Array.prototype.map.call(document.querySelectorAll('[data-mat]:checked'), function (c) { return c.dataset.mat; });
  if (!ids.length) { toast('请先勾选材料'); return; }
  try {
    var r = await sb.from('resumes').select('id').eq('is_master', true).limit(1);
    if (r.error) throw r.error;
    if (!r.data.length) { toast('请先上传简历'); return; }
    var ins = await sb.from('resume_requests').insert({ type: 'update', resume_id: r.data[0].id, material_ids: ids, status: 'pending' });
    if (ins.error) throw ins.error;
    toast('已提交，约 20 分钟后生成新版简历');
  } catch (e) { toast('提交失败：' + e.message); }
});
document.getElementById('resume-refresh').addEventListener('click', function () {
  loadResumeMaster(); loadMaterials(); loadResumeResults();
});


/* ---------- 初始化 ---------- */
loadJobs();
loadPlan();
loadApps();
loadAppOptions();
loadInterviews();
loadResumeMaster();
loadMaterials();
loadResumeResults();
