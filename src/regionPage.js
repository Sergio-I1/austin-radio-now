// The "Radio near me" page (served at /).
export const REGION_PAGE = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Radio Near Me</title>
<meta name="theme-color" content="#14110f">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
:root{color-scheme:light dark;--bg:light-dark(#f6f1e8,#14110f);--card:light-dark(#fffdf8,#1f1b18);--ink:light-dark(#1d1916,#f1ebe3);
--mute:light-dark(#6f665d,#a59b90);--line:light-dark(#e4dccf,#2f2925);--song:#1d8a4e;--brk:#c46a00;--nod:#8a8178;--acc:#bf3b1e;
--s4:#1d8a4e;--s3:#6aa632;--s2:#d9a400;--s1:#d0582a;--s0:#8a8178}
*{box-sizing:border-box;min-width:0}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}
header,main{max-width:1100px;margin:auto;padding:0 12px}header{padding-top:18px}
h1{margin:0;font-size:26px;line-height:1.1}.sub{color:var(--mute);font-size:13px;margin-top:4px}
form{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
input[type=search]{flex:1 1 200px;font:inherit;font-size:16px;min-height:44px;padding:8px 12px;border-radius:10px;border:1px solid var(--line);background:var(--card);color:var(--ink)}
button,.btn{font:inherit;font-weight:600;min-height:44px;padding:8px 14px;border-radius:10px;border:1px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer;text-decoration:none;display:inline-flex;align-items:center}
button.primary{background:var(--ink);color:var(--bg);border-color:var(--ink)}
nav{display:flex;gap:8px;margin:14px 0 10px}nav button{border-radius:99px}nav button[aria-pressed=true]{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.chips{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 10px}.chip{min-height:36px;padding:4px 12px;border-radius:99px;font-size:13px}
.chip[aria-pressed=true]{background:var(--acc);color:#fff;border-color:var(--acc)}
.opt{display:flex;align-items:center;gap:8px;min-height:40px;color:var(--mute);font-size:14px}.opt input{width:20px;height:20px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 14px;display:flex;flex-direction:column;gap:4px}
.top{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}
.freq{font-size:26px;font-weight:800;letter-spacing:-.02em;line-height:1}.name{color:var(--mute);font-size:13px;text-align:right}
.sig{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--mute)}
.bars{display:inline-flex;align-items:flex-end;gap:2px;height:16px}.bars i{width:5px;border-radius:1px;background:var(--line)}
.bars i:nth-child(1){height:5px}.bars i:nth-child(2){height:8px}.bars i:nth-child(3){height:12px}.bars i:nth-child(4){height:16px}
.pills{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}
.pill{display:inline-block;padding:2px 9px;border-radius:99px;font-size:12px;font-weight:700;color:#fff}
.SONG{background:var(--song)}.AD{background:var(--brk)}.NO{background:var(--nod)}.g{background:transparent;color:var(--ink);border:1px solid var(--line);font-weight:600}
.title{font-weight:700;font-size:17px;line-height:1.25}.artist{font-size:14px}.meta{color:var(--mute);font-size:12px}
.card .zbtn{align-self:flex-start;min-height:36px;padding:4px 10px;font-size:13px;margin-top:4px}
.blocked{opacity:.6}
#map{height:min(70vh,560px);border-radius:14px;border:1px solid var(--line)}
details{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:8px 12px;margin:10px 0}summary{font-weight:700;min-height:32px;cursor:pointer}
.legend{display:flex;gap:10px;flex-wrap:wrap;font-size:13px;margin:8px 0}.legend span::before{content:"";display:inline-block;width:12px;height:12px;border-radius:50%;margin-right:5px;vertical-align:-1px;background:var(--c)}
.note{color:var(--mute);font-size:12px;margin:18px 0 30px}
.msg{padding:14px;background:var(--card);border:1px solid var(--line);border-radius:12px}
</style></head><body>
<header><h1>Radio near me</h1>
<div class="sub" id="where">Type where you are, or use your location. <a href="/austin">Austin live board + song log</a></div>
<form id="f"><input type="search" id="q" placeholder="City, ZIP or address" autocomplete="off" enterkeyhint="search">
<button class="primary" type="submit">Find stations</button><button type="button" id="loc">Use my location</button></form>
<nav><button id="tList" aria-pressed="true">Stations</button><button id="tMap" aria-pressed="false">Map</button></nav></header>
<main>
<section id="vList"><div class="chips" id="chips"></div>
<label class="opt"><input type="checkbox" id="showFar"> Show stations too far away to hear</label>
<div class="grid" id="grid"><div class="msg">Search a place to see the FM stations you can pick up there.</div></div></section>
<section id="vMap" hidden>
<div id="map"></div>
<div class="legend"><span style="--c:var(--s4)">Strong</span><span style="--c:var(--s3)">Good</span><span style="--c:var(--s2)">Weak</span><span style="--c:var(--s1)">Fading / static</span><span style="--c:var(--s0)">Can't hear</span></div>
<details id="adv"><summary>Advanced: signal zones</summary>
<label class="opt"><input type="checkbox" id="zones"> Show signal zones for the selected station (tap a tower)</label>
<label class="opt"><input type="checkbox" id="handoff"> Show where the same frequency turns into a different station</label>
<label class="opt"><input type="checkbox" id="follow"> Follow me while driving (updates as you move)</label>
<div class="meta" id="selInfo">No station selected.</div></details>
</section>
<p class="note">Signal strength is an estimate from each tower's power and height in FCC records. Hills, buildings, your car's antenna and the weather all change it. FM reception stays about the same day and night; it's AM radio that changes a lot after dark. Song info comes from iHeartRadio and TuneIn, and genres from Apple Music's catalog.</p>
</main>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
{
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const KM_MI=0.621371;
const LV=[{max:.6,label:"Strong",bars:4,c:"--s4"},{max:1,label:"Good",bars:3,c:"--s3"},{max:1.35,label:"Weak",bars:2,c:"--s2"},{max:1.8,label:"Fading / static",bars:1,c:"--s1"}];
const css=v=>getComputedStyle(document.documentElement).getPropertyValue(v).trim();
let here=null,center=null,stations=[],np={},genre="All",selected=null,map=null,layers=null,meLayer=null,watchId=null,npTimer=null;

// Rough service distance (km) where an FM signal is "good" (about the FCC's 60 dBu line), from power (kW) and antenna height (m)
const d60=s=>3.6*Math.pow(Math.max(s.erp,.01),.232)*Math.pow(Math.max(s.haat,20),.352);
function hav(a,b,c,d){const R=6371,t=x=>x*Math.PI/180,dl=t(c-a),dn=t(d-b);const h=Math.sin(dl/2)**2+Math.cos(t(a))*Math.cos(t(c))*Math.sin(dn/2)**2;return 2*R*Math.asin(Math.sqrt(h))}
function signal(s){const d=hav(here.lat,here.lon,s.lat,s.lon),r=d/d60(s);const l=LV.find(x=>r<=x.max)||{label:"Can't hear",bars:0,c:"--s0"};return {...l,d,r}}

function compute(){
  for(const s of stations){s.sig=signal(s);s.blockedBy=null}
  const byF={};for(const s of stations)(byF[s.freq]=byF[s.freq]||[]).push(s);
  for(const list of Object.values(byF)){list.sort((a,b)=>a.sig.r-b.sig.r);for(const s of list.slice(1))if(s.sig.bars>0)s.blockedBy=list[0]}
}
const key=s=>s.call+"|"+s.freq;
const cls=st=>st==="SONG"?"SONG":st&&st.startsWith("AD")?"AD":"NO";

function render(){
  if(!stations.length)return;
  const far=$("showFar").checked;
  const shown=stations.filter(s=>far||s.sig.bars>0);
  const gs=[...new Set(shown.map(s=>np[key(s)]?.genre).filter(Boolean))].sort();
  const hasAd=shown.some(s=>np[key(s)]?.status==="AD / TALK");
  const chips=["All",...gs,...(hasAd?["Ads / talk"]:[])];
  if(!chips.includes(genre))genre="All";
  $("chips").innerHTML=chips.map(g=>'<button class="chip" aria-pressed="'+(g===genre)+'" data-g="'+esc(g)+'">'+esc(g)+'</button>').join("");
  const list=shown.filter(s=>{const n=np[key(s)];return genre==="All"||(genre==="Ads / talk"?n?.status==="AD / TALK":n?.genre===genre)});
  $("grid").innerHTML=list.length?list.map(card).join(""):'<div class="msg">No stations match. Try "All".</div>';
}
function card(s){
  const n=np[key(s)],g=s.sig;
  const bars='<span class="bars" aria-hidden="true">'+[1,2,3,4].map(i=>'<i style="background:'+(i<=g.bars?"var("+g.c+")":"")+'"></i>').join("")+'</span>';
  const name=n?.stationName||s.call;
  let now='<div class="meta">Checking what\\'s on…</div>';
  if(n){now='<div class="pills"><span class="pill '+cls(n.status)+'">'+esc(n.status)+'</span>'+(n.genre?'<span class="pill g">'+esc(n.genre)+'</span>':'')+'</div>'+
    (n.status==="SONG"?'<div class="title">'+esc(n.title)+'</div><div class="artist">'+esc(n.artist)+'</div>':'<div class="artist">'+esc(n.note||[n.artist,n.title].filter(Boolean).join(" – "))+'</div>')}
  const trend=s.prevR!=null&&Math.abs(s.prevR-g.r)>.02?(g.r<s.prevR?" · getting stronger":" · getting weaker"):"";
  return '<div class="card'+(s.blockedBy?" blocked":"")+'"><div class="top"><span class="freq">'+esc(s.freq)+'</span><span class="name">'+esc(name)+(name!==s.call?" ("+esc(s.call)+")":"")+'<br>'+esc(s.city)+", "+esc(s.state)+'</span></div>'+
   '<div class="sig">'+bars+'<span>'+esc(g.label)+" · "+(g.d*KM_MI).toFixed(0)+" mi away"+trend+'</span></div>'+
   (s.blockedBy?'<div class="meta">Drowned out here by '+esc(s.blockedBy.call)+' on the same frequency</div>':'')+
   (s.serv!=="FM"?'<div class="meta">'+esc(s.kind)+'</div>':'')+now+
   '<button class="zbtn" data-k="'+esc(key(s))+'">Show signal zones</button></div>';
}

async function api(path,opt){const r=await fetch(path,opt);const d=await r.json();if(!r.ok||d.error)throw new Error(d.error||("HTTP "+r.status));return d}

async function go(lat,lon,label){
  here={lat,lon};center={lat,lon};np={};selected=null;
  $("where").innerHTML="Looking up stations near "+esc(label||"you")+"…";
  $("grid").innerHTML='<div class="msg">Asking the FCC which towers are nearby…</div>';
  try{
    const d=await api("/api/nearby?lat="+lat+"&lon="+lon);
    stations=d.stations;compute();
    if(!label)label=(await api("/api/reverse?lat="+lat+"&lon="+lon)).label;
    const n=stations.filter(s=>s.sig.bars>0).length;
    $("where").innerHTML=esc(n)+" stations you can hear near <b>"+esc(label)+'</b> · <a href="/austin">Austin live board + song log</a>';
    try{localStorage.setItem("rnm-last",JSON.stringify({lat,lon,label}))}catch(e){}
    render();drawMap();loadPlaying();
  }catch(e){$("grid").innerHTML='<div class="msg">'+esc(e.message)+'</div>';$("where").textContent="Something went wrong."}
}

async function loadPlaying(){
  clearTimeout(npTimer);
  const want=stations.filter(s=>s.sig.bars>0&&!s.blockedBy).slice(0,48);
  const batches=[];for(let i=0;i<want.length;i+=8)batches.push(want.slice(i,i+8));
  await Promise.all(batches.map(async b=>{
    try{const d=await api("/api/playing",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(b.map(s=>({call:s.call,freq:s.freq,city:s.city,serv:s.serv,licensee:s.licensee})))});
      for(const r of d)np[r.call+"|"+r.freq]=r;render()}catch(e){}
  }));
  npTimer=setTimeout(loadPlaying,60000);
}

// ---------- Map ----------
function color(s){return css(s.sig.c)}
function drawMap(){
  if(!map||!here)return;
  layers.clearLayers();
  meLayer.setLatLng([here.lat,here.lon]);
  for(const s of stations){if(!$("showFar").checked&&s.sig.bars===0)continue;
    L.circleMarker([s.lat,s.lon],{radius:7,color:"#fff",weight:2,fillColor:color(s),fillOpacity:1}).addTo(layers)
     .bindTooltip(s.freq+" "+s.call).on("click",()=>select(s))}
  drawZones();
}
function ring(s,mult,c,dash){return L.circle([s.lat,s.lon],{radius:d60(s)*mult*1000,color:c,weight:2,fill:!dash,fillOpacity:.06,dashArray:dash?"6 6":null})}
function drawZones(){
  if(!map||!selected)return;
  const s=selected,g=signal(s);
  if($("zones").checked){
    [[1.8,"--s1"],[1.35,"--s2"],[1,"--s3"],[.6,"--s4"]].forEach(([m,c])=>ring(s,m,css(c)).addTo(layers));
  }
  if($("handoff").checked){
    for(const o of stations){
      if(o===s||o.freq!==s.freq)continue;
      ring(o,1,css("--s0"),true).addTo(layers).bindTooltip(o.call+" (also "+o.freq+")");
      const a=d60(s),b=d60(o),t=a/(a+b);
      const lat=s.lat+(o.lat-s.lat)*t,lon=s.lon+(o.lon-s.lon)*t;
      L.marker([lat,lon]).addTo(layers).bindPopup("Around here "+s.freq+" switches from "+s.call+" to "+o.call);
    }
  }
  const mi=m=>(d60(s)*m*KM_MI).toFixed(0);
  $("selInfo").innerHTML="<b>"+esc(s.freq+" "+s.call)+"</b> ("+esc(s.city)+"): strong out to about "+mi(.6)+" mi, good to "+mi(1)+" mi, weak to "+mi(1.35)+" mi, gone past about "+mi(1.8)+" mi. Here: "+esc(g.label)+", "+(g.d*KM_MI).toFixed(0)+" mi from the tower.";
}
function select(s){selected=s;if(!$("zones").checked)$("zones").checked=true;$("adv").open=true;drawMap()}
function initMap(){
  if(map)return;
  map=L.map("map");L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:18,attribution:"&copy; OpenStreetMap"}).addTo(map);
  layers=L.layerGroup().addTo(map);
  meLayer=L.circleMarker([0,0],{radius:9,color:"#fff",weight:3,fillColor:css("--acc"),fillOpacity:1}).addTo(map).bindTooltip("You");
  map.setView(here?[here.lat,here.lon]:[30.27,-97.74],9);drawMap();
}

function show(v){$("vList").hidden=v!=="list";$("vMap").hidden=v!=="map";$("tList").setAttribute("aria-pressed",v==="list");$("tMap").setAttribute("aria-pressed",v==="map");
  if(v==="map"){initMap();setTimeout(()=>{map.invalidateSize();if(here)map.panTo([here.lat,here.lon])},50)}}

// ---------- Events ----------
$("f").onsubmit=async e=>{e.preventDefault();const q=$("q").value.trim();if(!q)return;
  $("where").textContent="Finding "+q+"…";
  try{const p=await api("/api/geocode?q="+encodeURIComponent(q));go(p.lat,p.lon,p.label);if(map)map.setView([p.lat,p.lon],9)}catch(e){$("where").textContent=e.message}};
$("loc").onclick=()=>{if(!navigator.geolocation){$("where").textContent="This browser can't share your location. Type a place instead.";return}
  $("where").textContent="Getting your location…";
  navigator.geolocation.getCurrentPosition(p=>{go(p.coords.latitude,p.coords.longitude);if(map)map.setView([p.coords.latitude,p.coords.longitude],9)},
    ()=>{$("where").textContent="Location was blocked. Allow it in your browser settings, or type a place."},{enableHighAccuracy:false,timeout:15000})};
$("chips").onclick=e=>{const b=e.target.closest(".chip");if(b){genre=b.dataset.g;render()}};
$("grid").onclick=e=>{const b=e.target.closest(".zbtn");if(!b)return;const s=stations.find(x=>key(x)===b.dataset.k);if(s){show("map");select(s);map.setView([s.lat,s.lon],8)}};
$("showFar").onchange=()=>{render();drawMap()};
$("zones").onchange=drawMap;$("handoff").onchange=drawMap;
$("tList").onclick=()=>show("list");$("tMap").onclick=()=>show("map");
$("follow").onchange=()=>{
  if(!$("follow").checked){if(watchId!=null)navigator.geolocation.clearWatch(watchId);watchId=null;return}
  if(!navigator.geolocation){$("follow").checked=false;return}
  watchId=navigator.geolocation.watchPosition(p=>{
    const lat=p.coords.latitude,lon=p.coords.longitude;
    if(!center||hav(center.lat,center.lon,lat,lon)>60){go(lat,lon);return}  // moved far: look up new towers
    for(const s of stations)s.prevR=s.sig?.r;
    here={lat,lon};compute();render();drawMap();if(map)map.panTo([lat,lon]);
  },()=>{$("follow").checked=false},{enableHighAccuracy:true,maximumAge:10000});
};

// Start where you left off
try{const last=JSON.parse(localStorage.getItem("rnm-last")||"null");if(last){$("q").value=last.label||"";go(last.lat,last.lon,last.label)}}catch(e){}
}
</script></body></html>`;
