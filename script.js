var MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
var MONTHS_FULL  = ['January','February','March','April','May','June','July','August','September','October','November','December'];

var CAT_COLORS = {
  Food:          { bg:'rgba(0,229,160,.6)',   border:'#00e5a0' },
  Transport:     { bg:'rgba(124,107,255,.6)', border:'#7c6bff' },
  Study:         { bg:'rgba(255,107,107,.6)', border:'#ff6b6b' },
  Entertainment: { bg:'rgba(255,179,71,.6)',  border:'#ffb347' },
  Health:        { bg:'rgba(0,200,230,.6)',   border:'#00c8e6' },
  Clothing:      { bg:'rgba(255,100,180,.6)', border:'#ff64b4' },
  Utilities:     { bg:'rgba(180,255,100,.6)', border:'#b4ff64' },
  Other:         { bg:'rgba(140,140,160,.6)', border:'#8c8ca0' }
};
var CAT_ICONS = { Food:'🍜', Transport:'🚌', Study:'📚', Entertainment:'🎮', Health:'💊', Clothing:'👕', Utilities:'💡', Other:'🔖' };

var state = { name:'', income:0, expenses:[], username:'' };
var yearlyChart = null, catChart = null, histCatChart = null;
var histViewMonth = (new Date().getMonth() - 1 + 12) % 12;
var userDB = {};
var toastTimer = null;

/* ── AUTH ── */
function switchAuth(tab) {
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-register').classList.toggle('active', tab === 'register');
  document.getElementById('panel-login').classList.toggle('active', tab === 'login');
  document.getElementById('panel-register').classList.toggle('active', tab === 'register');
  document.getElementById('login-err').style.display = 'none';
  document.getElementById('reg-err').style.display   = 'none';
  document.getElementById('reg-ok').style.display    = 'none';
}

function showErr(id, msg) {
  var el = document.getElementById(id);
  el.textContent = msg;
  el.style.display = 'block';
}

function doRegister() {
  var name   = document.getElementById('r-name').value.trim();
  var uname  = document.getElementById('r-user').value.trim().toLowerCase();
  var pass   = document.getElementById('r-pass').value;
  var pass2  = document.getElementById('r-pass2').value;
  var income = parseFloat(document.getElementById('r-income').value);

  document.getElementById('reg-err').style.display = 'none';
  document.getElementById('reg-ok').style.display  = 'none';

  if (!name || !uname || !pass || !pass2 || !income || income <= 0) { showErr('reg-err','Please fill in all fields correctly.'); return; }
  if (uname.length < 3)  { showErr('reg-err','Username must be at least 3 characters.'); return; }
  if (pass.length < 4)   { showErr('reg-err','Password must be at least 4 characters.'); return; }
  if (pass !== pass2)    { showErr('reg-err','Passwords do not match.'); return; }
  if (userDB[uname])     { showErr('reg-err','Username already taken. Choose another.'); return; }

  userDB[uname] = { name:name, pass:pass, income:income, expenses:[] };
  document.getElementById('reg-ok').style.display = 'block';
  document.getElementById('r-name').value = '';
  document.getElementById('r-user').value = '';
  document.getElementById('r-pass').value = '';
  document.getElementById('r-pass2').value = '';
  document.getElementById('r-income').value = '';

  setTimeout(function() {
    switchAuth('login');
    document.getElementById('l-user').value = uname;
  }, 1200);
}

function doLogin() {
  var uname = document.getElementById('l-user').value.trim().toLowerCase();
  var pass  = document.getElementById('l-pass').value;

  document.getElementById('login-err').style.display = 'none';

  if (!uname || !pass) { showErr('login-err','Please enter username and password.'); return; }

  var user = userDB[uname];
  if (!user || user.pass !== pass) { showErr('login-err','Invalid username or password.'); return; }

  state.name     = user.name;
  state.income   = user.income;
  state.username = uname;
  state.expenses = (user.expenses || []).map(function(e) {
    return { id:e.id, desc:e.desc, amt:e.amt, cat:e.cat, month:Number(e.month) };
  });

  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  document.getElementById('disp-name').textContent = user.name;
  document.getElementById('s-income').textContent  = fmt(user.income);
  document.getElementById('pm-max').textContent    = fmt(user.income);
  document.getElementById('e-month').value = new Date().getMonth();

  switchPage('dashboard');
  initCharts();
  refresh();
}

function persistUser() {
  if (state.username && userDB[state.username]) {
    userDB[state.username].expenses = state.expenses;
  }
}

function doLogout() {
  persistUser();
  state = { name:'', income:0, expenses:[], username:'' };
  document.getElementById('app').style.display = 'none';
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('l-user').value = '';
  document.getElementById('l-pass').value = '';
  switchAuth('login');
  if (yearlyChart)  { yearlyChart.destroy();  yearlyChart  = null; }
  if (catChart)     { catChart.destroy();     catChart     = null; }
  if (histCatChart) { histCatChart.destroy(); histCatChart = null; }
}

/* ── EXPENSE ── */
function onMonthChange() {
  var sel = Number(document.getElementById('e-month').value);
  var cur = new Date().getMonth();
  var hint = document.getElementById('prev-month-hint');
  var pqa  = document.getElementById('prev-quick-access');
  if (sel !== cur) {
    document.getElementById('hint-month-name').textContent = MONTHS_FULL[sel];
    hint.style.display = 'block';
  } else {
    hint.style.display = 'none';
    pqa.classList.remove('visible');
  }
}

function addExpense() {
  var desc  = document.getElementById('e-desc').value.trim();
  var amt   = parseFloat(document.getElementById('e-amt').value);
  var cat   = document.getElementById('e-cat').value;
  var month = Number(document.getElementById('e-month').value);

  if (!desc || !amt || amt <= 0) return;

  state.expenses.unshift({ id:Date.now(), desc:desc, amt:amt, cat:cat, month:month });
  document.getElementById('e-desc').value = '';
  document.getElementById('e-amt').value  = '';

  var cur = new Date().getMonth();
  if (month !== cur) {
    showToast('Saved to ' + MONTHS_FULL[month] + ' - see Previous Months');
    histViewMonth = month;
    document.getElementById('pqa-month').textContent = MONTHS_FULL[month];
    document.getElementById('prev-quick-access').classList.add('visible');
  }

  persistUser();
  refresh();
}

function delExpense(id) {
  state.expenses = state.expenses.filter(function(e) { return e.id !== id; });
  persistUser();
  refresh();
}

/* ── REFRESH ── */
function refresh() {
  var cur      = new Date().getMonth();
  var monthExp = state.expenses.filter(function(e) { return Number(e.month) === cur; });
  var spent    = monthExp.reduce(function(s,e) { return s+e.amt; }, 0);
  var remain   = state.income - spent;
  var pct      = state.income > 0 ? Math.min((spent/state.income)*100, 100) : 0;

  document.getElementById('s-spent').textContent     = fmt(spent);
  document.getElementById('s-spent-sub').textContent = pct.toFixed(1) + '% of budget';
  document.getElementById('s-remaining').textContent = fmt(Math.max(remain,0));
  document.getElementById('s-count').textContent     = monthExp.length;

  var fill  = document.getElementById('prog-fill');
  var pctEl = document.getElementById('prog-pct');
  fill.style.width  = pct + '%';
  pctEl.textContent = pct.toFixed(1) + '%';

  if (pct >= 100) {
    fill.style.background = 'linear-gradient(90deg,var(--accent3),#ff4444)';
    pctEl.style.color = 'var(--accent3)';
  } else if (pct >= 80) {
    fill.style.background = 'linear-gradient(90deg,var(--warn),#ff8c00)';
    pctEl.style.color = 'var(--warn)';
  } else {
    fill.style.background = 'linear-gradient(90deg,var(--accent),#00c8a0)';
    pctEl.style.color = 'var(--accent)';
  }

  var banner = document.getElementById('alert-banner');
  var amsg   = document.getElementById('alert-msg');
  if (pct >= 100) {
    banner.style.display = 'block';
    amsg.textContent = 'You exceeded your budget by ' + fmt(Math.abs(remain)) + '! Stop non-essential spending.';
  } else if (pct >= 80) {
    banner.style.display = 'block';
    amsg.textContent = 'You used ' + pct.toFixed(1) + '% of your ' + fmt(state.income) + ' budget. Only ' + fmt(Math.max(remain,0)) + ' left.';
  } else {
    banner.style.display = 'none';
  }

  renderList();
  if (yearlyChart && catChart) {
    updateCharts();
  } else {
    initCharts();
    updateCharts();
  }
}

/* ── LIST ── */
function renderList() {
  var el  = document.getElementById('expense-list');
  var cur = new Date().getMonth();
  var all = state.expenses.slice(0,30);

  if (!all.length) { el.innerHTML = '<div class="empty-state">No expenses yet. Add your first entry.</div>'; return; }

  var curr = all.filter(function(e) { return Number(e.month) === cur; });
  var prev = all.filter(function(e) { return Number(e.month) !== cur; });
  var html = '';

  if (curr.length) { html += '<div class="list-divider">This Month</div>'; curr.forEach(function(e){ html += itemHTML(e,false); }); }
  if (prev.length) { html += '<div class="list-divider">Previous Months</div>'; prev.forEach(function(e){ html += itemHTML(e,true); }); }
  el.innerHTML = html;
}

function itemHTML(e, isPrev) {
  var c   = CAT_COLORS[e.cat] || CAT_COLORS.Other;
  var cls = isPrev ? ' prev-month' : '';
  var tag = isPrev ? '<span class="expense-month-tag">'+MONTHS_FULL[e.month]+'</span>' : '';
  var del = isPrev ? '<span style="font-size:12px;opacity:.4;padding:4px">&#128274;</span>'
                   : '<button class="btn-del" onclick="delExpense('+e.id+')">x</button>';
  return '<div class="expense-item'+cls+'">'
    +'<div class="expense-cat-dot" style="background:'+c.bg+';border:1px solid '+c.border+'">'+(CAT_ICONS[e.cat]||'')+'</div>'
    +'<div class="expense-info"><div class="expense-name">'+e.desc+'</div><div class="expense-meta">'+tag+e.cat+'</div></div>'
    +'<div class="expense-amount">'+fmt(e.amt)+'</div>'
    +del+'</div>';
}

/* ── CHARTS ── */
function initCharts() {
  Chart.defaults.color       = '#5c7094';
  Chart.defaults.borderColor = '#1f2d44';
  Chart.defaults.font.family = "'DM Sans',sans-serif";

  if (yearlyChart) { yearlyChart.destroy(); yearlyChart = null; }
  if (catChart)    { catChart.destroy();    catChart    = null; }

  var c1 = document.getElementById('yearly-chart').getContext('2d');
  yearlyChart = new Chart(c1, {
    type:'bar',
    data:{
      labels:MONTHS_SHORT,
      datasets:[{
        label:'Expenses',
        data:new Array(12).fill(0),
        backgroundColor:MONTHS_SHORT.map(function(_,i){ return i===new Date().getMonth()?'rgba(0,229,160,.8)':'rgba(124,107,255,.5)'; }),
        borderColor:MONTHS_SHORT.map(function(_,i){ return i===new Date().getMonth()?'#00e5a0':'#7c6bff'; }),
        borderWidth:1.5, borderRadius:6, borderSkipped:false
      }]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{display:false},
        tooltip:{
          callbacks:{
            title:function(items){ return MONTHS_FULL[items[0].dataIndex]; },
            label:function(c){ return ' Total: Rs '+c.parsed.y.toLocaleString('en-IN'); }
          },
          backgroundColor:'#1a2235',borderColor:'#1f2d44',borderWidth:1,padding:12
        }
      },
      scales:{
        x:{grid:{display:false}},
        y:{beginAtZero:true,ticks:{callback:function(v){return 'Rs '+(v>=1000?(v/1000).toFixed(0)+'k':v);}}}
      }
    }
  });

  var c2 = document.getElementById('cat-chart').getContext('2d');
  catChart = new Chart(c2, {
    type:'doughnut',
    data:{labels:[],datasets:[{data:[],backgroundColor:[],borderColor:[],borderWidth:2}]},
    options:{
      responsive:true, maintainAspectRatio:true, cutout:'68%',
      plugins:{
        legend:{display:false},
        tooltip:{
          callbacks:{
            label:function(c){
              var total = c.dataset.data.reduce(function(s,v){return s+v;},0);
              var pct   = total>0 ? ((c.parsed/total)*100).toFixed(1)+'%' : '';
              return ' '+c.label+': Rs '+c.parsed.toLocaleString('en-IN')+' ('+pct+')';
            }
          },
          backgroundColor:'#1a2235',borderColor:'#1f2d44',borderWidth:1,padding:10
        }
      }
    }
  });
}

function updateCharts() {
  if (!yearlyChart || !catChart) { initCharts(); }
  if (!yearlyChart || !catChart) return;

  var cur = new Date().getMonth();

  var monthly = new Array(12).fill(0);
  state.expenses.forEach(function(e) { monthly[Number(e.month)] += e.amt; });
  yearlyChart.data.datasets[0].data = monthly;
  yearlyChart.data.datasets[0].backgroundColor = MONTHS_SHORT.map(function(_,i){
    return i === cur ? 'rgba(0,229,160,.85)' : 'rgba(124,107,255,.45)';
  });
  yearlyChart.data.datasets[0].borderColor = MONTHS_SHORT.map(function(_,i){
    return i === cur ? '#00e5a0' : '#7c6bff';
  });
  yearlyChart.update();

  var catT = {};
  state.expenses
    .filter(function(e) { return Number(e.month) === cur; })
    .forEach(function(e) { catT[e.cat] = (catT[e.cat] || 0) + e.amt; });
  var cats = Object.keys(catT);
  catChart.data.labels                      = cats;
  catChart.data.datasets[0].data            = cats.map(function(c) { return catT[c]; });
  catChart.data.datasets[0].backgroundColor = cats.map(function(c) { return (CAT_COLORS[c]||CAT_COLORS.Other).bg; });
  catChart.data.datasets[0].borderColor     = cats.map(function(c) { return (CAT_COLORS[c]||CAT_COLORS.Other).border; });
  catChart.update();

  document.getElementById('pie-month-label').textContent = MONTHS_FULL[cur];

  var leg   = document.getElementById('pie-legend');
  var total = cats.reduce(function(s,c) { return s + catT[c]; }, 0);
  if (!cats.length) {
    leg.innerHTML = '<div style="font-size:12px;color:var(--muted);text-align:center;padding:10px 0">No expenses this month yet</div>';
  } else {
    leg.innerHTML = cats.map(function(c) {
      var col = (CAT_COLORS[c]||CAT_COLORS.Other).border;
      var pct = total > 0 ? ((catT[c]/total)*100).toFixed(1) + '%' : '';
      return '<div class="legend-item">'
        + '<div class="legend-dot" style="background:'+col+'"></div>'
        + '<span class="legend-label">'+(CAT_ICONS[c]||'')+' '+c+'</span>'
        + '<span style="font-size:11px;color:var(--muted);margin-right:6px">'+pct+'</span>'
        + '<span class="legend-val" style="color:'+col+'">'+fmt(catT[c])+'</span>'
        + '</div>';
    }).join('');
  }
}

/* ── PAGE SWITCH ── */
function switchPage(page) {
  document.getElementById('page-dashboard').style.display = page==='dashboard' ? '' : 'none';
  document.getElementById('page-history').style.display   = page==='history'   ? '' : 'none';
  document.getElementById('ntab-dash').classList.toggle('active', page==='dashboard');
  document.getElementById('ntab-hist').classList.toggle('active', page==='history');
  if (page==='history') {
    var cur = new Date().getMonth();
    if (histViewMonth===cur) histViewMonth=(cur-1+12)%12;
    renderHistory();
  }
}

function jumpToHistory() { switchPage('history'); }

/* ── HISTORY ── */
function histNav(dir) {
  var cur  = new Date().getMonth();
  var next = (histViewMonth + dir + 12) % 12;
  if (next===cur) next=(next+dir+12)%12;
  histViewMonth = next;
  renderHistory();
}

function renderHistory() {
  var cur = new Date().getMonth();
  if (histViewMonth===cur) histViewMonth=(cur-1+12)%12;

  document.getElementById('hist-month-label').textContent = MONTHS_FULL[histViewMonth];
  document.getElementById('hist-month-name').textContent  = MONTHS_FULL[histViewMonth];
  document.getElementById('hist-cat-month').textContent   = MONTHS_FULL[histViewMonth];

  var nextM = (histViewMonth+1)%12;
  document.getElementById('hist-next-btn').disabled = (nextM===cur);
  document.getElementById('hist-prev-btn').disabled = false;

  var exp   = state.expenses.filter(function(e){ return Number(e.month)===histViewMonth; });
  var spent = exp.reduce(function(s,e){ return s+e.amt; },0);
  var saved = Math.max(state.income-spent,0);
  var pct   = state.income>0 ? ((spent/state.income)*100).toFixed(1) : '0.0';

  document.getElementById('hs-spent').textContent     = fmt(spent);
  document.getElementById('hs-spent-sub').textContent = pct+'% of '+fmt(state.income);
  document.getElementById('hs-saved').textContent     = fmt(saved);
  document.getElementById('hs-saved-sub').textContent = spent>state.income ? 'Over budget!' : 'saved / unspent';
  document.getElementById('hs-count').textContent     = exp.length;

  var listEl = document.getElementById('hist-expense-list');
  if (!exp.length) {
    listEl.innerHTML = '<div class="empty-state">No expenses recorded for <strong style="color:var(--accent2)">'+MONTHS_FULL[histViewMonth]+'</strong>.<br><span style="font-size:11px;color:var(--muted)">Add an expense with this month selected and it will appear here.</span></div>';
  } else {
    listEl.innerHTML = exp.map(function(e){
      var c = CAT_COLORS[e.cat]||CAT_COLORS.Other;
      return '<div class="hist-item">'
        +'<div class="expense-cat-dot" style="background:'+c.bg+';border:1px solid '+c.border+'">'+(CAT_ICONS[e.cat]||'')+'</div>'
        +'<div class="expense-info"><div class="expense-name">'+e.desc+'</div><div class="expense-meta">'+MONTHS_FULL[e.month]+' - '+e.cat+'</div></div>'
        +'<div class="expense-amount" style="margin-right:28px">'+fmt(e.amt)+'</div>'
        +'</div>';
    }).join('');
  }

  var catT   = {};
  exp.forEach(function(e){ catT[e.cat]=(catT[e.cat]||0)+e.amt; });
  var cats   = Object.keys(catT).sort(function(a,b){ return catT[b]-catT[a]; });
  var maxVal = cats.length ? catT[cats[0]] : 1;
  var barsEl = document.getElementById('hist-cat-bars');

  if (histCatChart) { histCatChart.destroy(); histCatChart=null; }

  if (!cats.length) {
    barsEl.innerHTML = '<div style="font-size:12px;color:var(--muted);text-align:center;padding:20px 0">No data for this month</div>';
  } else {
    barsEl.innerHTML = cats.map(function(c){
      var pctB = ((catT[c]/maxVal)*100).toFixed(1);
      var col  = (CAT_COLORS[c]||CAT_COLORS.Other).border;
      return '<div class="cat-row">'
        +'<div class="cat-row-label">'+(CAT_ICONS[c]||'')+' '+c+'</div>'
        +'<div class="cat-row-bar-wrap"><div class="cat-row-bar" style="width:'+pctB+'%;background:'+col+'"></div></div>'
        +'<div class="cat-row-val" style="color:'+col+'">'+fmt(catT[c])+'</div>'
        +'</div>';
    }).join('');

    var ctx = document.getElementById('hist-cat-chart').getContext('2d');
    histCatChart = new Chart(ctx, {
      type:'doughnut',
      data:{
        labels:cats,
        datasets:[{
          data:cats.map(function(c){return catT[c];}),
          backgroundColor:cats.map(function(c){return (CAT_COLORS[c]||CAT_COLORS.Other).bg;}),
          borderColor:cats.map(function(c){return (CAT_COLORS[c]||CAT_COLORS.Other).border;}),
          borderWidth:2
        }]
      },
      options:{
        responsive:true, maintainAspectRatio:true, cutout:'65%',
        plugins:{
          legend:{display:false},
          tooltip:{callbacks:{label:function(c){return ' Rs '+c.parsed.toLocaleString('en-IN');}},backgroundColor:'#1a2235',borderColor:'#1f2d44',borderWidth:1,padding:10}
        }
      }
    });
  }
}

/* ── TOAST ── */
function showToast(msg) {
  var t   = document.getElementById('toast');
  var m   = document.getElementById('toast-msg');
  var bar = document.getElementById('toast-bar');
  m.textContent = msg;
  t.classList.add('show');
  bar.style.animation = 'none';
  bar.offsetHeight;
  bar.style.animation = 'shrink 3s linear forwards';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function(){ t.classList.remove('show'); }, 3200);
}

/* ── HELPERS ── */
function fmt(n) { return 'Rs ' + Number(n).toLocaleString('en-IN',{maximumFractionDigits:0}); }

/* ── ENTER KEY ── */
document.addEventListener('keydown', function(e) {
  if (e.key !== 'Enter') return;
  var auth = document.getElementById('auth-screen');
  if (auth && auth.style.display !== 'none') {
    if (document.getElementById('panel-login').classList.contains('active')) doLogin();
    else doRegister();
  }
});
