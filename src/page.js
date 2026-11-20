// The radio sheet (served at /). A spreadsheet-style page with three sheet
// tabs: Stations, Map and Austin log. __AUSTIN__ is filled in by the worker.
export const PAGE = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Radio Near Me</title>
<meta name="theme-color" content="#ffffff"><meta name="color-scheme" content="light">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
:root{color-scheme:light;--xl:#217346;--xl2:#185c37;--grid:#d4d4d4;--head:#f3f3f3;--ink:#1f1f1f;--mute:#616161;--sel:#e8f2ec;
--song:#e2efda;--songT:#1e6b34;--ad:#fce4d6;--adT:#9c4a12;--no:#f2f2f2;--noT:#7a7a7a;--s4:#1e8a4c;--s3:#6aa632;--s2:#d9a400;--s1:#d0582a;--s0:#a6a6a6}
*{box-sizing:border-box;min-width:0}html,body{margin:0;background:#fff;color:var(--ink);font:14px/1.4 "Segoe UI",system-ui,-apple-system,Roboto,sans-serif}
body{padding-bottom:84px}
.title{padding:18px 14px 4px;max-width:1100px;margin:auto}
.title b{display:block;font-size:28px;font-weight:800;letter-spacing:-.02em;line-height:1.1}.title span{display:block;font-size:13px;color:var(--mute);margin-top:4px}
.tools{padding:8px 14px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;max-width:1100px;margin:auto}
.list{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:8px;padding:6px 14px 10px;max-width:1100px;margin:auto}
.b{border:1px solid #e6e8ec!important;display:grid;grid-template-columns:64px minmax(0,1fr) auto;align-items:stretch;gap:10px;padding:6px;border-radius:14px;background:#fff;box-shadow:0 1px 2px rgba(16,24,40,.08),0 1px 6px rgba(16,24,40,.06);cursor:pointer;border:2px solid transparent;--g:#9aa3ad}
.b.on{border-color:var(--g)!important;box-shadow:0 0 0 2px var(--g)}.b.far{opacity:.6}
.b .f{background:var(--g);color:#fff;border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:4px 2px;min-height:58px}
.b .f b{font-size:21px;font-weight:800;line-height:1;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.b .f small{font-size:9.5px;opacity:.85;margin-top:3px;letter-spacing:.03em}
.b .m{overflow:hidden;display:flex;flex-direction:column;justify-content:center;gap:1px}
.gtag{align-self:flex-start;font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;padding:2px 8px;border-radius:99px;background:color-mix(in srgb,var(--g) 16%,#fff);color:color-mix(in srgb,var(--g) 80%,#000);white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}
.b .t{font-weight:750;font-size:16px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#111}
.b .t.dim{font-weight:600;font-size:14px;color:var(--mute)}
.b .a{font-size:12.5px;color:#4b5563;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.b .a i{font-style:normal;color:#9aa3ad;font-size:11px}
.b .r{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding-right:2px}
.b .play{width:38px;height:38px;border-radius:50%;border:0;background:color-mix(in srgb,var(--g) 14%,#fff);color:color-mix(in srgb,var(--g) 85%,#000);font-size:13px}
.b.playing .play{background:var(--g);color:#fff}
.sec{grid-column:1/-1;font-size:12px;font-weight:600;color:var(--mute);padding:8px 2px 0}
.msg{grid-column:1/-1;padding:14px;color:var(--mute)}
.tools input[type=search],.tools select{font:inherit;font-size:16px;height:42px;padding:0 14px;border:1px solid #dde1e6;border-radius:12px;background:#fff;color:var(--ink)}
.tools input[type=search]{flex:1 1 180px}
button{font:inherit;height:42px;padding:0 14px;border:1px solid #dde1e6;border-radius:12px;background:#fff;color:var(--ink);cursor:pointer}
button.go{background:var(--xl);border-color:var(--xl);color:#fff;font-weight:600}
.tog{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 12px;border:1px solid #dde1e6;border-radius:99px;background:#fff;font-size:13px;cursor:pointer}
.tog input{width:18px;height:18px;accent-color:var(--xl);margin:0}
.fx{display:flex;align-items:center;border-bottom:1px solid var(--grid);font-size:13px;min-height:32px}
.fx i{font-style:italic;font-family:Georgia,serif;color:var(--mute);padding:0 10px;border-right:1px solid var(--grid);align-self:stretch;display:flex;align-items:center}
.fx div{padding:4px 10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wrap{overflow:auto;max-height:calc(100vh - 230px);min-height:240px}
table{border-collapse:separate;border-spacing:0;font-size:13px;width:max-content;min-width:100%}
th,td{border-right:1px solid var(--grid);border-bottom:1px solid var(--grid);padding:5px 8px;white-space:nowrap;text-align:left;background:#fff;height:30px}
thead th{background:var(--head);font-weight:600;position:sticky;z-index:2}
thead tr.letters th{top:0;color:var(--mute);font-weight:400;text-align:center;font-size:12px;height:22px;padding:2px 8px}
thead tr.names th{top:22px}
.rn{background:var(--head)!important;color:var(--mute);text-align:center;position:sticky;left:0;z-index:1;width:36px;font-size:12px}
.pl{position:sticky;left:36px;z-index:1;width:44px;text-align:center;padding:2px}
.fm{position:sticky;left:80px;z-index:1;font-weight:700;width:56px;text-align:right;border-right:2px solid #bdbdbd}
thead .rn,thead .pl,thead .fm{z-index:3}
tbody tr:hover td{background:#f7fbf8}tbody tr.on td{background:var(--sel)}tbody tr.on .rn{background:#d3e7da!important;color:var(--xl2)}
td.num{text-align:right;font-variant-numeric:tabular-nums}
.st{font-weight:600;font-size:12px}.st.SONG{background:var(--song);color:var(--songT)}.st.AD{background:var(--ad);color:var(--adT)}.st.NO{background:var(--no);color:var(--noT)}
.song{font-weight:600;max-width:240px;overflow:hidden;text-overflow:ellipsis}.art{max-width:200px;overflow:hidden;text-overflow:ellipsis}
.muted{color:var(--mute)}
.bars{display:inline-flex;align-items:flex-end;gap:2px;height:13px;margin-right:6px;vertical-align:-1px}.bars i{width:4px;background:#ddd}
.bars i:nth-child(1){height:4px}.bars i:nth-child(2){height:7px}.bars i:nth-child(3){height:10px}.bars i:nth-child(4){height:13px}
.play{width:34px;height:26px;padding:0;border-radius:4px;border:1px solid #c8c8c8;background:#fff;color:var(--xl);font-size:12px}
tr.playing .play{background:var(--xl);color:#fff;border-color:var(--xl)}
.empty td{color:var(--mute);height:60px;white-space:normal}
.sheet{display:none}.sheet.show{display:block}
#map{height:calc(100vh - 290px);min-height:320px;border-bottom:1px solid var(--grid)}
.pane{padding:10px 12px;font-size:13px}.pane label{display:flex;align-items:center;gap:8px;min-height:36px}.pane input{width:18px;height:18px;accent-color:var(--xl)}
.legend{display:flex;gap:12px;flex-wrap:wrap;font-size:12px;margin:6px 0}.legend span::before{content:"";display:inline-block;width:11px;height:11px;border-radius:50%;margin-right:5px;vertical-align:-1px;background:var(--c)}
.note{color:var(--mute);font-size:12px;padding:10px 12px}
.player{position:fixed;left:0;right:0;bottom:0;background:#fff;border-top:2px solid var(--xl);display:none;align-items:center;gap:10px;padding:6px 10px;z-index:1000;box-shadow:0 -2px 8px rgba(0,0,0,.08)}
.player.show{display:flex}.player .what{flex:1;font-size:13px;overflow:hidden}.player .what b{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.player .what span{color:var(--mute);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block}
.player button{height:36px}
.tabs{display:flex;gap:8px;padding:4px 14px 8px;max-width:1100px;margin:auto}
.tabs button{border-radius:99px;font-weight:600;height:38px}
.tabs button[aria-selected=true]{background:#111;color:#fff;border-color:#111}
.logl{display:flex;flex-direction:column;gap:6px;padding:6px 14px 10px;max-width:1100px;margin:auto}
.lr{display:grid;grid-template-columns:62px 52px minmax(0,1fr);gap:10px;align-items:center;padding:8px 10px;border:1px solid #e6e8ec;border-left:4px solid var(--g,#9aa3ad);border-radius:10px;background:#fff}
.lr .tm{font-size:12px;color:var(--mute)}.lr .fq{font-weight:800}.lr .t{font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lr .a{font-size:12.5px;color:var(--mute);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
a{color:var(--xl)}
</style></head><body>
<div class="title"><b>Radio near me</b><span id="where">Loading…</span></div>
<form class="tools" id="f">
<input type="search" id="q" placeholder="City, ZIP or address" autocomplete="off" enterkeyhint="search">
<button class="go" type="submit">Find</button><button type="button" id="loc">Use my location</button>
<label class="tog"><input type="checkbox" id="musicOnly"> Music only</label>
<label class="tog"><input type="checkbox" id="showFar"> Weak & far</label>
<select id="genre" aria-label="Genre"><option value="">All genres</option></select>
<span class="muted" id="count"></span>
</form>
<nav class="tabs" role="tablist"><button role="tab" data-s="sStations" aria-selected="true">Stations</button><button role="tab" data-s="sMap" aria-selected="false">Map</button><button role="tab" data-s="sLog" aria-selected="false">Song log</button></nav>
<section class="sheet show" id="sStations">
<div class="list" id="rows"><div class="msg">Loading stations…</div></div>
<p class="note">The colored tile shows the type of music playing; tan means an ad, DJ or news break; gray means no info. Signal bars are an estimate from each tower's power and height in FCC records; hills, buildings and weather change it. Song info comes from iHeartRadio, the stations' own streams and TuneIn; genres from Apple's music catalog. Something look wrong? Open /debug?freq=95.5 (any frequency) and send a screenshot.</p>
</section>

<section class="sheet" id="sMap">
<div id="map"></div>
<div class="pane">
<div class="legend"><span style="--c:var(--s4)">Strong</span><span style="--c:var(--s3)">Good</span><span style="--c:var(--s2)">Weak</span><span style="--c:var(--s1)">Fading / static</span><span style="--c:var(--s0)">Can't hear</span></div>
<b>Advanced: signal zones</b>
<label><input type="checkbox" id="zones"> Show zones for the selected station (tap a tower or a row)</label>
<label><input type="checkbox" id="handoff"> Show where the same frequency turns into another station</label>
<label><input type="checkbox" id="follow"> Follow me while driving</label>
<div class="muted" id="selInfo">No station selected.</div></div>
</section>

<section class="sheet" id="sLog">
<div class="tools"><select id="logSt" aria-label="Station"><option value="">All Austin stations</option></select>
<label class="tog"><input type="checkbox" id="logMusic"> Songs only</label>
<a id="dl" href="/log.csv"><button type="button">Download CSV</button></a><span class="muted">Every song the Austin / San Marcos stations played, saved all day</span></div>
<div class="logl" id="logRows"></div>
</section>

<div class="player" id="player"><button id="pBtn" aria-label="Play or pause">❚❚</button><div class="what"><b id="pName"></b><span id="pNow"></span></div><button id="pStop">Stop</button></div>

<audio id="audio" preload="none"></audio>

<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
{
const AUSTIN=__AUSTIN__;
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const MI=0.621371,DEF={lat:29.8833,lon:-97.9414,label:"San Marcos, TX"};
const LV=[{max:.6,label:"Strong",bars:4,c:"--s4"},{max:1,label:"Good",bars:3,c:"--s3"},{max:1.35,label:"Weak",bars:2,c:"--s2"},{max:1.8,label:"Fading / static",bars:1,c:"--s1"}];
const css=v=>getComputedStyle(document.documentElement).getPropertyValue(v).trim();
let here=null,center=null,stations=[],np={},sel=null,map=null,layers=null,me=null,watchId=null,npTimer=null,playingKey=null;
const key=s=>s.call+"|"+s.freq;
const cls=st=>st==="SONG"?"SONG":st&&st.startsWith("AD")?"AD":"NO";

// Rough distance (km) where a station is "good" (about the FCC 60 dBu line), from power (kW) and antenna height (m)
const d60=s=>3.6*Math.pow(Math.max(s.erp,.01),.232)*Math.pow(Math.max(s.haat,20),.352);
function hav(a,b,c,d){const t=x=>x*Math.PI/180,h=Math.sin(t(c-a)/2)**2+Math.cos(t(a))*Math.cos(t(c))*Math.sin(t(d-b)/2)**2;return 12742*Math.asin(Math.sqrt(h))}
function signal(s){const d=hav(here.lat,here.lon,s.lat,s.lon),r=d/d60(s);return {...(LV.find(x=>r<=x.max)||{label:"Can't hear",bars:0,c:"--s0"}),d,r}}
function compute(){
  for(const s of stations){s.sig=signal(s);s.blockedBy=null}
  const byF={};for(const s of stations)(byF[s.freq]=byF[s.freq]||[]).push(s);
  for(const l of Object.values(byF)){l.sort((a,b)=>a.sig.r-b.sig.r);for(const s of l.slice(1))if(s.sig.bars>0)s.blockedBy=l[0]}
}
async function api(path,body){const r=await fetch(path,body?{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)}:{});const d=await r.json();if(!r.ok||d.error)throw new Error(d.error||("HTTP "+r.status));return d}

// ---------- Stations sheet ----------
function visible(){
  const far=$("showFar").checked,mo=$("musicOnly").checked,g=$("genre").value;
  return stations.filter(s=>{const n=np[key(s)];
    if(!far&&s.sig.bars===0&&s.sig.r>2.3)return false;
    if(mo&&n?.status!=="SONG")return false;
    if(g&&n?.genre!==g)return false;return true});
}
function render(){
  if(!here)return;
  const gs=[...new Set(Object.values(np).map(n=>n.genre).filter(Boolean))].sort(),cur=$("genre").value;
  $("genre").innerHTML='<option value="">All genres</option>'+gs.map(g=>'<option value="'+esc(g)+'"'+(g===cur?" selected":"")+'>'+esc(genreInfo(g).label)+'</option>').join("");
  const list=visible(),hear=list.filter(s=>s.sig.bars>0),far=list.filter(s=>s.sig.bars===0);
  $("count").textContent=list.length+" shown";
  $("rows").innerHTML=list.length?hear.map(bubble).join("")+(far.length?'<div class="sec">Probably too far to hear</div>'+far.map(bubble).join(""):""):
    '<div class="msg">'+($("musicOnly").checked?"No music found right now. Turn off “Music only” to see everything.":"No stations match.")+'</div>';
}
const GENRE=[[/holiday|christmas/i,"#c8102e","Christmas"],[/pop/i,"#e0457b"],[/country/i,"#c27a12"],[/hip-hop|rap/i,"#7b3fe4"],[/r&b|soul/i,"#a23b72"],[/latin|mexican|tejano|reggaeton/i,"#e8590c"],
 [/alternative|indie/i,"#0f8b8d"],[/rock|metal/i,"#3f4a5a"],[/christian|gospel/i,"#1c7ed6"],[/classical|soundtrack/i,"#8c6d46"],[/dance|electronic/i,"#0ca5c9"],[/jazz|blues/i,"#364fc7"],[/singer|folk|americana/i,"#5c940d"]];
function genreInfo(g){for(const [re,c,label] of GENRE)if(re.test(g))return {c,label:label||g};return {c:"#217346",label:g}}
function bubble(s){
  const n=np[key(s)],g=s.sig,k=key(s);
  const bars='<span class="bars" title="'+esc(g.label)+'">'+[1,2,3,4].map(b=>'<i style="background:'+(b<=g.bars?"var("+g.c+")":"")+'"></i>').join("")+'</span>';
  const name=n?.stationName||s.call;
  let color="#9aa3ad",tag="",t,a;
  if(!n){t='<div class="t dim">Checking…</div>';a='<i>'+esc(name)+'</i>'}
  else if(n.status==="SONG"){const gi=n.genre?genreInfo(n.genre):{c:"#217346",label:"Music"};color=gi.c;tag=gi.label;
    t='<div class="t">'+esc(n.title)+'</div>';a=esc(n.artist)+' <i>· '+esc(name)+'</i>'}
  else if(n.status==="NO DATA"){tag="No info";t='<div class="t dim">No song info</div>';a='<i>'+esc(name)+'</i>'}
  else{color="#b08968";tag="Ad / DJ / news";t='<div class="t dim">Break, back soon</div>';a='<i>'+esc(name)+'</i>'}
  return '<div class="b'+(sel&&key(sel)===k?" on":"")+(playingKey===k?" playing":"")+(g.bars===0?" far":"")+'" data-k="'+esc(k)+'" style="--g:'+color+'">'+
    '<div class="f"><b>'+esc(s.freq)+'</b><small>'+esc(s.call.replace(/-FM$/,""))+'</small></div>'+
    '<div class="m">'+(tag?'<span class="gtag">'+esc(tag)+'</span>':'')+t+'<div class="a">'+a+(s.blockedBy?' <i>· blocked by '+esc(s.blockedBy.call)+'</i>':'')+'</div></div>'+
    '<div class="r"><button class="play" data-play="'+esc(k)+'" aria-label="Listen to '+esc(s.freq)+'">'+(playingKey===k?"■":"▶")+'</button>'+bars+'</div></div>';
}
function setFx(){}
async function go(lat,lon,label){
  here={lat,lon};center={lat,lon};np={};sel=null;stations=[];
  $("where").textContent="Finding stations near "+(label||"you")+"…";
  $("rows").innerHTML='<div class="msg">Asking the FCC which towers are nearby…</div>';
  try{
    stations=(await api("/api/nearby?lat="+lat+"&lon="+lon)).stations;compute();
    if(!label)label=(await api("/api/reverse?lat="+lat+"&lon="+lon)).label;
    $("where").textContent=stations.filter(s=>s.sig.bars>0).length+" stations you can hear near "+label;
    try{localStorage.setItem("rs-last",JSON.stringify({lat,lon,label}))}catch(e){}
    render();drawMap();loadPlaying();
  }catch(e){$("rows").innerHTML='<div class="msg">'+esc(e.message)+'</div>';$("where").textContent="Something went wrong"}
}
async function loadPlaying(){
  clearTimeout(npTimer);
  const want=stations.filter(s=>s.sig.r<=2.3&&!s.blockedBy).sort((a,b)=>a.sig.r-b.sig.r).slice(0,42),b=[];
  for(let i=0;i<want.length;i+=4)b.push(want.slice(i,i+4));
  await Promise.all(b.map(async g=>{try{const d=await api("/api/playing",g.map(info));for(const r of d)np[r.call+"|"+r.freq]=r;render();if(sel)setFx(sel)}catch(e){}}));
  npTimer=setTimeout(loadPlaying,60000);
}
function info(s){const a=AUSTIN.find(x=>x.freq===s.freq&&s.call.startsWith(x.call.split("-")[0]));return {call:s.call,freq:s.freq,city:s.city,serv:s.serv,licensee:s.licensee,...(a?{tunein:a.tunein,iheart:a.iheart,icy:a.icy}:{})}}

// ---------- Player ----------
const audio=$("audio");let hls=null;
function stopAudio(){audio.pause();audio.removeAttribute("src");audio.load();if(hls){hls.destroy();hls=null}playingKey=null;$("player").classList.remove("show");render()}
async function playStation(s){
  const k=key(s);if(playingKey===k){stopAudio();return}
  stopAudio();playingKey=k;render();
  const n=np[k];$("pName").textContent=s.freq+" "+(n?.stationName||s.call);$("pNow").textContent="Connecting…";$("pBtn").textContent="❚❚";$("player").classList.add("show");
  let streams=[];try{streams=(await api("/api/listen",info(s))).streams}catch(e){}
  for(const x of streams){
    if(playingKey!==k)return;
    try{
      if(x.hls&&!audio.canPlayType("application/vnd.apple.mpegurl")){
        if(!window.Hls)await new Promise((ok,no)=>{const sc=document.createElement("script");sc.src="https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js";sc.onload=ok;sc.onerror=no;document.head.appendChild(sc)});
        hls=new Hls();hls.loadSource(x.url);hls.attachMedia(audio);
      } else audio.src=x.url;
      await Promise.race([audio.play(),new Promise((_,no)=>setTimeout(()=>no(new Error("timeout")),12000))]);
      updatePlayer();return;
    }catch(e){
      if(e&&e.name==="NotAllowedError"){$("pNow").textContent="Tap ▶ to start";$("pBtn").textContent="▶";return}
      if(hls){hls.destroy();hls=null}
    }
  }
  if(playingKey===k)$("pNow").textContent="This station's stream can't play here.";
}
function updatePlayer(){if(!playingKey)return;const n=np[playingKey];$("pNow").textContent=n?(n.status==="SONG"?n.title+" — "+n.artist:n.status):"Live";$("pBtn").textContent=audio.paused?"▶":"❚❚"}
$("pBtn").onclick=()=>{if(audio.paused)audio.play().then(updatePlayer).catch(()=>{});else{audio.pause();updatePlayer()}};
$("pStop").onclick=stopAudio;
setInterval(updatePlayer,5000);

// ---------- Map ----------
function drawMap(){
  if(!map||!here||!window.L)return;
  layers.clearLayers();me.setLatLng([here.lat,here.lon]);
  for(const s of stations){if(!$("showFar").checked&&s.sig.bars===0)continue;
    L.circleMarker([s.lat,s.lon],{radius:7,color:"#fff",weight:2,fillColor:css(s.sig.c),fillOpacity:1}).addTo(layers).bindTooltip(s.freq+" "+s.call).on("click",()=>select(s,true))}
  if(!sel)return;
  const ring=(s,m,c,dash)=>L.circle([s.lat,s.lon],{radius:d60(s)*m*1000,color:c,weight:2,fill:!dash,fillOpacity:.05,dashArray:dash?"6 6":null});
  if($("zones").checked)[[1.8,"--s1"],[1.35,"--s2"],[1,"--s3"],[.6,"--s4"]].forEach(([m,c])=>ring(sel,m,css(c)).addTo(layers));
  if($("handoff").checked)for(const o of stations){if(o===sel||o.freq!==sel.freq)continue;
    ring(o,1,css("--s0"),true).addTo(layers).bindTooltip(o.call+" (also "+o.freq+")");
    const a=d60(sel),b=d60(o),t=a/(a+b);L.marker([sel.lat+(o.lat-sel.lat)*t,sel.lon+(o.lon-sel.lon)*t]).addTo(layers).bindPopup("Around here "+sel.freq+" switches from "+sel.call+" to "+o.call)}
  const m=x=>(d60(sel)*x*MI).toFixed(0);
  $("selInfo").textContent=sel.freq+" "+sel.call+" ("+sel.city+"): strong to about "+m(.6)+" mi, good to "+m(1)+" mi, weak to "+m(1.35)+" mi, gone past about "+m(1.8)+" mi. Where you are: "+sel.sig.label+", "+(sel.sig.d*MI).toFixed(0)+" mi from the tower.";
}
function select(s,fromMap){sel=s;setFx(s);render();if(fromMap&&!$("zones").checked)$("zones").checked=true;drawMap()}
function initMap(){
  if(map||!window.L)return;
  map=L.map("map");L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:18,attribution:"&copy; OpenStreetMap"}).addTo(map);
  layers=L.layerGroup().addTo(map);me=L.circleMarker([0,0],{radius:9,color:"#fff",weight:3,fillColor:"#217346",fillOpacity:1}).addTo(map).bindTooltip("You");
  map.setView(here?[here.lat,here.lon]:[DEF.lat,DEF.lon],9);drawMap();
}

// ---------- Austin log sheet ----------
$("logSt").innerHTML+=AUSTIN.map(a=>'<option value="'+esc(a.freq)+'">'+esc(a.freq+" "+a.name)+'</option>').join("");
async function loadLog(){
  const f=$("logSt").value;$("dl").href="/log.csv"+(f?"?freq="+encodeURIComponent(f):"");
  try{let rows=await api("/api/log?limit=400"+(f?"&freq="+encodeURIComponent(f):""));
    if($("logMusic").checked)rows=rows.filter(r=>r.status==="SONG");
    const tm=t=>new Date(t*1000).toLocaleString([], {hour:"numeric",minute:"2-digit"});
    $("logRows").innerHTML=rows.length?rows.map(r=>'<div class="lr" style="--g:'+(r.status==="SONG"?"#217346":r.status==="NO DATA"?"#9aa3ad":"#b08968")+'"><span class="tm">'+esc(tm(r.t))+'</span><span class="fq">'+esc(r.freq)+'</span><div><div class="t">'+esc(r.status==="SONG"?r.title:"Ad / DJ / news")+'</div><div class="a">'+esc(r.status==="SONG"?r.artist+" · ":"")+esc(r.station)+'</div></div></div>').join(""):'<div class="msg">Nothing logged yet. It fills in every few minutes.</div>';
  }catch(e){$("logRows").innerHTML='<div class="msg">'+esc(e.message)+'</div>'}
}

// ---------- Tabs & events ----------
function tab(id){document.querySelectorAll(".sheet").forEach(x=>x.classList.toggle("show",x.id===id));
  document.querySelectorAll("nav.tabs button").forEach(b=>b.setAttribute("aria-selected",b.dataset.s===id));
  $("f").style.display=id==="sLog"?"none":"";
  if(id==="sMap"){initMap();setTimeout(()=>{if(map){map.invalidateSize();if(here)map.panTo([here.lat,here.lon])}},50)}
  if(id==="sLog")loadLog();
  try{history.replaceState(null,"",id==="sLog"?"#log":id==="sMap"?"#map":"#")}catch(e){}}
document.querySelector("nav.tabs").onclick=e=>{const b=e.target.closest("button");if(b)tab(b.dataset.s)};
$("rows").onclick=e=>{const tr=e.target.closest(".b[data-k]");if(!tr)return;const s=stations.find(x=>key(x)===tr.dataset.k);if(!s)return;
  if(e.target.closest("[data-play]"))playStation(s);else select(s)};
$("f").onsubmit=async e=>{e.preventDefault();const q=$("q").value.trim();if(!q)return;$("where").textContent="Finding "+q+"…";
  try{const p=await api("/api/geocode?q="+encodeURIComponent(q));go(p.lat,p.lon,p.label);if(map)map.setView([p.lat,p.lon],9)}catch(e){$("where").textContent=e.message}};
$("loc").onclick=()=>{if(!navigator.geolocation){$("where").textContent="This browser can't share your location";return}
  $("where").textContent="Getting your location…";
  navigator.geolocation.getCurrentPosition(p=>{$("q").value="";go(p.coords.latitude,p.coords.longitude);if(map)map.setView([p.coords.latitude,p.coords.longitude],9)},
    ()=>{$("where").textContent="Location blocked. Allow it in your browser settings, or type a place."},{timeout:15000})};
for(const id of ["musicOnly","showFar","genre"])$(id).onchange=()=>{render();if(id==="showFar")drawMap()};
$("zones").onchange=drawMap;$("handoff").onchange=drawMap;$("logSt").onchange=loadLog;$("logMusic").onchange=loadLog;
$("follow").onchange=()=>{
  if(!$("follow").checked){if(watchId!=null)navigator.geolocation.clearWatch(watchId);watchId=null;return}
  if(!navigator.geolocation){$("follow").checked=false;return}
  watchId=navigator.geolocation.watchPosition(p=>{const lat=p.coords.latitude,lon=p.coords.longitude;
    if(!center||hav(center.lat,center.lon,lat,lon)>60){go(lat,lon);return}
    here={lat,lon};compute();render();drawMap();if(map)map.panTo([lat,lon])},()=>{$("follow").checked=false},{enableHighAccuracy:true,maximumAge:10000})};
try{const m=JSON.parse(localStorage.getItem("rs-last")||"null");if(m&&m.lat){$("q").value=m.label||"";go(m.lat,m.lon,m.label)}else{$("q").value=DEF.label;go(DEF.lat,DEF.lon,DEF.label)}}catch(e){go(DEF.lat,DEF.lon,DEF.label)}
const h=location.hash;if(h==="#log")tab("sLog");else if(h==="#map")tab("sMap");
}
</script></body></html>`;
