'use strict';
// ═══════════════════════════════════════════
//  MARKET PULSE TERMINAL v2 — app.js
// ═══════════════════════════════════════════

// ── BASE DATA ─────────────────────────────
const BASE = {
  AAPL:{price:192.50,name:'Apple'},TSLA:{price:248.70,name:'Tesla'},
  NVDA:{price:875.40,name:'Nvidia'},AMZN:{price:185.20,name:'Amazon'},
  META:{price:510.30,name:'Meta'},MSFT:{price:415.80,name:'Microsoft'}
};

const SECTORS = [
  {name:'Technology',base:100},  {name:'Healthcare',base:100},
  {name:'Financials',base:100},  {name:'Energy',base:100},
  {name:'Consumer',base:100},    {name:'Industrials',base:100},
];

const ECON_EVENTS = [
  {time:'08:30',event:'Non-Farm Payrolls',impact:'high',forecast:'185K',actual:null},
  {time:'10:00',event:'ISM Manufacturing',impact:'med',forecast:'48.5',actual:null},
  {time:'14:00',event:'FOMC Minutes',impact:'high',forecast:'—',actual:null},
  {time:'14:30',event:'Crude Oil Inventories',impact:'med',forecast:'-2.1M',actual:null},
  {time:'16:00',event:'Consumer Confidence',impact:'med',forecast:'102.0',actual:null},
  {time:'08:15',event:'ADP Employment',impact:'med',forecast:'150K',actual:'162K'},
  {time:'08:30',event:'Initial Jobless Claims',impact:'med',forecast:'220K',actual:'215K'},
  {time:'09:45',event:'PMI Composite',impact:'low',forecast:'51.2',actual:'51.8'},
];

// ── STATE ──────────────────────────────────
const S = {
  prices:{},prevPrices:{},opens:{},volumes:{},histories:{},changes:{},
  watchlist:Object.keys(BASE),
  trades:[],
  chartSym:'AAPL',chartInterval:3,chartType:'area',
  obSym:'AAPL',analyticsSym:'AAPL',depthSym:'AAPL',
  tradeFilter:'ALL',newsFilter:'ALL',
  sortBy:'sym',sortDir:1,
  flashEnabled:true,largeOnly:false,
  portfolio:{},
  priceAlerts:[],
  sectorPerfomance:{},
  sessionPnl:0,
  soundEnabled:false,
  ticks:0,frameCount:0,
  cmdHistory:[],cmdHistIdx:-1,
};

for(const sym of S.watchlist){
  const b=BASE[sym];
  S.prices[sym]=b.price; S.prevPrices[sym]=b.price; S.opens[sym]=b.price;
  S.volumes[sym]=Math.floor(Math.random()*8e6)+1e6;
  S.histories[sym]=[b.price]; S.changes[sym]=0;
}
for(const sec of SECTORS) S.sectorPerfomance[sec.name]=0;

// ── UTILS ──────────────────────────────────
const fmt=(n,d=2)=>Number(n).toFixed(d);
const fmtK=n=>n>=1e6?(n/1e6).toFixed(2)+'M':n>=1e3?(n/1e3).toFixed(1)+'K':n;
const fmtDollar=n=>'$'+(n>=1e9?(n/1e9).toFixed(2)+'B':n>=1e6?(n/1e6).toFixed(2)+'M':n>=1e3?(n/1e3).toFixed(1)+'K':fmt(n));
const clamp=(v,mn,mx)=>Math.min(mx,Math.max(mn,v));
function randNorm(mu=0,sig=1){let u=0,v=0;while(!u)u=Math.random();while(!v)v=Math.random();return mu+sig*Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);}
const ts=()=>new Date().toLocaleTimeString('en-US',{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'});
const $ =id=>document.getElementById(id);
const el=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt)e.textContent=txt;return e;};

// ── CLOCK ──────────────────────────────────
setInterval(()=>{const c=$('clock');if(c)c.textContent=ts();},1000);
$('clock').textContent=ts();

// ── THEME TOGGLE ───────────────────────────
$('themeBtn').addEventListener('click',()=>document.body.classList.toggle('light'));
$('soundBtn').addEventListener('click',()=>{
  S.soundEnabled=!S.soundEnabled;
  $('soundBtn').style.opacity=S.soundEnabled?'1':'0.4';
});

// ── PRICE ENGINE ───────────────────────────
function tickPrices(){
  for(const sym of S.watchlist){
    S.prevPrices[sym]=S.prices[sym];
    // Varied volatility per stock
    const vol={TSLA:0.0025,NVDA:0.002,AAPL:0.001,MSFT:0.001,AMZN:0.0015,META:0.002}[sym]||0.0015;
    let p=S.prices[sym]+S.prices[sym]*randNorm(0,vol);
    p=Math.max(p,S.opens[sym]*0.6);
    S.prices[sym]=Math.round(p*100)/100;
    S.changes[sym]=((S.prices[sym]-S.opens[sym])/S.opens[sym])*100;
    S.volumes[sym]+=Math.floor(Math.random()*30000);
    S.histories[sym].push(S.prices[sym]);
    if(S.histories[sym].length>300)S.histories[sym].shift();
  }
  // Sectors drift
  for(const sec of SECTORS){
    S.sectorPerfomance[sec.name]+=randNorm(0,0.15);
    S.sectorPerfomance[sec.name]=clamp(S.sectorPerfomance[sec.name],-8,8);
  }
  S.ticks++;
  checkPriceAlerts();
}

// ── TICKER STRIP ───────────────────────────
function updateTicker(){
  const strip=$('tickerStrip');
  if(!strip)return;
  // Duplicate for seamless scroll
  const items=S.watchlist.map(sym=>{
    const c=S.changes[sym],dir=c>=0?'up':'dn',arr=c>=0?'▲':'▼';
    return `<span class="ticker-item"><span class="ticker-sym">${sym}</span><span class="ticker-price">${fmt(S.prices[sym])}</span><span class="ticker-chg ${dir}">${arr}${fmt(Math.abs(c),2)}%</span></span>`;
  }).join('');
  strip.innerHTML=items+items; // duplicate for CSS scroll loop
}

// ── CHART ──────────────────────────────────
function drawChart(){
  const canvas=$('priceCanvas');if(!canvas)return;
  const ctx=canvas.getContext('2d');
  const W=canvas.offsetWidth||600,H=220;
  canvas.width=W;canvas.height=H;
  const sym=S.chartSym,hist=S.histories[sym]||[];
  if(hist.length<2)return;

  const pad={t:12,r:56,b:20,l:58};
  const cw=W-pad.l-pad.r,ch=H-pad.t-pad.b;
  const mn=Math.min(...hist)*0.9998,mx=Math.max(...hist)*1.0002;
  const range=mx-mn||1;
  const xOf=i=>pad.l+(i/(hist.length-1))*cw;
  const yOf=v=>pad.t+(1-(v-mn)/range)*ch;
  const up=S.changes[sym]>=0;
  const lineColor=up?'#00d68f':'#ff4d6a';

  ctx.clearRect(0,0,W,H);

  // Grid
  ctx.strokeStyle='rgba(26,42,58,0.9)';ctx.lineWidth=0.5;
  for(let i=0;i<=4;i++){
    const y=pad.t+(i/4)*ch;
    ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(W-pad.r,y);ctx.stroke();
    const v=mx-(i/4)*range;
    ctx.fillStyle='#3d5670';ctx.font='9px IBM Plex Mono';ctx.textAlign='right';
    ctx.fillText(fmt(v),pad.l-4,y+3);
  }

  if(S.chartType==='candle'&&hist.length>5){
    // Simple candle (simulated open/close from adjacent bars)
    const barW=Math.max(1,cw/hist.length*0.7);
    for(let i=1;i<hist.length;i++){
      const o=hist[i-1],c=hist[i];
      const hi=Math.max(o,c)*1.0003,lo=Math.min(o,c)*0.9997;
      const col=c>=o?'#00d68f':'#ff4d6a';
      ctx.strokeStyle=col;ctx.lineWidth=0.8;
      ctx.beginPath();ctx.moveTo(xOf(i),yOf(hi));ctx.lineTo(xOf(i),yOf(lo));ctx.stroke();
      ctx.fillStyle=col;
      const bx=xOf(i)-barW/2,by=yOf(Math.max(o,c)),bh=Math.max(1,Math.abs(yOf(o)-yOf(c)));
      ctx.fillRect(bx,by,barW,bh);
    }
  } else {
    // Area / line
    if(S.chartType==='area'){
      const grd=ctx.createLinearGradient(0,pad.t,0,H-pad.b);
      grd.addColorStop(0,up?'rgba(0,214,143,0.3)':'rgba(255,77,106,0.3)');
      grd.addColorStop(1,up?'rgba(0,214,143,0)':'rgba(255,77,106,0)');
      ctx.beginPath();ctx.moveTo(xOf(0),yOf(hist[0]));
      for(let i=1;i<hist.length;i++)ctx.lineTo(xOf(i),yOf(hist[i]));
      ctx.lineTo(xOf(hist.length-1),H-pad.b);ctx.lineTo(xOf(0),H-pad.b);ctx.closePath();
      ctx.fillStyle=grd;ctx.fill();
    }
    ctx.beginPath();ctx.moveTo(xOf(0),yOf(hist[0]));
    for(let i=1;i<hist.length;i++)ctx.lineTo(xOf(i),yOf(hist[i]));
    ctx.strokeStyle=lineColor;ctx.lineWidth=1.5;ctx.lineJoin='round';ctx.stroke();
  }

  // VWAP line
  const vwap=hist.reduce((a,b)=>a+b,0)/hist.length;
  ctx.beginPath();ctx.moveTo(pad.l,yOf(vwap));ctx.lineTo(W-pad.r,yOf(vwap));
  ctx.strokeStyle='rgba(255,201,71,0.4)';ctx.lineWidth=0.8;ctx.setLineDash([4,4]);ctx.stroke();
  ctx.setLineDash([]);

  // Last price dashed + label
  const lastY=yOf(hist[hist.length-1]);
  ctx.setLineDash([3,3]);ctx.strokeStyle='rgba(255,255,255,0.08)';ctx.lineWidth=0.8;
  ctx.beginPath();ctx.moveTo(pad.l,lastY);ctx.lineTo(W-pad.r,lastY);ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle=lineColor;ctx.font='bold 10px IBM Plex Mono';ctx.textAlign='left';
  ctx.fillText(fmt(hist[hist.length-1]),W-pad.r+3,lastY+3);

  // Meta
  const p=S.prices[sym],c=S.changes[sym];
  const priceEl=$('chartPrice');if(priceEl)priceEl.textContent=fmt(p);
  const chgEl=$('chartChg');if(chgEl){chgEl.textContent=(c>=0?'+':'')+fmt(c,2)+'%';chgEl.className='price-chg '+(c>=0?'up':'dn');}
  const statsEl=$('chartStats');
  if(statsEl)statsEl.textContent=`H:${fmt(Math.max(...hist))}  L:${fmt(Math.min(...hist))}  Vol:${fmtK(S.volumes[sym])}  VWAP:${fmt(vwap)}`;

  // Axis timestamps
  const axis=$('chartAxis');
  if(axis){const steps=5;axis.innerHTML=Array.from({length:steps},(_,i)=>`<span>${ts()}</span>`).join('');}
}

// ── WATCHLIST ──────────────────────────────
let sortBy='sym',sortDir=1;
document.querySelectorAll('.sort-btn').forEach(b=>{
  b.addEventListener('click',()=>{
    const col=b.dataset.sort;
    if(sortBy===col)sortDir*=-1;else{sortBy=col;sortDir=1;}
    document.querySelectorAll('.sort-btn').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    renderWatchlist();
  });
});

function renderWatchlist(){
  const tbody=$('watchlistBody');if(!tbody)return;
  let syms=[...S.watchlist];
  syms.sort((a,b)=>{
    let va,vb;
    if(sortBy==='sym'){va=a;vb=b;}
    else if(sortBy==='price'){va=S.prices[a];vb=S.prices[b];}
    else if(sortBy==='chg'){va=S.changes[a];vb=S.changes[b];}
    else if(sortBy==='vol'){va=S.volumes[a];vb=S.volumes[b];}
    return (va>vb?1:-1)*sortDir;
  });
  tbody.innerHTML=syms.map(sym=>{
    const p=S.prices[sym],c=S.changes[sym],dir=c>=0?'up':'dn',arr=c>=0?'▲':'▼';
    const rsi=calcRSI(S.histories[sym]);
    let sig,sc;
    if(rsi<35){sig='BUY';sc='sig-buy';}else if(rsi>65){sig='SELL';sc='sig-sell';}else{sig='HOLD';sc='sig-hold';}
    const flash=S.flashEnabled&&S.prices[sym]!==S.prevPrices[sym]?(S.prices[sym]>S.prevPrices[sym]?' flash-g':' flash-r'):'';
    return `<tr class="${flash}"><td style="color:var(--accent2);font-weight:600;cursor:pointer" onclick="setChart('${sym}')">${sym}</td><td style="color:var(--text)">${fmt(p)}</td><td class="${dir}">${arr}${fmt(Math.abs(c),2)}%</td><td>${fmtK(S.volumes[sym])}</td><td><span class="sig ${sc}">${sig}</span></td></tr>`;
  }).join('');
}

window.setChart=sym=>{S.chartSym=sym;$('chartSymbol').value=sym;drawChart();};

// ── HEATMAP ────────────────────────────────
function renderHeatmap(){
  const grid=$('heatmapGrid');if(!grid)return;
  grid.innerHTML=SECTORS.map(sec=>{
    const v=S.sectorPerfomance[sec.name];
    const abs=Math.abs(v)/8;
    let bg,tc;
    if(v>0){bg=`rgba(0,214,143,${0.08+abs*0.35})`;tc='var(--green)';}
    else if(v<0){bg=`rgba(255,77,106,${0.08+abs*0.35})`;tc='var(--red)';}
    else{bg='var(--bg3)';tc='var(--text2)';}
    return `<div class="hm-cell" style="background:${bg}"><span class="hm-sym">${sec.name}</span><span class="hm-chg" style="color:${tc}">${v>=0?'+':''}${fmt(v,2)}%</span></div>`;
  }).join('');
}

// ── TRADE FEED ─────────────────────────────
const MAX_TRADES=60;
function genTrade(sym){
  const p=S.prices[sym],sp=p*0.0003,buy=Math.random()>0.48;
  const price=Math.round((p+(buy?sp:-sp))*100)/100;
  const vol=Math.floor(Math.random()*(Math.random()<0.05?50000:3000))+10;
  return{time:ts(),sym,price,vol,side:buy?'BUY':'SELL',size:price*vol};
}
function addTrades(){
  const n=Math.floor(Math.random()*4)+1;
  for(let i=0;i<n;i++){
    const sym=S.watchlist[Math.floor(Math.random()*S.watchlist.length)];
    S.trades.unshift(genTrade(sym));
  }
  if(S.trades.length>MAX_TRADES)S.trades.length=MAX_TRADES;
}
function renderTrades(){
  const tbody=$('tradeBody');if(!tbody)return;
  let list=S.tradeFilter==='ALL'?S.trades:S.trades.filter(t=>t.sym===S.tradeFilter);
  if(S.largeOnly)list=list.filter(t=>t.vol>5000);
  let buys=0,sells=0;
  S.trades.slice(0,40).forEach(t=>t.side==='BUY'?buys++:sells++);
  const ratio=sells===0?'∞':fmt(buys/sells,2);
  const summ=$('tradeSummary');
  if(summ)summ.innerHTML=`Buy: <span style="color:var(--green)">${buys}</span> &nbsp;|&nbsp; Sell: <span style="color:var(--red)">${sells}</span> &nbsp;|&nbsp; Ratio: <span style="color:var(--accent)">${ratio}</span>`;
  tbody.innerHTML=list.slice(0,25).map((t,i)=>{
    const flash=i===0&&S.flashEnabled?(t.side==='BUY'?' flash-g':' flash-r'):'';
    const large=t.vol>5000?`style="font-weight:600"`:'';
    return `<tr class="${flash}"><td>${t.time}</td><td style="color:var(--accent2)">${t.sym}</td><td class="${t.side==='BUY'?'up':'dn'}" ${large}>${fmt(t.price)}</td><td>${fmtK(t.vol)}</td><td class="side-${t.side==='BUY'?'b':'s'}">${t.side}</td><td style="color:var(--text3)">${fmtDollar(t.size)}</td></tr>`;
  }).join('');
}

// ── ORDER BOOK ─────────────────────────────
function renderOrderBook(){
  const sym=S.obSym,mid=S.prices[sym],sp=mid*0.0007;
  const asks=[],bids=[];
  let ap=mid+sp/2,bp=mid-sp/2;
  for(let i=0;i<10;i++){
    asks.push({price:Math.round(ap*100)/100,size:Math.floor(Math.random()*12000)+100});
    bids.push({price:Math.round(bp*100)/100,size:Math.floor(Math.random()*12000)+100});
    ap+=mid*0.00025*(1+Math.random()*0.4);
    bp-=mid*0.00025*(1+Math.random()*0.4);
  }
  const maxA=Math.max(...asks.map(a=>a.size)),maxB=Math.max(...bids.map(b=>b.size));
  const totalBid=bids.reduce((a,b)=>a+b.size,0),totalAsk=asks.reduce((a,b)=>a+b.size,0);
  const imbal=totalBid/(totalBid+totalAsk)*100;

  $('askSide').innerHTML=[...asks].reverse().map(a=>`<div class="ob-row"><div class="depth-bar" style="width:${(a.size/maxA*100).toFixed(0)}%"></div><span class="ob-price">${fmt(a.price)}</span><span class="ob-size">${fmtK(a.size)}</span></div>`).join('');
  $('bidSide').innerHTML=bids.map(b=>`<div class="ob-row"><div class="depth-bar" style="width:${(b.size/maxB*100).toFixed(0)}%"></div><span class="ob-price">${fmt(b.price)}</span><span class="ob-size">${fmtK(b.size)}</span></div>`).join('');
  $('obSpread').textContent=fmt(Math.abs(asks[0].price-bids[0].price),4);
  $('obMid').textContent=fmt(mid);
  $('obImbal').textContent=fmt(imbal,1)+'%';
  $('obImbal').style.color=imbal>55?'var(--green)':imbal<45?'var(--red)':'var(--text2)';
}

// ── MARKET DEPTH ───────────────────────────
function renderDepth(){
  const canvas=$('depthCanvas');if(!canvas)return;
  const ctx=canvas.getContext('2d');
  const W=canvas.offsetWidth||260,H=200;
  canvas.width=W;canvas.height=H;
  ctx.clearRect(0,0,W,H);

  const sym=S.depthSym,mid=S.prices[sym];
  const levels=15;
  const asks=[],bids=[];
  let ap=mid,bp=mid;
  let cumulAsk=0,cumulBid=0;
  for(let i=0;i<levels;i++){
    ap+=mid*0.0003;bp-=mid*0.0003;
    cumulAsk+=Math.floor(Math.random()*10000)+500;
    cumulBid+=Math.floor(Math.random()*10000)+500;
    asks.push({price:Math.round(ap*100)/100,cumul:cumulAsk});
    bids.push({price:Math.round(bp*100)/100,cumul:cumulBid});
  }
  bids.reverse();

  const allPrices=[...bids.map(b=>b.price),...asks.map(a=>a.price)];
  const maxCumul=Math.max(cumulAsk,cumulBid);
  const pMin=Math.min(...allPrices),pMax=Math.max(...allPrices);
  const pad={t:10,r:10,b:24,l:10};
  const cw=W-pad.l-pad.r,ch=H-pad.t-pad.b;
  const xOf=p=>pad.l+((p-pMin)/(pMax-pMin))*cw;
  const yOf=c=>pad.t+(1-(c/maxCumul))*ch;

  // Both curves share the midpoint at bottom so they meet cleanly
  const midX=xOf(mid);
  const bottomY=H-pad.b;

  // Bid area — from left edge, steps right toward mid, meets baseline at midX
  ctx.beginPath();
  ctx.moveTo(xOf(bids[0].price),bottomY);
  bids.forEach(b=>ctx.lineTo(xOf(b.price),yOf(b.cumul)));
  ctx.lineTo(midX,bottomY);
  ctx.closePath();
  ctx.fillStyle='rgba(0,214,143,0.18)';ctx.fill();
  ctx.beginPath();
  ctx.moveTo(xOf(bids[0].price),yOf(bids[0].cumul));
  bids.forEach((b,i)=>{if(i>0)ctx.lineTo(xOf(b.price),yOf(b.cumul));});
  ctx.lineTo(midX,bottomY);
  ctx.strokeStyle='#00d68f';ctx.lineWidth=1.8;ctx.lineJoin='round';ctx.stroke();

  // Ask area — from midX, steps right away from mid
  ctx.beginPath();
  ctx.moveTo(midX,bottomY);
  asks.forEach(a=>ctx.lineTo(xOf(a.price),yOf(a.cumul)));
  ctx.lineTo(xOf(asks[asks.length-1].price),bottomY);
  ctx.closePath();
  ctx.fillStyle='rgba(255,77,106,0.18)';ctx.fill();
  ctx.beginPath();
  ctx.moveTo(midX,bottomY);
  asks.forEach(a=>ctx.lineTo(xOf(a.price),yOf(a.cumul)));
  ctx.strokeStyle='#ff4d6a';ctx.lineWidth=1.8;ctx.lineJoin='round';ctx.stroke();

  // Mid vertical line
  ctx.setLineDash([3,3]);ctx.strokeStyle='rgba(255,255,255,0.25)';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(midX,pad.t);ctx.lineTo(midX,bottomY);ctx.stroke();ctx.setLineDash([]);

  // Grid lines
  ctx.strokeStyle='rgba(26,42,58,0.7)';ctx.lineWidth=0.5;
  for(let g=1;g<=3;g++){
    const gy=pad.t+(g/4)*ch;
    ctx.beginPath();ctx.moveTo(pad.l,gy);ctx.lineTo(W-pad.r,gy);ctx.stroke();
  }

  // Mid price label
  ctx.fillStyle='rgba(200,220,240,0.7)';ctx.font='bold 9px IBM Plex Mono';ctx.textAlign='center';ctx.textBaseline='top';
  ctx.fillText(fmt(mid),midX,bottomY+3);

  // Bid / Ask labels
  ctx.font='9px IBM Plex Mono';ctx.textBaseline='middle';
  ctx.fillStyle='rgba(0,214,143,0.7)';ctx.textAlign='left';
  ctx.fillText('BID',pad.l+4,pad.t+10);
  ctx.fillStyle='rgba(255,77,106,0.7)';ctx.textAlign='right';
  ctx.fillText('ASK',W-pad.r-4,pad.t+10);
}

// ── ANALYTICS ──────────────────────────────
function calcRSI(hist,n=14){
  if(hist.length<n+1)return 50;
  let g=0,l=0;
  for(let i=hist.length-n;i<hist.length;i++){const d=hist[i]-hist[i-1];d>0?g+=d:l+=Math.abs(d);}
  if(l===0)return 100;return Math.round(100-(100/(1+(g/n)/(l/n))));
}
function ema(arr,n){let k=2/(n+1),e=arr[0];for(let i=1;i<arr.length;i++)e=arr[i]*k+e*(1-k);return e;}
function stdDev(arr){const m=arr.reduce((a,b)=>a+b,0)/arr.length;return Math.sqrt(arr.reduce((a,b)=>a+(b-m)**2,0)/arr.length);}

const PATTERNS=[
  {name:'Bull Flag',     desc:'Strong uptrend, short consolidation', fn:h=>h.slice(-8)[0]<h.slice(-1)[0]&&h.slice(-4).every((_,i,a)=>i===0||Math.abs(a[i]-a[i-1])<a[i]*0.001)},
  {name:'Breakout ↑',    desc:'Exceeds recent 15-bar high',           fn:h=>h[h.length-1]>Math.max(...h.slice(-16,-1))},
  {name:'Breakdown ↓',   desc:'Breaks recent 15-bar low',             fn:h=>h[h.length-1]<Math.min(...h.slice(-16,-1))},
  {name:'Doji',          desc:'Indecision — reversal watch',          fn:h=>Math.abs(h[h.length-1]-h[h.length-5])<h[h.length-1]*0.001},
  {name:'V-Shape',       desc:'Sharp reversal detected',              fn:h=>h[h.length-5]<h[h.length-10]&&h[h.length-1]>h[h.length-3]},
  {name:'Momentum ↑',   desc:'Sustained directional push',           fn:h=>h[h.length-1]-h[h.length-10]>h[h.length-10]*0.005},
];

function renderAnalytics(){
  const sym=S.analyticsSym,hist=S.histories[sym]||[S.prices[sym]],p=S.prices[sym];
  const rsi=calcRSI(hist);
  const vwap=hist.reduce((a,b)=>a+b,0)/hist.length;
  const macd=hist.length>26?ema(hist,12)-ema(hist,26):0;
  const slice20=hist.slice(-20);
  const vol=stdDev(slice20)/p*100;
  const ma20=slice20.reduce((a,b)=>a+b,0)/slice20.length;
  const sd=stdDev(slice20);
  const bollUp=ma20+2*sd,bollDn=ma20-2*sd,bw=(bollUp-bollDn)/ma20*100;
  const stoch=hist.length>14?Math.round(((p-Math.min(...hist.slice(-14)))/(Math.max(...hist.slice(-14))-Math.min(...hist.slice(-14))||1))*100):50;

  const rsiEl=$('rsiVal');
  if(rsiEl){rsiEl.textContent=rsi;rsiEl.style.color=rsi<35?'var(--green)':rsi>65?'var(--red)':'var(--text)';}
  const rb=$('rsiBar');if(rb){rb.style.width=rsi+'%';rb.style.background=rsi<35?'var(--green)':rsi>65?'var(--red)':'var(--accent2)';}
  const rn=$('rsiNote');if(rn)rn.textContent=rsi<35?'OVERSOLD':rsi>65?'OVERBOUGHT':'NEUTRAL';

  const mv=$('macdVal');if(mv){mv.textContent=fmt(macd,4);mv.style.color=macd>0?'var(--green)':'var(--red)';}
  const ms=$('macdSub');if(ms)ms.textContent='Histogram: '+(macd>0?'+':'')+fmt(macd,4);

  const vv=$('vwapVal');if(vv)vv.textContent=fmt(vwap);
  const vs=$('vwapSub');if(vs){const d=(p-vwap)/vwap*100;vs.textContent=`vs Price: ${d>=0?'+':''}${fmt(d,2)}%`;vs.style.color=d>=0?'var(--green)':'var(--red)';}

  const voel=$('volVal');if(voel)voel.textContent=fmt(vol,3)+'%';
  const vosu=$('volSub');if(vosu){const r=vol>0.25?'HIGH':vol>0.12?'MEDIUM':'LOW';vosu.textContent=r;vosu.style.color=r==='HIGH'?'var(--red)':r==='MEDIUM'?'var(--amber)':'var(--green)';}

  const bv=$('bollVal');if(bv)bv.textContent=`${fmt(bollDn)} – ${fmt(bollUp)}`;
  const bs=$('bollSub');if(bs)bs.textContent=`Band width: ${fmt(bw,2)}%`;

  const sv=$('stochVal');if(sv){sv.textContent=stoch;sv.style.color=stoch<20?'var(--green)':stoch>80?'var(--red)':'var(--text)';}
  const ss=$('stochSub');if(ss)ss.textContent=stoch<20?'OVERSOLD':stoch>80?'OVERBOUGHT':'NEUTRAL';

  let pat=null;for(const p2 of PATTERNS){try{if(p2.fn(hist)){pat=p2;break;}}catch(e){}}
  const pv=$('patternVal');if(pv)pv.textContent=pat?pat.name:'No pattern';
  const pd=$('patternDesc');if(pd)pd.textContent=pat?pat.desc:'Continue scanning...';

  drawMomentum(hist);
}

function drawMomentum(hist){
  const c=$('momentumCanvas');if(!c)return;
  const ctx=c.getContext('2d');
  const W=c.offsetWidth||300,H=44;c.width=W;c.height=H;
  ctx.clearRect(0,0,W,H);
  const n=30,recent=hist.slice(-n);
  const max=Math.max(...recent),min=Math.min(...recent);
  const bw=W/n;
  recent.forEach((v,i)=>{
    const norm=max===min?0.5:(v-min)/(max-min);
    const bh=norm*H*0.9+2;
    const r=Math.round(255*(1-norm)),g=Math.round(214*norm);
    ctx.fillStyle=`rgb(${r},${g},80)`;
    ctx.fillRect(i*bw+1,H-bh,bw-2,bh);
  });
}

// ── CORRELATION MATRIX ─────────────────────
function renderCorrelation(){
  const canvas=$('corrCanvas');if(!canvas)return;
  const ctx=canvas.getContext('2d');
  const syms=S.watchlist.slice(0,6);
  const n=syms.length;
  const W=canvas.offsetWidth||280;
  const pad={l:38,t:18,r:4,b:4};
  const gridW=W-pad.l-pad.r;
  const cellSize=Math.floor(gridW/n);
  const H=pad.t+cellSize*n+pad.b;
  canvas.width=W;canvas.height=H;
  ctx.clearRect(0,0,W,H);

  // Column labels
  ctx.font='bold 9px IBM Plex Mono';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillStyle='#7a9ab0';
  syms.forEach((s,j)=>ctx.fillText(s,pad.l+j*cellSize+cellSize/2,pad.t/2));
  // Row labels
  ctx.textAlign='right';
  syms.forEach((s,i)=>ctx.fillText(s,pad.l-4,pad.t+i*cellSize+cellSize/2));

  for(let i=0;i<n;i++){
    const histA=S.histories[syms[i]]||[];
    for(let j=0;j<n;j++){
      const histB=S.histories[syms[j]]||[];
      let corr=0;
      if(i===j){corr=1;}
      else if(histA.length>10&&histB.length>10){
        const len=Math.min(histA.length,histB.length,60);
        const a=histA.slice(-len),b=histB.slice(-len);
        const ma=a.reduce((x,y)=>x+y,0)/len,mb=b.reduce((x,y)=>x+y,0)/len;
        let num=0,da=0,db=0;
        for(let k=0;k<len;k++){num+=(a[k]-ma)*(b[k]-mb);da+=(a[k]-ma)**2;db+=(b[k]-mb)**2;}
        corr=Math.max(-1,Math.min(1,num/Math.sqrt(da*db||1)));
      }
      const abs=Math.abs(corr);
      const x=pad.l+j*cellSize,y=pad.t+i*cellSize,gap=2;
      if(corr>0) ctx.fillStyle=`rgba(0,214,143,${0.12+abs*0.72})`;
      else        ctx.fillStyle=`rgba(255,77,106,${0.12+abs*0.72})`;
      ctx.fillRect(x+gap,y+gap,cellSize-gap*2,cellSize-gap*2);
      // Text with drop shadow for legibility on all backgrounds
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.font=`bold ${cellSize>32?10:9}px IBM Plex Mono`;
      ctx.fillStyle='rgba(0,0,0,0.5)';
      ctx.fillText(fmt(corr,1),x+cellSize/2+0.5,y+cellSize/2+0.5);
      ctx.fillStyle='rgba(255,255,255,0.93)';
      ctx.fillText(fmt(corr,1),x+cellSize/2,y+cellSize/2);
    }
  }
}

// ── PORTFOLIO ──────────────────────────────
function addPosition(sym,qty,avgPrice){
  if(!S.portfolio[sym])S.portfolio[sym]={qty:0,avgPrice:0,invested:0};
  const pos=S.portfolio[sym];
  const total=pos.qty*pos.avgPrice+qty*avgPrice;
  pos.qty+=qty;
  pos.avgPrice=total/pos.qty;
  pos.invested=pos.qty*pos.avgPrice;
}
function renderPortfolio(){
  const tbody=$('portfolioBody');if(!tbody)return;
  let totalVal=0,totalInvested=0;
  const rows=Object.entries(S.portfolio).map(([sym,pos])=>{
    const now=S.prices[sym]||pos.avgPrice;
    const val=pos.qty*now,pnl=val-pos.invested,pct=(pnl/pos.invested)*100;
    totalVal+=val;totalInvested+=pos.invested;
    return `<tr><td style="color:var(--accent2)">${sym}</td><td>${pos.qty}</td><td>${fmt(pos.avgPrice)}</td><td>${fmt(now)}</td><td class="${pnl>=0?'up':'dn'}">${pnl>=0?'+':''}${fmt(pnl,2)}</td></tr>`;
  });
  tbody.innerHTML=rows.join('');
  const pnl=totalVal-totalInvested,ret=totalInvested>0?pnl/totalInvested*100:0;
  const ptv=$('ptotalVal');if(ptv)ptv.textContent=fmtDollar(totalVal);
  const pp=$('ppnl');if(pp){pp.textContent=(pnl>=0?'+':'')+fmtDollar(Math.abs(pnl));pp.style.color=pnl>=0?'var(--green)':'var(--red)';}
  const pr=$('preturn');if(pr){pr.textContent=(ret>=0?'+':'')+fmt(ret,2)+'%';pr.style.color=ret>=0?'var(--green)':'var(--red)';}
}

// ── MINI CHARTS ────────────────────────────
function renderMiniCharts(){
  const grid=$('miniChartsGrid');if(!grid)return;
  grid.innerHTML=S.watchlist.map(sym=>{
    const p=S.prices[sym],c=S.changes[sym],dir=c>=0?'up':'dn',arr=c>=0?'▲':'▼';
    return `<div class="mini-chart-card" onclick="setChart('${sym}')">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span class="mini-sym">${sym}</span>
        <span class="mini-chg ${dir}">${arr}${fmt(Math.abs(c),2)}%</span>
      </div>
      <span class="mini-price">${fmt(p)}</span>
      <canvas class="mini-canvas" id="mini-${sym}" width="200" height="36"></canvas>
    </div>`;
  }).join('');
  // Draw each mini sparkline
  requestAnimationFrame(()=>{
    S.watchlist.forEach(sym=>{
      const c=document.getElementById('mini-'+sym);if(!c)return;
      const ctx=c.getContext('2d');
      const hist=S.histories[sym]||[];
      const W=c.offsetWidth||200,H=36;c.width=W;c.height=H;
      if(hist.length<2)return;
      const mn=Math.min(...hist),mx=Math.max(...hist),range=mx-mn||1;
      const up=S.changes[sym]>=0;
      ctx.beginPath();
      hist.forEach((v,i)=>{const x=(i/(hist.length-1))*W,y=(1-(v-mn)/range)*(H-2)+1;i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);});
      ctx.strokeStyle=up?'#00d68f':'#ff4d6a';ctx.lineWidth=1.2;ctx.lineJoin='round';ctx.stroke();
    });
  });
}

// ── NEWS ───────────────────────────────────
const NEWS=[
  {t:'{s} beats earnings by {n}%, institutional buying surge',sent:'bull'},
  {t:'{s} upgraded to Strong Buy, target raised to ${p}',sent:'bull'},
  {t:'{s} new product announcement — shares react positively',sent:'bull'},
  {t:'{s} announces $2B buyback programme',sent:'bull'},
  {t:'{s} regulatory probe widened — shares under pressure',sent:'bear'},
  {t:'{s} misses quarterly revenue, guidance lowered',sent:'bear'},
  {t:'{s} large block sell detected in dark pool',sent:'bear'},
  {t:'{s} insider selling flagged by SEC filing',sent:'bear'},
  {t:'{s} unusual options activity detected',sent:'neut'},
  {t:'{s} CEO to present at Goldman Sachs conference',sent:'neut'},
  {t:'{s} volume spike 3x average — no news catalyst',sent:'neut'},
  {t:'Market-wide volatility spike detected — VIX +{n}%',sent:'bear'},
];

function addNews(){
  const feed=$('newsFeed');if(!feed)return;
  const tmpl=NEWS[Math.floor(Math.random()*NEWS.length)];
  const sym=S.newsFilter==='ALL'?S.watchlist[Math.floor(Math.random()*S.watchlist.length)]:S.newsFilter;
  const text=tmpl.t.replace('{s}',sym).replace('{n}',fmt(Math.random()*10+1,1)).replace('{p}',fmt(S.prices[sym]*1.1,0));
  const div=document.createElement('div');
  div.className='news-item '+tmpl.sent;
  div.innerHTML=`<div class="news-sym">${sym} — ${tmpl.sent==='bull'?'BULLISH':tmpl.sent==='bear'?'BEARISH':'NEUTRAL'}</div><div class="news-text">${text}</div><div class="news-time">${ts()}</div>`;
  feed.prepend(div);
  while(feed.children.length>25)feed.lastChild.remove();
}

// ── PRICE ALERTS ───────────────────────────
function renderAlerts(){
  const list=$('alertsList');if(!list)return;
  if(!S.priceAlerts.length){list.innerHTML='<div class="no-alerts">No active alerts</div>';return;}
  list.innerHTML=S.priceAlerts.map((a,i)=>`
    <div class="alert-item ${a.triggered?'triggered':''}">
      <span class="alert-sym-badge">${a.sym}</span>
      <span style="color:var(--text2)">${a.dir==='above'?'↑ Above':'↓ Below'}</span>
      <span style="color:var(--text)">${fmt(a.target)}</span>
      ${a.triggered?'<span style="color:var(--amber);font-size:9px">TRIGGERED</span>':''}
      <span class="alert-del" onclick="removeAlert(${i})">✕</span>
    </div>`).join('');
}

function checkPriceAlerts(){
  S.priceAlerts.forEach(a=>{
    if(a.triggered)return;
    const p=S.prices[a.sym];
    if((a.dir==='above'&&p>=a.target)||(a.dir==='below'&&p<=a.target)){
      a.triggered=true;
      setAlert(`🔔 PRICE ALERT: ${a.sym} ${a.dir==='above'?'exceeded':'fell below'} ${fmt(a.target)}`,'warn');
      if(S.soundEnabled){try{const ctx=new AudioContext();const o=ctx.createOscillator();o.connect(ctx.destination);o.frequency.value=880;o.start();setTimeout(()=>o.stop(),100);}catch(e){}}
    }
  });
  renderAlerts();
}

window.removeAlert=i=>{S.priceAlerts.splice(i,1);renderAlerts();};

// ── ECONOMIC CALENDAR ──────────────────────
function renderCalendar(){
  const tbody=$('calendarBody');if(!tbody)return;
  tbody.innerHTML=ECON_EVENTS.map(e=>{
    const ic=e.impact==='high'?'impact-high':e.impact==='med'?'impact-med':'impact-low';
    let ac='';let actTxt='—';
    if(e.actual){
      const fNum=parseFloat(e.forecast.replace(/[^0-9.-]/g,''));
      const aNum=parseFloat(e.actual.replace(/[^0-9.-]/g,''));
      if(!isNaN(fNum)&&!isNaN(aNum)){ac=aNum>fNum?'actual-beat':aNum<fNum?'actual-miss':'actual-meet';}
      actTxt=e.actual;
    }
    return `<tr><td style="color:var(--text3)">${e.time}</td><td style="color:var(--text)">${e.event}</td><td class="${ic}">${e.impact.toUpperCase()}</td><td style="color:var(--text2)">${e.forecast}</td><td class="${ac}">${actTxt}</td></tr>`;
  }).join('');
}

// ── MARKET STATS ───────────────────────────
function renderMarketStats(){
  const grid=$('marketStatsGrid');if(!grid)return;
  const advDecl=S.watchlist.filter(s=>S.changes[s]>0).length;
  const vix=(12+Math.abs(randNorm(0,2))).toFixed(2);
  $('vixDisplay').textContent='VIX '+vix;
  const topMover=[...S.watchlist].sort((a,b)=>Math.abs(S.changes[b])-Math.abs(S.changes[a]))[0];
  const totalVol=S.watchlist.reduce((a,s)=>a+S.volumes[s],0);
  const avgChg=S.watchlist.reduce((a,s)=>a+S.changes[s],0)/S.watchlist.length;
  grid.innerHTML=`
    <div class="mstat"><div class="mstat-lbl">ADVANCING</div><div class="mstat-val" style="color:var(--green)">${advDecl}/${S.watchlist.length}</div></div>
    <div class="mstat"><div class="mstat-lbl">DECLINING</div><div class="mstat-val" style="color:var(--red)">${S.watchlist.length-advDecl}/${S.watchlist.length}</div></div>
    <div class="mstat"><div class="mstat-lbl">TOP MOVER</div><div class="mstat-val" style="color:var(--accent)">${topMover}</div><div class="mstat-sub">${fmt(S.changes[topMover],2)}%</div></div>
    <div class="mstat"><div class="mstat-lbl">AVG CHANGE</div><div class="mstat-val" style="color:${avgChg>=0?'var(--green)':'var(--red)'}">${avgChg>=0?'+':''}${fmt(avgChg,2)}%</div></div>
    <div class="mstat"><div class="mstat-lbl">TOTAL VOLUME</div><div class="mstat-val">${fmtK(totalVol)}</div></div>
    <div class="mstat"><div class="mstat-lbl">VIX INDEX</div><div class="mstat-val" style="color:var(--amber)">${vix}</div><div class="mstat-sub">${vix>20?'HIGH FEAR':vix>15?'ELEVATED':'LOW FEAR'}</div></div>`;
}

// ── SESSION P&L ────────────────────────────
function updateSessionPnl(){
  let pnl=0;
  Object.entries(S.portfolio).forEach(([sym,pos])=>{
    pnl+=(S.prices[sym]-pos.avgPrice)*pos.qty;
  });
  const el=$('sessionPnl');
  if(el){el.innerHTML=`P&amp;L: <b style="color:${pnl>=0?'var(--green)':'var(--red)'}">${pnl>=0?'+':''}${fmtDollar(Math.abs(pnl))}</b>`;}
}

// ── ALERT BAR ──────────────────────────────
function setAlert(msg,type='info'){
  const bar=$('alertBar'),txt=$('alertText'),lbl=$('alertLabel');
  if(!bar)return;
  bar.className='alert-bar '+(type==='warn'?'warn':type==='danger'?'danger':'');
  lbl.textContent=type==='warn'?'⚡ ALERT':type==='danger'?'🔴 CRITICAL':'ℹ INFO';
  txt.textContent=msg;
}

function checkAutoAlerts(){
  for(const sym of S.watchlist){
    if(Math.abs(S.changes[sym])>3){setAlert(`${sym} moved ${S.changes[sym]>0?'+':''}${fmt(S.changes[sym],2)}% from open — unusual activity`,'danger');return;}
  }
  for(const sym of S.watchlist){
    const rsi=calcRSI(S.histories[sym]);
    if(rsi<25){setAlert(`${sym} RSI at ${rsi} — extreme oversold`,'warn');return;}
    if(rsi>78){setAlert(`${sym} RSI at ${rsi} — extreme overbought`,'warn');return;}
  }
  setAlert('All markets nominal. Monitoring for anomalies...','info');
}

$('alertDismiss').addEventListener('click',()=>setAlert('Alert dismissed. Monitoring resumed.','info'));

// ── COMMAND TERMINAL ───────────────────────
const CMDS={
  help:()=>[
    {c:'cmd-head',v:'═══ Available Commands ═══'},
    {c:'cmd-info',v:'price <SYM>         — Current price & stats'},
    {c:'cmd-info',v:'chart <SYM>         — Switch main chart'},
    {c:'cmd-info',v:'ob <SYM>            — Switch order book'},
    {c:'cmd-info',v:'add <SYM>           — Add to watchlist'},
    {c:'cmd-info',v:'remove <SYM>        — Remove from watchlist'},
    {c:'cmd-info',v:'buy <SYM> <qty>     — Add portfolio position'},
    {c:'cmd-info',v:'portfolio           — Show portfolio'},
    {c:'cmd-info',v:'rsi <SYM>           — RSI value'},
    {c:'cmd-info',v:'alert <MSG>         — Post custom alert'},
    {c:'cmd-info',v:'top                 — Top mover'},
    {c:'cmd-info',v:'compare <A> <B>     — Compare two symbols'},
    {c:'cmd-info',v:'clear               — Clear terminal'},
  ],
  price:args=>{
    const sym=args[0]?.toUpperCase();if(!S.prices[sym])return[{c:'cmd-err',v:`Unknown: ${sym}`}];
    const c=S.changes[sym],rsi=calcRSI(S.histories[sym]);
    return[{c:'cmd-ok',v:`${sym}  $${fmt(S.prices[sym])}  ${c>=0?'+':''}${fmt(c,2)}%  Vol:${fmtK(S.volumes[sym])}  RSI:${rsi}`}];
  },
  chart:args=>{const sym=args[0]?.toUpperCase();if(!S.prices[sym])return[{c:'cmd-err',v:`Unknown: ${sym}`}];S.chartSym=sym;$('chartSymbol').value=sym;return[{c:'cmd-ok',v:`Chart → ${sym}`}];},
  ob:args=>{const sym=args[0]?.toUpperCase();if(!S.prices[sym])return[{c:'cmd-err',v:`Unknown: ${sym}`}];S.obSym=sym;$('obSymbol').value=sym;return[{c:'cmd-ok',v:`Order book → ${sym}`}];},
  add:args=>{
    const sym=args[0]?.toUpperCase()?.trim();if(!sym)return[{c:'cmd-err',v:'Usage: add <SYM>'}];
    if(S.watchlist.includes(sym))return[{c:'cmd-err',v:`${sym} already tracked`}];
    addToWatchlist(sym);return[{c:'cmd-ok',v:`${sym} added to watchlist`}];
  },
  remove:args=>{
    const sym=args[0]?.toUpperCase();const i=S.watchlist.indexOf(sym);
    if(i===-1)return[{c:'cmd-err',v:`${sym} not in watchlist`}];
    S.watchlist.splice(i,1);return[{c:'cmd-ok',v:`${sym} removed`}];
  },
  buy:args=>{
    const sym=args[0]?.toUpperCase(),qty=parseInt(args[1]);
    if(!S.prices[sym])return[{c:'cmd-err',v:`Unknown: ${sym}`}];
    if(!qty||qty<1)return[{c:'cmd-err',v:'Usage: buy <SYM> <qty>'}];
    addPosition(sym,qty,S.prices[sym]);renderPortfolio();
    return[{c:'cmd-ok',v:`Bought ${qty} × ${sym} @ $${fmt(S.prices[sym])} = ${fmtDollar(qty*S.prices[sym])}`}];
  },
  portfolio:()=>{
    const lines=[{c:'cmd-head',v:'Portfolio:'}];
    if(!Object.keys(S.portfolio).length)return[{c:'cmd-line',v:'No positions.'}];
    Object.entries(S.portfolio).forEach(([sym,pos])=>{
      const now=S.prices[sym],pnl=(now-pos.avgPrice)*pos.qty;
      lines.push({c:'cmd-line',v:`  ${sym.padEnd(6)} qty:${pos.qty}  avg:$${fmt(pos.avgPrice)}  now:$${fmt(now)}  P&L:${pnl>=0?'+':''}$${fmt(pnl)}`});
    });
    return lines;
  },
  rsi:args=>{
    const sym=args[0]?.toUpperCase();if(!S.histories[sym])return[{c:'cmd-err',v:`No data: ${sym}`}];
    const r=calcRSI(S.histories[sym]);
    return[{c:'cmd-ok',v:`${sym} RSI(14): ${r}  [${r<35?'OVERSOLD':r>65?'OVERBOUGHT':'NEUTRAL'}]`}];
  },
  alert:args=>{
    const msg=args.join(' ');if(!msg)return[{c:'cmd-err',v:'Usage: alert <msg>'}];
    setAlert('📌 '+msg,'warn');return[{c:'cmd-ok',v:'Alert posted'}];
  },
  top:()=>{
    const sym=[...S.watchlist].sort((a,b)=>Math.abs(S.changes[b])-Math.abs(S.changes[a]))[0];
    return[{c:'cmd-ok',v:`Top mover: ${sym}  ${S.changes[sym]>=0?'+':''}${fmt(S.changes[sym],2)}%  $${fmt(S.prices[sym])}`}];
  },
  compare:args=>{
    const a=args[0]?.toUpperCase(),b=args[1]?.toUpperCase();
    if(!S.prices[a]||!S.prices[b])return[{c:'cmd-err',v:'Usage: compare <SYM> <SYM>'}];
    return[
      {c:'cmd-head',v:`Comparison: ${a} vs ${b}`},
      {c:'cmd-line',v:`  Price:  ${a} $${fmt(S.prices[a])}  |  ${b} $${fmt(S.prices[b])}`},
      {c:'cmd-line',v:`  Chg%:   ${a} ${fmt(S.changes[a],2)}%  |  ${b} ${fmt(S.changes[b],2)}%`},
      {c:'cmd-line',v:`  RSI:    ${a} ${calcRSI(S.histories[a]||[])}  |  ${b} ${calcRSI(S.histories[b]||[])}`},
      {c:'cmd-line',v:`  Vol:    ${a} ${fmtK(S.volumes[a])}  |  ${b} ${fmtK(S.volumes[b])}`},
    ];
  },
  clear:()=>{$('cmdOutput').innerHTML='';return[];},
};

function runCmd(raw){
  const out=$('cmdOutput');
  const parts=raw.trim().split(/\s+/),cmd=parts[0].toLowerCase(),args=parts.slice(1);
  appendCmd('> '+raw,'cmd-echo');
  if(!cmd)return;
  S.cmdHistory.unshift(raw);S.cmdHistIdx=-1;
  const fn=CMDS[cmd];
  if(!fn){appendCmd(`Not found: ${cmd}. Type 'help'`,'cmd-err');return;}
  fn(args).forEach(l=>appendCmd(l.v,l.c));
  out.scrollTop=out.scrollHeight;
}
function appendCmd(txt,cls='cmd-line'){const d=el('div',cls);d.textContent=txt;$('cmdOutput').appendChild(d);}

// ── UI WIRING ──────────────────────────────
$('chartSymbol').addEventListener('change',e=>{S.chartSym=e.target.value;drawChart();});
$('chartType').addEventListener('change',e=>{S.chartType=e.target.value;drawChart();});
$('chartInterval').addEventListener('change',e=>{S.chartInterval=parseInt(e.target.value);});
$('chartResetBtn').addEventListener('click',()=>{S.histories[S.chartSym]=[S.prices[S.chartSym]];drawChart();});
$('tradeFilter').addEventListener('change',e=>{S.tradeFilter=e.target.value;renderTrades();});
$('flashToggle').addEventListener('change',e=>{S.flashEnabled=e.target.checked;});
$('largeOnlyToggle').addEventListener('change',e=>{S.largeOnly=e.target.checked;renderTrades();});
$('obSymbol').addEventListener('change',e=>{S.obSym=e.target.value;renderOrderBook();});
$('depthSymbol').addEventListener('change',e=>{S.depthSym=e.target.value;renderDepth();});
$('analyticsSym').addEventListener('change',e=>{S.analyticsSym=e.target.value;renderAnalytics();});
$('newsFilter').addEventListener('change',e=>{S.newsFilter=e.target.value;});

// Add symbol
$('addSymBtn').addEventListener('click',()=>{$('addSymRow').classList.remove('hidden');$('newSymInput').focus();});
$('cancelSym').addEventListener('click',()=>{$('addSymRow').classList.add('hidden');$('newSymInput').value='';});
$('confirmSym').addEventListener('click',()=>{
  const sym=$('newSymInput').value.toUpperCase().trim();
  if(sym&&!S.watchlist.includes(sym)){addToWatchlist(sym);}
  $('addSymRow').classList.add('hidden');$('newSymInput').value='';
});
$('newSymInput').addEventListener('keydown',e=>{if(e.key==='Enter')$('confirmSym').click();if(e.key==='Escape')$('cancelSym').click();});

function addToWatchlist(sym){
  const base=BASE[sym]?.price||(Math.random()*800+50);
  S.prices[sym]=base;S.prevPrices[sym]=base;S.opens[sym]=base;
  S.volumes[sym]=Math.floor(Math.random()*5e6)+5e5;
  S.histories[sym]=[base];S.changes[sym]=0;
  if(!S.watchlist.includes(sym))S.watchlist.push(sym);
  ['chartSymbol','tradeFilter','obSymbol','depthSymbol','analyticsSym','newsFilter','posSym','alertSym'].forEach(id=>{
    const el=document.getElementById(id);
    if(el&&!Array.from(el.options).find(o=>o.value===sym)){const o=document.createElement('option');o.value=o.text=sym;el.add(o);}
  });
}

// Portfolio
$('addPositionBtn').addEventListener('click',()=>{$('addPosRow').classList.remove('hidden');});
$('cancelPos').addEventListener('click',()=>{$('addPosRow').classList.add('hidden');});
$('confirmPos').addEventListener('click',()=>{
  const sym=$('posSym').value,qty=parseInt($('posQty').value)||0;
  if(sym&&qty>0){addPosition(sym,qty,S.prices[sym]);renderPortfolio();}
  $('addPosRow').classList.add('hidden');$('posQty').value='';
});

// Price alerts
$('addAlertBtn').addEventListener('click',()=>{$('addAlertRow').classList.remove('hidden');});
$('cancelAlert').addEventListener('click',()=>{$('addAlertRow').classList.add('hidden');});
$('confirmAlert').addEventListener('click',()=>{
  const sym=$('alertSym').value,dir=$('alertDir').value,target=parseFloat($('alertPrice').value);
  if(sym&&dir&&!isNaN(target)){S.priceAlerts.push({sym,dir,target,triggered:false});renderAlerts();}
  $('addAlertRow').classList.add('hidden');$('alertPrice').value='';
});

// Command
$('cmdRunBtn').addEventListener('click',()=>{const v=$('cmdInput').value.trim();if(v){runCmd(v);$('cmdInput').value='';}});
$('cmdClearBtn').addEventListener('click',()=>{$('cmdOutput').innerHTML='';});
$('cmdInput').addEventListener('keydown',e=>{
  if(e.key==='Enter'){const v=$('cmdInput').value.trim();if(v){runCmd(v);$('cmdInput').value='';}}
  else if(e.key==='ArrowUp'){if(S.cmdHistIdx<S.cmdHistory.length-1){S.cmdHistIdx++;$('cmdInput').value=S.cmdHistory[S.cmdHistIdx]||'';}e.preventDefault();}
  else if(e.key==='ArrowDown'){if(S.cmdHistIdx>0){S.cmdHistIdx--;$('cmdInput').value=S.cmdHistory[S.cmdHistIdx];}else{S.cmdHistIdx=-1;$('cmdInput').value='';}e.preventDefault();}
});

// ── DRAG PANELS ────────────────────────────
(function(){
  let drag=null,ox=0,oy=0,startLeft=0,startTop=0,z=10;
  document.querySelectorAll('.panel-header.draggable').forEach(h=>{
    h.addEventListener('mousedown',e=>{
      if(e.target.tagName==='SELECT'||e.target.tagName==='INPUT'||e.target.tagName==='BUTTON')return;
      const panel=h.closest('.panel');if(!panel)return;
      drag=panel;
      const r=panel.getBoundingClientRect();
      // Convert to absolute positioning
      if(!panel.style.position||panel.style.position!=='absolute'){
        panel.style.position='absolute';
        panel.style.left=r.left+'px';
        panel.style.top=(r.top+window.scrollY)+'px';
        panel.style.width=r.width+'px';
        panel.style.zIndex=++z;
      }
      ox=e.clientX-r.left;oy=e.clientY-r.top;
      panel.classList.add('dragging');e.preventDefault();
    });
  });
  document.addEventListener('mousemove',e=>{
    if(!drag)return;
    drag.style.left=Math.max(0,e.clientX-ox)+'px';
    drag.style.top=Math.max(72,e.clientY-oy+window.scrollY)+'px';
  });
  document.addEventListener('mouseup',()=>{if(drag){drag.classList.remove('dragging');drag=null;}});
})();

// ── BOOT MESSAGES ──────────────────────────
appendCmd('MARKET PULSE TERMINAL v2.0','cmd-head');
appendCmd('Feeds connected. Type help for commands.','cmd-info');
appendCmd('Try: buy NVDA 10   compare AAPL MSFT','cmd-line');

// ── MAIN LOOP ──────────────────────────────
let fc=0;
function loop(){
  tickPrices();
  if(fc%2===0)updateTicker();
  if(fc%S.chartInterval===0)drawChart();
  if(fc%3===0)renderWatchlist();
  addTrades();
  if(fc%2===0)renderTrades();
  if(fc%4===0){renderOrderBook();renderDepth();}
  if(fc%5===0)renderAnalytics();
  if(fc%6===0){renderHeatmap();renderMiniCharts();}
  if(fc%8===0)renderCorrelation();
  if(fc%6===0)renderPortfolio();
  if(fc%10===0){renderMarketStats();updateSessionPnl();}
  if(fc%12===0)checkAutoAlerts();
  if(fc%35===0||(fc>10&&Math.random()<0.035))addNews();
  fc++;
}

// Initial renders
renderCalendar();
renderAlerts();
setInterval(loop,250);
loop();