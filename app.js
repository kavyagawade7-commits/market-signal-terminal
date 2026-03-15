/* ═══════════════════════════════════════════════════════════════
   NEXUS · WAR ROOM AMBER · app.js
   Every panel is a live instrument. The storm breathes.
   ═══════════════════════════════════════════════════════════════ */
'use strict';

// ── State ────────────────────────────────────────────────────
const S = {
  focus:        'NIFTY 50',
  alertLevel:   'mid',       // low | mid | high
  chartData:    [],
  vixHistory:   [],
  vixVal:       14.23,
  riskVal:      42,
  pnlTrades:    [],
  cliHistory:   [],
  cliIdx:       -1,
  cliVisible:   false,
  tf:           '1D',
};

// ── Helpers ──────────────────────────────────────────────────
const $  = id => document.getElementById(id);
const q  = s  => document.querySelector(s);
const qa = s  => document.querySelectorAll(s);

function tween(from, to, dur, cb) {
  const start = performance.now();
  const tick = now => {
    const t = Math.min((now - start) / dur, 1);
    const e = 1 - Math.pow(1 - t, 3); // ease-out-cubic
    cb(from + (to - from) * e);
    if (t < 1) requestAnimationFrame(tick);
    else cb(to);
  };
  requestAnimationFrame(tick);
}

function fmt(n, decimals = 2) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function now() {
  return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

// ── Boot ─────────────────────────────────────────────────────
const BOOT_LINES = [
  'Establishing NSE / BSE data feeds...',
  'Loading SEBI regulatory module...',
  'Calibrating AI signal engine v3...',
  'Warming anomaly detection core...',
  'Mounting trade tape & order book...',
  'NEXUS READY — ALL INSTRUMENTS LIVE',
];

function runBoot() {
  const log  = $('bootLog');
  const bar  = $('bootBar');
  const pct  = $('bootPct');
  let i = 0;

  const next = () => {
    if (i >= BOOT_LINES.length) {
      setTimeout(() => {
        const boot = $('boot');
        boot.style.opacity = '0';
        setTimeout(() => { boot.style.display = 'none'; $('app').classList.remove('hidden'); initApp(); }, 700);
      }, 300);
      return;
    }
    const div = document.createElement('div');
    div.textContent = '▸ ' + BOOT_LINES[i];
    log.appendChild(div);
    i++;
    const p = (i / BOOT_LINES.length * 100);
    bar.style.width = p + '%';
    pct.textContent = Math.round(p) + '%';
    setTimeout(next, 340 + Math.random() * 180);
  };
  setTimeout(next, 500);
}

// ── Clock & metrics ──────────────────────────────────────────
function startClock() {
  const clockEl = $('clock');
  const dotEl   = $('mktDot');
  const txtEl   = $('mktText');
  const latEl   = $('latency');

  const tick = () => {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString('en-IN', { hour12: false });
    const h = now.getHours(), m = now.getMinutes();
    const open = (h > 9 || (h === 9 && m >= 15)) && (h < 15 || (h === 15 && m < 30));
    txtEl.textContent = open ? 'MARKET OPEN' : 'MARKET CLOSED';
    dotEl.classList.toggle('open', open);
  };
  tick();
  setInterval(tick, 1000);
  setInterval(() => { latEl.textContent = 5 + Math.floor(Math.random() * 20); }, 1800);
}

// ── Ticker tape ──────────────────────────────────────────────
const TICKER_SOURCE = [
  { sym: 'NIFTY',     p: 24853.15, c: +1.24 },
  { sym: 'SENSEX',    p: 81724.80, c: +0.98 },
  { sym: 'BANKNIFTY', p: 53120.45, c: -0.34 },
  { sym: 'RELIANCE',  p: 2947.60,  c: +2.10 },
  { sym: 'TCS',       p: 3812.30,  c: -0.82 },
  { sym: 'INFY',      p: 1623.45,  c: +0.55 },
  { sym: 'HDFCBANK',  p: 1782.90,  c: +1.44 },
  { sym: 'ITC',       p: 468.75,   c: +0.30 },
  { sym: 'MARUTI',    p: 11342.00, c: -1.12 },
  { sym: 'USDINR',    p: 83.48,    c: +0.12 },
  { sym: 'GOLD',      p: 72840,    c: +0.68 },
  { sym: 'CRUDE',     p: 6284,     c: -1.22 },
  { sym: 'VIX',       p: 14.23,    c: -3.40 },
];

let tickerState = TICKER_SOURCE.map(d => ({ ...d }));

function buildTickerHTML() {
  return tickerState.map(d => {
    const dir = d.c >= 0 ? 'up' : 'dn';
    const arrow = d.c >= 0 ? '▲' : '▼';
    return `<span class="tick-item">
      <span class="tick-sym">${d.sym}</span>
      <span class="tick-price">${fmt(d.p)}</span>
      <span class="tick-chg ${dir}">${arrow} ${Math.abs(d.c).toFixed(2)}%</span>
    </span>`;
  }).join('');
}

function initTicker() {
  const inner = $('tbTickerInner');
  const refresh = () => {
    const h = buildTickerHTML();
    inner.innerHTML = h + h; // double for seamless loop
  };
  refresh();
  setInterval(() => {
    tickerState.forEach(d => {
      d.p = Math.max(1, d.p * (1 + (Math.random() - 0.49) * 0.002));
      d.c += (Math.random() - 0.5) * 0.08;
    });
    refresh();
  }, 4000);
}

// ── Macro strip ──────────────────────────────────────────────
const MACRO_DATA = [
  { id: 'usdinr', name: 'USD/INR', val: 83.48,   chg: +0.12 },
  { id: 'gold',   name: 'GOLD',    val: 72840,    chg: +0.68 },
  { id: 'crude',  name: 'CRUDE',   val: 6284,     chg: -1.22 },
  { id: 'dxy',    name: 'DXY',     val: 104.32,   chg: +0.22 },
  { id: 'us10y',  name: 'US 10Y',  val: 4.34,     chg: +0.04 },
  { id: 'sp500',  name: 'S&P 500', val: 5127.79,  chg: +0.44 },
];
let macroState = MACRO_DATA.map(d => ({ ...d }));

function renderMacro() {
  const grid = $('macroGrid');
  grid.innerHTML = '';
  macroState.forEach(d => {
    const isPos = d.chg >= 0;
    const cell = document.createElement('div');
    cell.className = 'macro-cell';
    cell.innerHTML = `
      <div class="macro-name">${d.name}</div>
      <div class="macro-val">${fmt(d.val, d.val < 100 ? 2 : 0)}</div>
      <div class="macro-chg ${isPos ? 'pos' : 'neg'}">${isPos ? '▲' : '▼'} ${Math.abs(d.chg).toFixed(2)}%</div>
    `;
    grid.appendChild(cell);
  });
}

function initMacro() {
  renderMacro();
  setInterval(() => {
    macroState.forEach(d => {
      d.val = Math.max(0.01, d.val * (1 + (Math.random() - 0.49) * 0.0015));
      d.chg += (Math.random() - 0.5) * 0.05;
    });
    renderMacro();
  }, 3500);
}

// ── Indices with sparklines ───────────────────────────────────
const IDX_DATA = [
  { id: 'nifty50',   name: 'NIFTY 50',   val: 24853.15, chg: +1.24, hist: [] },
  { id: 'sensex',    name: 'SENSEX',     val: 81724.80, chg: +0.98, hist: [] },
  { id: 'banknifty', name: 'BANKNIFTY',  val: 53120.45, chg: -0.34, hist: [] },
  { id: 'niftyit',   name: 'NIFTY IT',   val: 38940.20, chg: -0.82, hist: [] },
  { id: 'auto',      name: 'NIFTY AUTO', val: 22415.60, chg: +1.72, hist: [] },
  { id: 'midcap',    name: 'MIDCAP 150', val: 19342.80, chg: +0.44, hist: [] },
];
let idxState = IDX_DATA.map(d => ({ ...d, hist: Array.from({ length: 20 }, () => d.val * (1 + (Math.random() - 0.5) * 0.005)) }));

function drawMiniSpark(canvas, data, isPos) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.offsetWidth || 40, H = canvas.offsetHeight || 20;
  canvas.width = W; canvas.height = H;
  const mn = Math.min(...data), mx = Math.max(...data), rng = mx - mn || 1;
  const step = W / (data.length - 1);
  ctx.clearRect(0, 0, W, H);
  ctx.beginPath();
  ctx.strokeStyle = isPos ? '#00e5a0' : '#ff3355';
  ctx.lineWidth = 1.2;
  ctx.lineJoin = 'round';
  data.forEach((v, i) => {
    const x = i * step, y = H - ((v - mn) / rng) * H * 0.8 - H * 0.1;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function renderIndices() {
  const list = $('idxList');
  list.innerHTML = '';
  idxState.forEach(d => {
    const isPos = d.chg >= 0;
    const row = document.createElement('div');
    row.className = 'idx-row' + (d.name === S.focus ? ' focused' : '');
    row.dataset.name = d.name;
    row.innerHTML = `
      <canvas class="idx-spark-mini" width="40" height="20"></canvas>
      <div class="idx-info">
        <div class="idx-name">${d.name}</div>
        <div class="idx-price">${fmt(d.val)}</div>
      </div>
      <div class="idx-chg ${isPos ? 'pos' : 'neg'}">${isPos ? '▲' : '▼'} ${Math.abs(d.chg).toFixed(2)}%</div>
    `;
    const spark = row.querySelector('canvas');
    setTimeout(() => drawMiniSpark(spark, d.hist, isPos), 10);
    row.addEventListener('click', () => {
      S.focus = d.name;
      $('focusDisplay').textContent = d.name;
      $('chartTitle').textContent   = d.name;
      $('obTicker').textContent     = d.name.replace(' ', '').toUpperCase().slice(0, 10);
      renderIndices();
    });
    list.appendChild(row);
  });
}

function updateIndices() {
  idxState.forEach(d => {
    const prev = d.val;
    d.val = Math.max(100, d.val + (Math.random() - 0.49) * d.val * 0.0012);
    d.chg += (Math.random() - 0.5) * 0.06;
    d.hist.push(d.val);
    if (d.hist.length > 30) d.hist.shift();

    // Flash the row if it already exists
    const row = q(`[data-name="${d.name}"]`);
    if (row) {
      row.classList.remove('flash-g', 'flash-r');
      void row.offsetWidth;
      row.classList.add(d.val > prev ? 'flash-g' : 'flash-r');
    }
  });
  renderIndices();
}

function initIndices() { renderIndices(); setInterval(updateIndices, 2400); }

// ── Main Chart ───────────────────────────────────────────────
function genChartData(n = 90, base = 24610, vol = 90) {
  let v = base, out = [];
  for (let i = 0; i < n; i++) {
    v = Math.max(base - 600, v + (Math.random() - 0.475) * vol);
    out.push(v);
  }
  return out;
}

function initChart() {
  const canvas = $('mainChart');
  const ctx    = canvas.getContext('2d');
  S.chartData  = genChartData();
  let prevVal  = S.chartData[S.chartData.length - 1];

  function draw() {
    const W = canvas.offsetWidth, H = canvas.offsetHeight || 200;
    if (!W) return;
    canvas.width = W; canvas.height = H;
    const data = S.chartData;
    const mn = Math.min(...data), mx = Math.max(...data), rng = mx - mn || 1;
    const pad = { t: 12, r: 12, b: 18, l: 52 };
    const cW = W - pad.l - pad.r, cH = H - pad.t - pad.b;
    const step = cW / Math.max(data.length - 1, 1);

    ctx.clearRect(0, 0, W, H);

    // Grid
    for (let i = 0; i <= 5; i++) {
      const y = pad.t + (cH / 5) * i;
      ctx.beginPath(); ctx.setLineDash([2, 8]);
      ctx.strokeStyle = 'rgba(255,160,30,0.06)'; ctx.lineWidth = 1;
      ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#3d3528';
      ctx.font = '9px IBM Plex Mono'; ctx.textAlign = 'right';
      ctx.fillText((mx - (rng / 5) * i).toFixed(0), pad.l - 6, y + 3);
    }

    // Vertical guides
    for (let i = 0; i <= 7; i++) {
      const x = pad.l + (cW / 7) * i;
      ctx.beginPath(); ctx.setLineDash([1, 12]);
      ctx.strokeStyle = 'rgba(255,160,30,0.04)'; ctx.lineWidth = 1;
      ctx.moveTo(x, pad.t); ctx.lineTo(x, pad.t + cH); ctx.stroke();
      ctx.setLineDash([]);
    }

    // Gradient area
    const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + cH);
    grad.addColorStop(0,   'rgba(255,170,0,0.14)');
    grad.addColorStop(0.5, 'rgba(255,170,0,0.04)');
    grad.addColorStop(1,   'rgba(255,170,0,0)');
    ctx.beginPath();
    data.forEach((v, i) => {
      const x = pad.l + i * step, y = pad.t + cH - ((v - mn) / rng) * cH;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.lineTo(pad.l + (data.length - 1) * step, pad.t + cH);
    ctx.lineTo(pad.l, pad.t + cH); ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();

    // Line
    const lastVal = data[data.length - 1];
    const firstVal = data[0];
    const lineColor = lastVal >= firstVal ? '#00e5a0' : '#ff3355';
    ctx.beginPath();
    ctx.strokeStyle = lineColor; ctx.lineWidth = 1.6;
    ctx.lineJoin = 'round';
    ctx.shadowColor = lineColor; ctx.shadowBlur = 5;
    data.forEach((v, i) => {
      const x = pad.l + i * step, y = pad.t + cH - ((v - mn) / rng) * cH;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke(); ctx.shadowBlur = 0;

    // Live dot
    const lv = data[data.length - 1];
    const lx = pad.l + (data.length - 1) * step;
    const ly = pad.t + cH - ((lv - mn) / rng) * cH;
    ctx.beginPath(); ctx.arc(lx, ly, 4, 0, Math.PI * 2);
    ctx.fillStyle = lineColor; ctx.shadowColor = lineColor; ctx.shadowBlur = 12;
    ctx.fill(); ctx.shadowBlur = 0;

    // Dashed price level
    ctx.beginPath(); ctx.setLineDash([3, 6]);
    ctx.strokeStyle = 'rgba(255,170,0,0.2)'; ctx.lineWidth = 1;
    ctx.moveTo(pad.l, ly); ctx.lineTo(lx, ly); ctx.stroke(); ctx.setLineDash([]);

    // Price label on right
    ctx.fillStyle = 'rgba(255,170,0,0.7)';
    ctx.font = 'bold 9px IBM Plex Mono'; ctx.textAlign = 'left';
    ctx.fillText(lv.toFixed(0), lx + 6, ly + 3);
  }

  draw();
  window.addEventListener('resize', draw);

  setInterval(() => {
    const last = S.chartData[S.chartData.length - 1];
    S.chartData.push(Math.max(24000, last + (Math.random() - 0.475) * 65));
    if (S.chartData.length > 120) S.chartData.shift();

    const val   = S.chartData[S.chartData.length - 1];
    const first = S.chartData[0];
    const pct   = ((val - first) / first * 100);
    const isPos = pct >= 0;

    tween(prevVal, val, 500, v => { $('niftyPrice').textContent = fmt(v); });
    prevVal = val;

    const chgEl = $('niftyChg');
    chgEl.textContent = `${isPos ? '▲' : '▼'} ${isPos ? '+' : ''}${pct.toFixed(2)}%`;
    chgEl.className = `big-chg ${isPos ? 'pos' : 'neg'}`;

    $('ohlcC').textContent = fmt(val);
    $('ohlcH').textContent = fmt(Math.max(...S.chartData));
    $('ohlcL').textContent = fmt(Math.min(...S.chartData));

    // whisper based on move
    setWhisper(Math.abs(pct) > 2 ? 'high' : Math.abs(pct) > 0.8 ? 'mid' : Math.abs(pct) > 0.3 ? 'low' : 'none');
    draw();
  }, 2800);

  // Timeframe buttons
  qa('.tf-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      qa('.tf-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      S.tf = btn.dataset.tf;
      const bases = { '1D': 24610, '5D': 23800, '1M': 22000, '3M': 20000 };
      const vols  = { '1D': 90, '5D': 150, '1M': 250, '3M': 400 };
      const lens  = { '1D': 90, '5D': 78, '1M': 66, '3M': 90 };
      S.chartData = genChartData(lens[S.tf], bases[S.tf], vols[S.tf]);
      prevVal = S.chartData[S.chartData.length - 1];
      draw();
    });
  });
}

// ── Whisper / Edge glow ──────────────────────────────────────
function setWhisper(level) {
  const el = $('edgeGlow');
  el.className = 'edge-glow';
  if (level !== 'none') el.classList.add('w-' + level);
  $('alertLevel').textContent = level === 'none' ? S.alertLevel.toUpperCase() : level.toUpperCase();
}

// ── VIX dial ─────────────────────────────────────────────────
function initVIX() {
  S.vixHistory = Array.from({ length: 30 }, () => 12 + Math.random() * 4);
  let prev = S.vixVal;

  const arcEl   = $('vixArc');
  const numEl   = $('vixSvgNum');
  const badgeEl = $('vixBadge');
  const sparkEl = $('vixSpark');

  // Arc: total length ≈ 220 (π * r where r≈70, half circle)
  function updateDial(v) {
    const pct = (v - 8) / 30;
    const offset = 220 - pct * 220;
    arcEl.style.strokeDashoffset = Math.max(0, offset);

    if (v < 15)      { arcEl.style.stroke = '#ffaa00'; badgeEl.textContent = 'CALM';       badgeEl.className = 'vix-badge'; }
    else if (v < 22) { arcEl.style.stroke = '#ff8800'; badgeEl.textContent = 'ELEVATED';   badgeEl.className = 'vix-badge elevated'; }
    else             { arcEl.style.stroke = '#ff3355'; badgeEl.textContent = 'HIGH ALERT'; badgeEl.className = 'vix-badge high'; }
  }

  function drawSpark() {
    if (!sparkEl) return;
    const ctx = sparkEl.getContext('2d');
    const W = sparkEl.offsetWidth || 80, H = sparkEl.offsetHeight || 28;
    sparkEl.width = W; sparkEl.height = H;
    const data = S.vixHistory;
    const mn = Math.min(...data), mx = Math.max(...data), rng = mx - mn || 1;
    const step = W / (data.length - 1);
    ctx.clearRect(0, 0, W, H);
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255,170,0,0.5)'; ctx.lineWidth = 1.2; ctx.lineJoin = 'round';
    data.forEach((v, i) => {
      const x = i * step, y = H - ((v - mn) / rng) * H * 0.8 - H * 0.1;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  updateDial(S.vixVal);
  drawSpark();

  setInterval(() => {
    prev = S.vixVal;
    S.vixVal = Math.max(8, Math.min(38, S.vixVal + (Math.random() - 0.5) * 0.45));
    S.vixHistory.push(S.vixVal);
    if (S.vixHistory.length > 40) S.vixHistory.shift();
    tween(prev, S.vixVal, 1000, v => { numEl.textContent = v.toFixed(1); });
    updateDial(S.vixVal);
    drawSpark();
  }, 3200);
}

// ── Order Book ────────────────────────────────────────────────
function renderOB() {
  const base = idxState[0]?.val || 24853;
  const asks = $('obAsks'), bids = $('obBids');
  asks.innerHTML = ''; bids.innerHTML = '';

  for (let i = 5; i >= 1; i--) {
    const p = (base + i * 0.5 + Math.random() * 0.3).toFixed(2);
    const q = 50 + Math.floor(Math.random() * 220);
    const w = 15 + Math.random() * 72;
    const row = document.createElement('div');
    row.className = 'ob-row ask';
    const bar = document.createElement('div');
    bar.className = 'ob-bar'; bar.style.width = w + '%';
    row.appendChild(bar);
    row.innerHTML += `<span class="ob-price">${p}</span><span class="ob-qty">${q}</span><span class="ob-depth">${w.toFixed(0)}%</span>`;
    asks.appendChild(row);
  }
  for (let i = 1; i <= 5; i++) {
    const p = (base - i * 0.5 - Math.random() * 0.3).toFixed(2);
    const q = 50 + Math.floor(Math.random() * 220);
    const w = 15 + Math.random() * 72;
    const row = document.createElement('div');
    row.className = 'ob-row bid';
    const bar = document.createElement('div');
    bar.className = 'ob-bar'; bar.style.width = w + '%';
    row.appendChild(bar);
    row.innerHTML += `<span class="ob-price">${p}</span><span class="ob-qty">${q}</span><span class="ob-depth">${w.toFixed(0)}%</span>`;
    bids.appendChild(row);
  }
  $('obSpread').textContent = `── SPREAD ${(0.03 + Math.random() * 0.06).toFixed(2)} ──`;
}
function initOB() { renderOB(); setInterval(renderOB, 900); }

// ── Trade Tape ────────────────────────────────────────────────
function initTape() {
  const wrap = $('tapeWrap');

  const addTick = () => {
    const base   = idxState[0]?.val || 24853;
    const isBuy  = Math.random() > 0.5;
    const price  = (base + (Math.random() - 0.5) * 2).toFixed(2);
    const qty    = (10 + Math.floor(Math.random() * 500)) * 10;
    const ts     = now();

    const row = document.createElement('div');
    row.className = `tape-row ${isBuy ? 'tape-buy' : 'tape-sell'}`;
    row.innerHTML = `
      <span class="tape-price">${price}</span>
      <span class="tape-qty">${qty.toLocaleString()}</span>
      <span class="tape-time">${ts}</span>
    `;
    wrap.insertBefore(row, wrap.firstChild);
    while (wrap.children.length > 22) wrap.removeChild(wrap.lastChild);
  };

  // Burst of initial ticks
  for (let i = 0; i < 12; i++) setTimeout(addTick, i * 60);
  const schedule = () => setTimeout(() => { addTick(); schedule(); }, 300 + Math.random() * 700);
  schedule();
}

// ── Signals ───────────────────────────────────────────────────
const SIGNAL_POOL = [
  { text: 'RELIANCE breakout above ₹2,940 resistance — volume surge 3.2× avg', badge: 'buy', type: 'buy' },
  { text: 'BANKNIFTY put-call ratio spikes to 1.62 — bearish sentiment building', badge: 'alert', type: 'warn' },
  { text: 'HDFCBANK FII net buying ₹842 Cr intraday — institutional accumulation', badge: 'buy', type: 'buy' },
  { text: 'NIFTYIT sector weakness — TCS drops below 200 DMA on rising volumes', badge: 'sell', type: 'sell' },
  { text: 'INFY options IV crush expected post-earnings on Thursday', badge: 'alert', type: 'warn' },
  { text: 'ONGC momentum: RSI(14) = 68 — approaching overbought zone', badge: 'alert', type: 'warn' },
  { text: 'MARUTI support at ₹11,200 holding — intraday bounce confirmed', badge: 'buy', type: 'buy' },
  { text: 'BAJFINANCE unusual call sweeps — bullish institutional flow 3× avg', badge: 'buy', type: 'buy' },
  { text: 'SENSEX breadth deteriorating — advancers at 38%, decliners at 62%', badge: 'sell', type: 'sell' },
  { text: 'NIFTY options expiry: max pain at 24,800 — pin risk elevated', badge: 'alert', type: 'warn' },
  { text: 'WIPRO gap-down opening — heavy institutional selling detected', badge: 'sell', type: 'sell' },
  { text: 'BHEL breakout: 52-week high breached on 4× volume', badge: 'buy', type: 'buy' },
];

function pushSignal(override) {
  const sig  = override || SIGNAL_POOL[Math.floor(Math.random() * SIGNAL_POOL.length)];
  const list = $('signalList');
  const item = document.createElement('div');
  item.className = `sig-item ${sig.type} ${sig.isUser ? 'user' : ''}`;
  item.innerHTML = `
    <span class="sig-time">${now()}</span>
    <span class="sig-text">${sig.text}</span>
    <span class="sig-badge ${sig.badge}">${sig.badge.toUpperCase()}</span>
  `;
  list.insertBefore(item, list.firstChild);
  if (list.children.length > 24) list.removeChild(list.lastChild);
}

function initSignals() {
  pushSignal();
  const sched = () => setTimeout(() => { pushSignal(); sched(); }, 2800 + Math.random() * 3500);
  sched();
}

// ── Heatmap ───────────────────────────────────────────────────
const SECTORS = [
  { name: 'BANKING', pct: 1.84 }, { name: 'IT',      pct: -0.82 },
  { name: 'AUTO',    pct: 1.72 }, { name: 'PHARMA',  pct:  0.44 },
  { name: 'ENERGY',  pct: 0.68 }, { name: 'FMCG',    pct: -0.28 },
  { name: 'METALS',  pct: 2.14 }, { name: 'REALTY',  pct: -1.44 },
  { name: 'TELECOM', pct: 0.32 },
];
let sectorState = SECTORS.map(d => ({ ...d }));

function hmCls(p) {
  if (p >  1.5) return 'hm-sp'; if (p >  0.5) return 'hm-p';  if (p >  0.1) return 'hm-lp';
  if (p > -0.1) return 'hm-n';  if (p > -0.5) return 'hm-ln'; if (p > -1.5) return 'hm-ng';
  return 'hm-sn';
}

function renderHeatmap() {
  const g = $('heatmap');
  g.innerHTML = '';
  sectorState.forEach(s => {
    const c = document.createElement('div');
    c.className = `hm-cell ${hmCls(s.pct)}`;
    c.innerHTML = `<div class="hm-name">${s.name}</div><div class="hm-pct">${s.pct >= 0 ? '+' : ''}${s.pct.toFixed(2)}%</div>`;
    g.appendChild(c);
  });
}

function initHeatmap() {
  renderHeatmap();
  setInterval(() => {
    sectorState.forEach(s => { s.pct = Math.max(-4, Math.min(4, s.pct + (Math.random() - 0.5) * 0.15)); });
    renderHeatmap();
  }, 4000);
}

// ── AI Signals ────────────────────────────────────────────────
const AI_TICKERS = [
  { sym: 'RELIANCE', bull: 72 }, { sym: 'HDFCBANK', bull: 45 },
  { sym: 'TCS',      bull: 38 }, { sym: 'INFY',     bull: 52 },
  { sym: 'ITC',      bull: 66 }, { sym: 'BAJFIN',   bull: 58 },
];

function renderAI() {
  const list = $('aiList');
  list.innerHTML = '';
  AI_TICKERS.forEach(t => {
    const isBull = t.bull >= 50;
    const row = document.createElement('div');
    row.className = 'ai-row';
    row.innerHTML = `
      <div class="ai-sym">${t.sym}</div>
      <div class="ai-bar"><div class="ai-fill ${isBull ? 'bull' : 'bear'}" style="width:${t.bull}%"></div></div>
      <div class="ai-tag ${isBull ? 'bull' : 'bear'}">${isBull ? 'BULL' : 'BEAR'}</div>
    `;
    list.appendChild(row);
  });
}

function initAI() {
  renderAI();
  setInterval(() => {
    AI_TICKERS.forEach(t => { t.bull = Math.max(8, Math.min(92, t.bull + (Math.random() - 0.5) * 4)); });
    renderAI();
  }, 3600);
}

// ── Regulatory ────────────────────────────────────────────────
const REG_ITEMS = [
  { tag: 'CIRCULAR', date: '14 Mar', text: 'SEBI mandates T+0 settlement for top 100 stocks effective April 2025.' },
  { tag: 'NOTICE',   date: '12 Mar', text: 'F&O position limit review — SEBI proposes reducing open interest cap for single-stock contracts.' },
  { tag: 'ADVISORY', date: '10 Mar', text: 'Algo trading registration for proprietary desks: extended deadline to 30 June.' },
  { tag: 'CIRCULAR', date: '08 Mar', text: 'New KYC norms for FPI category II entities effective immediately.' },
  { tag: 'ORDER',    date: '05 Mar', text: 'Insider trading probe: SEBI bars promoter of mid-cap pharma from markets.' },
  { tag: 'ADVISORY', date: '02 Mar', text: 'Retail investor margin requirements revised — intraday leverage capped at 5×.' },
];

function initReg() {
  const list = $('regList');
  REG_ITEMS.forEach(r => {
    const item = document.createElement('div');
    item.className = 'reg-item';
    item.innerHTML = `
      <div class="reg-meta"><span class="reg-tag">${r.tag}</span><span class="reg-date">${r.date}</span></div>
      <div class="reg-text">${r.text}</div>
    `;
    list.appendChild(item);
  });
}

// ── Events Countdown ─────────────────────────────────────────
const EVENTS = [
  { name: 'RBI Policy Decision',    date: new Date(Date.now() + 2 * 86400000 + 3600000 * 10) },
  { name: 'NIFTY F&O Expiry',       date: new Date(Date.now() + 4 * 86400000) },
  { name: 'US CPI Data Release',    date: new Date(Date.now() + 86400000 + 3600000 * 14) },
  { name: 'TCS Earnings',           date: new Date(Date.now() + 6 * 86400000) },
  { name: 'FOMC Minutes',           date: new Date(Date.now() + 8 * 86400000 + 3600000 * 19) },
];

function fmtCountdown(ms) {
  if (ms <= 0) return '00:00:00';
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h`;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

function renderEvents() {
  const list = $('eventList');
  list.innerHTML = '';
  const now = Date.now();
  const maxMs = Math.max(...EVENTS.map(e => e.date - now));

  EVENTS.forEach(ev => {
    const ms = ev.date - now;
    const pct = Math.max(0, Math.min(100, (1 - ms / (10 * 86400000)) * 100));
    const item = document.createElement('div');
    item.className = 'event-item';
    item.innerHTML = `
      <div class="event-top">
        <div class="event-name">${ev.name}</div>
        <div class="event-countdown">${fmtCountdown(ms)}</div>
      </div>
      <div class="event-detail">${ev.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
      <div class="event-bar-track"><div class="event-bar-fill" style="width:${pct}%"></div></div>
    `;
    list.appendChild(item);
  });
}

function initEvents() {
  renderEvents();
  setInterval(renderEvents, 30000);
}

// ── P&L Strip ─────────────────────────────────────────────────
const PNL_POSITIONS = [
  { sym: 'RELIANCE',  qty: 10,  entry: 2910.00 },
  { sym: 'HDFCBANK',  qty: 20,  entry: 1760.00 },
  { sym: 'TCS',       qty: -5,  entry: 3840.00 },   // short
  { sym: 'INFY',      qty: 15,  entry: 1600.00 },
];

function renderPNL() {
  const body = $('pnlBody');
  body.innerHTML = '';
  let totalPnl = 0;

  PNL_POSITIONS.forEach(pos => {
    // Find LTP from idxState (approximate with noise)
    const ltp = (idxState[0]?.val || 24853) * (0.1 + Math.random() * 0.05) * (pos.entry / 2500);
    const pnl = (ltp - pos.entry) * pos.qty;
    totalPnl += pnl;
    const isPos = pnl >= 0;

    const row = document.createElement('div');
    row.className = 'pnl-row';
    row.innerHTML = `
      <span class="pnl-sym">${pos.qty < 0 ? '▼ ' : '▲ '}${pos.sym} (${Math.abs(pos.qty)})</span>
      <span class="pnl-val ${isPos ? 'pos' : 'neg'}">${isPos ? '+' : ''}₹${pnl.toFixed(0)}</span>
    `;
    body.appendChild(row);
  });

  const totDiv = document.createElement('div');
  totDiv.className = 'pnl-total';
  const isPos = totalPnl >= 0;
  totDiv.innerHTML = `
    <span class="pnl-total-label">SESSION P&L</span>
    <span class="pnl-total-val ${isPos ? 'pos' : 'neg'}">${isPos ? '+' : ''}₹${Math.abs(totalPnl).toFixed(0)}</span>
  `;
  body.appendChild(totDiv);
}

function initPNL() {
  renderPNL();
  setInterval(renderPNL, 3000);
}

// ── Risk Gauge ────────────────────────────────────────────────
function updateRisk() {
  S.riskVal = Math.max(10, Math.min(95, S.riskVal + (Math.random() - 0.5) * 3));
  $('riskFill').style.width = S.riskVal + '%';
  $('riskVal').textContent  = Math.round(S.riskVal);
  $('riskVal').className    = S.riskVal > 70 ? 'risk-val neg' : S.riskVal > 45 ? 'risk-val amb' : 'risk-val';
}

// ── Anomaly ───────────────────────────────────────────────────
const ANOMALIES = [
  { msg: 'Unusual volume spike in BANKNIFTY — 3.4σ deviation from 30-day mean.', sigma: '3.4σ' },
  { msg: 'Circuit breaker proximity: NIFTYIT down 4.2% in 3 minutes — halt possible.', sigma: '4.1σ' },
  { msg: 'Dark pool activity detected in RELIANCE — 18M shares at ₹2,935.', sigma: '2.9σ' },
  { msg: 'Correlated sell-off: FII unwinding detected across 6 major positions.', sigma: '3.8σ' },
  { msg: 'HFT anomaly: 24,000+ orders placed in 800ms on HDFC options chain.', sigma: '5.1σ' },
  { msg: 'Liquidity gap event: bid stack collapsed in MIDCAP 150 — recovery in 1.2s.', sigma: '3.1σ' },
];

function triggerAnomaly() {
  const a   = ANOMALIES[Math.floor(Math.random() * ANOMALIES.length)];
  const msgEl = $('anomMsg');
  $('anomSigma').textContent = a.sigma + ' DEVIATION';
  $('anomTape').textContent  = `ALERT · ${S.focus} · ${now()} · UNCONFIRMED`;
  msgEl.textContent = '';
  msgEl.className   = 'anom-msg typing';
  $('anomalyOverlay').classList.remove('hidden');
  setWhisper('high');

  let ci = 0;
  const type = () => {
    if (ci <= a.msg.length) { msgEl.textContent = a.msg.slice(0, ci); ci++; setTimeout(type, 16 + Math.random() * 10); }
    else msgEl.className = 'anom-msg';
  };
  type();
}

function initAnomaly() {
  $('anomalyBtn').addEventListener('click', triggerAnomaly);
  $('anomClose').addEventListener('click', () => { $('anomalyOverlay').classList.add('hidden'); setWhisper('none'); });
}

// ── Help ──────────────────────────────────────────────────────
function initHelp() {
  $('helpBtn').addEventListener('click', () => $('helpOverlay').classList.remove('hidden'));
  $('helpClose').addEventListener('click', () => $('helpOverlay').classList.add('hidden'));
}

// ── CLI ───────────────────────────────────────────────────────
function cliOut(msg, type = 'info') {
  const wrap = $('cliOutput');
  if (wrap.classList.contains('hidden')) { wrap.classList.remove('hidden'); }
  const line = document.createElement('div');
  line.className = `cli-line ${type}`;
  line.textContent = msg;
  wrap.appendChild(line);
  wrap.scrollTop = wrap.scrollHeight;
  clearTimeout(S._cliTimer);
  S._cliTimer = setTimeout(() => { wrap.classList.add('hidden'); }, 9000);
}

const CMDS = {
  '/focus': args => {
    const sym = args.join(' ').toUpperCase();
    if (!sym) return cliOut('Usage: /focus [SYMBOL]', 'err');
    S.focus = sym;
    $('focusDisplay').textContent = sym;
    $('chartTitle').textContent   = sym;
    $('obTicker').textContent     = sym.slice(0, 10);
    renderIndices();
    cliOut(`Focus shifted → ${sym}`, 'ok');
    pushSignal({ text: `[SYSTEM] Terminal focus changed to ${sym}`, badge: 'alert', type: 'warn' });
  },
  '/buy': args => {
    const qty = parseInt(args[0]) || 1;
    const price = (idxState[0]?.val || 24853).toFixed(2);
    cliOut(`▲ BUY  ${qty} × ${S.focus} @ ₹${price} — stamped on tape`, 'buy');
    pushSignal({ text: `[USER TAPE] BUY ${qty} × ${S.focus} @ ₹${price}`, badge: 'buy', type: 'buy', isUser: true });
    S.riskVal = Math.min(95, S.riskVal + qty * 0.5);
    updateRisk();
  },
  '/sell': args => {
    const qty = parseInt(args[0]) || 1;
    const price = (idxState[0]?.val || 24853).toFixed(2);
    cliOut(`▼ SELL ${qty} × ${S.focus} @ ₹${price} — stamped on tape`, 'sell');
    pushSignal({ text: `[USER TAPE] SELL ${qty} × ${S.focus} @ ₹${price}`, badge: 'sell', type: 'sell', isUser: true });
    S.riskVal = Math.max(10, S.riskVal - qty * 0.3);
    updateRisk();
  },
  '/alert': args => {
    const lvl = (args[0] || '').toLowerCase();
    if (!['low', 'mid', 'high'].includes(lvl)) return cliOut('Usage: /alert [low|mid|high]', 'err');
    S.alertLevel = lvl;
    $('alertLevel').textContent = lvl.toUpperCase();
    setWhisper(lvl);
    cliOut(`Alert sensitivity → ${lvl.toUpperCase()}`, 'ok');
  },
  '/anomaly': () => { triggerAnomaly(); cliOut('Anomaly triggered', 'ok'); },
  '/clear':   () => { $('cliOutput').innerHTML = ''; },
  '/risk':    args => {
    const v = parseInt(args[0]);
    if (isNaN(v) || v < 0 || v > 100) return cliOut('Usage: /risk [0-100]', 'err');
    S.riskVal = v; updateRisk();
    cliOut(`Risk gauge set to ${v}`, 'ok');
  },
  '/help': () => {
    [
      '/focus [SYM]        — shift terminal focus',
      '/buy [qty]          — stamp buy on tape',
      '/sell [qty]         — stamp sell on tape',
      '/alert [low|mid|high] — set whisper sensitivity',
      '/risk [0-100]       — manually set risk gauge',
      '/anomaly            — trigger anomaly spike',
      '/clear              — clear this output',
    ].forEach(l => cliOut(l, 'info'));
  },
};

function initCLI() {
  const input = $('cliInput');
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const raw = input.value.trim();
      if (!raw) return;
      S.cliHistory.unshift(raw);
      S.cliIdx = -1;
      input.value = '';
      cliOut('› ' + raw, 'cmd');
      const parts = raw.split(' ');
      const fn = CMDS[parts[0].toLowerCase()];
      fn ? fn(parts.slice(1)) : cliOut(`Unknown command: ${parts[0]}. Try /help`, 'err');
    }
    if (e.key === 'ArrowUp')   { S.cliIdx = Math.min(S.cliIdx + 1, S.cliHistory.length - 1); input.value = S.cliHistory[S.cliIdx] || ''; }
    if (e.key === 'ArrowDown') { S.cliIdx = Math.max(S.cliIdx - 1, -1); input.value = S.cliIdx >= 0 ? S.cliHistory[S.cliIdx] : ''; }
    if (e.key === 'Escape')    { input.value = ''; input.blur(); }
  });
}

// ── Sound ─────────────────────────────────────────────────────
function initSound() {
  let on = false;
  $('soundBtn').addEventListener('click', () => { on = !on; $('soundBtn').textContent = on ? '♫' : '♪'; });
}

// ── Keyboard shortcuts ────────────────────────────────────────
function initKeys() {
  document.addEventListener('keydown', e => {
    const inCLI = document.activeElement === $('cliInput');
    if (e.key === 'Escape') {
      $('anomalyOverlay').classList.add('hidden');
      $('helpOverlay').classList.add('hidden');
      $('cliOutput').classList.add('hidden');
      $('cliInput').blur();
      setWhisper('none');
    }
    if (inCLI) return;
    if (e.key === '?') $('helpOverlay').classList.remove('hidden');
    if (e.key === '/') { e.preventDefault(); $('cliInput').focus(); }
    if (e.key.toLowerCase() === 'a') triggerAnomaly();
  });
}

// ── Init ──────────────────────────────────────────────────────
function initApp() {
  startClock();
  initTicker();
  initMacro();
  initIndices();
  initChart();
  initOB();
  initTape();
  initSignals();
  initHeatmap();
  initAI();
  initReg();
  initEvents();
  initPNL();
  setInterval(updateRisk, 4000);
  initCLI();
  initAnomaly();
  initHelp();
  initSound();
  initKeys();

  // Welcome
  setTimeout(() => {
    cliOut('NEXUS WAR ROOM · ALL INSTRUMENTS LIVE', 'ok');
    cliOut('Press / to open CLI · ? for shortcuts', 'info');
  }, 600);
}

runBoot();
