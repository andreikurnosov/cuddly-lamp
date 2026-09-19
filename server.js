import http from "node:http";
import https from "node:https";

const PORT = Number(process.env.PORT || 8080);
const API = "https://radio-t.com/site-api";
const RSS_SOURCES = [
  "https://radio-t.com/podcast.rss",
  "https://feeds.rucast.net/radio-t"
];

const page = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#111318">
<title>Радио-Т</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#0d0f13;color:#f5f5f5;font:16px/1.45 system-ui,-apple-system,sans-serif;padding-bottom:120px}header{position:sticky;top:0;z-index:3;background:#111318ef;border-bottom:1px solid #292d35;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;backdrop-filter:blur(12px)}h1{font-size:21px;margin:0}.sub{color:#9ca3af;font-size:13px}.wrap{max-width:820px;margin:auto;padding:22px 16px}.search{display:flex;gap:10px;margin:8px 0 20px}.search input{flex:1;background:#171a20;border:1px solid #30343d;color:white;border-radius:13px;padding:13px 15px;font-size:16px}.btn{border:0;border-radius:12px;background:#ff7a18;color:#151515;font-weight:700;padding:11px 14px;cursor:pointer}.episode{background:#15181e;border:1px solid #272b33;border-radius:16px;padding:16px;margin:10px 0}.episode h2{font-size:18px;margin:0 0 6px}.meta{color:#9ca3af;font-size:13px;margin-bottom:10px}.desc{color:#c7cbd1;font-size:14px}.player{position:fixed;left:0;right:0;bottom:0;background:#111318f5;border-top:1px solid #30343d;padding:12px 14px;backdrop-filter:blur(14px)}.player-inner{max-width:820px;margin:auto}.title{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:8px}.controls{display:flex;align-items:center;gap:10px}.controls button{min-width:54px}.controls input{flex:1}.speed{background:#20242b;color:white;border:1px solid #353a44;border-radius:10px;padding:8px}.status{color:#9ca3af;padding:14px 0}.error{color:#ff9d9d}
</style>
</head>
<body>
<header><div><h1>Радио-Т</h1><div class="sub">неофициальный веб-плеер</div></div><a href="https://radio-t.com/" target="_blank" rel="noreferrer" style="color:#ff7a18">radio-t.com ↗</a></header>
<main class="wrap">
<div class="search"><input id="q" placeholder="Поиск по выпускам…"><button class="btn" id="reload">Обновить</button></div>
<div id="status" class="status">Загрузка выпусков…</div><div id="list"></div>
</main>
<div class="player" id="player" hidden><div class="player-inner"><div class="title" id="pt">Радио-Т</div><div class="controls"><button class="btn" id="back">−30</button><button class="btn" id="play">▶</button><button class="btn" id="fwd">+30</button><input id="seek" type="range" min="0" max="1000" value="0"><select id="speed" class="speed"><option>0.8</option><option selected>1</option><option>1.2</option><option>1.5</option><option>1.75</option><option>2</option></select></div></div></div>
<audio id="audio"></audio>
<script>
const $=s=>document.querySelector(s), list=$("#list"), status=$("#status"), audio=$("#audio"), player=$("#player"), pt=$("#pt"), play=$("#play"), seek=$("#seek");
let current=null, allItems=[];
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]));
function id(e){return String(e.num||e.id||e.url||e.title)}
function progress(){try{return JSON.parse(localStorage.rtProgress||"{}")}catch{return {}}}
function save(){if(!current||!audio.duration)return;const p=progress();p[id(current)]={position:audio.currentTime,duration:audio.duration};localStorage.rtProgress=JSON.stringify(p)}
function date(v){try{return new Intl.DateTimeFormat("ru-RU",{dateStyle:"medium"}).format(new Date(v))}catch{return ""}}
function plain(s){return String(s||"").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim()}
function filterItems(){
  const q=$("#q").value.trim().toLowerCase();
  const items=!q?allItems:allItems.filter(e=>((e.title||"")+" "+plain(e.body||e.description||e.show_notes||"")).toLowerCase().includes(q));
  render(items);
  status.textContent=items.length?"":"Ничего не найдено";
}
async function load(){
  status.className="status";
  status.textContent="Загрузка…";
  try{
    const r=await fetch("/api/episodes?limit=70",{cache:"no-store"});
    if(!r.ok)throw Error("HTTP "+r.status);
    let data=await r.json();
    if(!Array.isArray(data))data=data.posts||data.items||data.podcasts||[];
    allItems=data;
    filterItems();
    if(data.length)status.textContent="";
  }catch(e){
    console.error(e);
    status.className="status error";
    status.textContent="Не удалось загрузить выпуски";
  }
}
function render(items){
  list.innerHTML=items.map(function(e,i){
    return '<article class="episode"><h2>'+esc(e.title||("Выпуск "+(e.num||"")))+'</h2><div class="meta">'+esc(date(e.date||e.pubDate))+'</div><div class="desc">'+esc(plain(e.show_notes||e.body||e.description||"").slice(0,340))+'</div><p><button class="btn" data-i="'+i+'">▶ Слушать</button></p></article>';
  }).join("");
  [...list.querySelectorAll("[data-i]")].forEach(function(b){b.onclick=function(){start(items[+b.dataset.i])}});
}
function audioUrl(e){return e.audio_url||e.audio||e.enclosure?.url||e.file||""}
function start(e){
  const url=audioUrl(e);
  if(!url){status.className="status error";status.textContent="У выпуска не найден аудиофайл";return}
  save();
  current=e;
  player.hidden=false;
  pt.textContent=e.title||"Радио-Т";
  audio.src=url;
  audio.onloadedmetadata=()=>{
    const p=progress()[id(e)];
    if(p&&p.position>10&&p.position<audio.duration-10)audio.currentTime=p.position;
  };
  audio.play().catch(()=>{});
  if("mediaSession"in navigator){
    try{navigator.mediaSession.metadata=new MediaMetadata({title:pt.textContent,artist:"Радио-Т"})}catch{}
  }
}
play.onclick=()=>audio.paused?audio.play():audio.pause();
$("#back").onclick=()=>audio.currentTime=Math.max(0,audio.currentTime-30);
$("#fwd").onclick=()=>audio.currentTime=Math.min(audio.duration||Infinity,audio.currentTime+30);
$("#speed").onchange=e=>audio.playbackRate=+e.target.value;
audio.ontimeupdate=()=>{if(audio.duration)seek.value=Math.round(audio.currentTime/audio.duration*1000)};
seek.oninput=()=>{if(audio.duration)audio.currentTime=+seek.value/1000*audio.duration};
audio.onplay=()=>play.textContent="Ⅱ";
audio.onpause=()=>{play.textContent="▶";save()};
setInterval(save,5000);
addEventListener("beforeunload",save);
$("#q").oninput=filterItems;
$("#reload").onclick=load;
if("mediaSession"in navigator){
  for(const [a,f] of Object.entries({
    play:()=>audio.play(),
    pause:()=>audio.pause(),
    seekbackward:()=>audio.currentTime=Math.max(0,audio.currentTime-30),
    seekforward:()=>audio.currentTime=Math.min(audio.duration||Infinity,audio.currentTime+30)
  })){try{navigator.mediaSession.setActionHandler(a,f)}catch{}}
}
load();
</script>
</body></html>`;

function send(res,status,body,type="text/plain; charset=utf-8",cache="no-store",extra={}){
  res.writeHead(status,{"Content-Type":type,"Cache-Control":cache,...extra});
  res.end(body);
}

function requestText(url, redirects=3){
  return new Promise((resolve,reject)=>{
    const req=https.get(url,{
      family:4,
      headers:{
        "Accept":"application/json, application/rss+xml, application/xml, text/xml, */*",
        "User-Agent":"Mozilla/5.0 RadioT-Web/1.1"
      }
    },res=>{
      const status=res.statusCode||0;
      if(status>=300&&status<400&&res.headers.location&&redirects>0){
        res.resume();
        const next=new URL(res.headers.location,url).toString();
        resolve(requestText(next,redirects-1));
        return;
      }
      let body="";
      res.setEncoding("utf8");
      res.on("data",chunk=>body+=chunk);
      res.on("end",()=>resolve({status,body,headers:res.headers,url}));
    });
    req.setTimeout(12000,()=>req.destroy(new Error("upstream timeout")));
    req.on("error",reject);
  });
}

function decodeXml(s=""){
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1")
    .replace(/&lt;/g,"<").replace(/&gt;/g,">")
    .replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'")
    .replace(/&amp;/g,"&");
}

function tag(block,name){
  const m=block.match(new RegExp("<"+name+"(?:\\s[^>]*)?>([\\s\\S]*?)<\\/"+name+">","i"));
  return m?decodeXml(m[1].trim()):"";
}

function attr(block,tagName,attrName){
  const m=block.match(new RegExp("<"+tagName+"\\b[^>]*\\b"+attrName+"=[\"']([^\"']+)[\"'][^>]*>","i"));
  return m?decodeXml(m[1]):"";
}

function rssToEntries(xml,limit=70){
  const items=[...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map(m=>m[1]);
  return items.slice(0,limit).map(block=>({
    title:tag(block,"title"),
    date:tag(block,"pubDate"),
    url:tag(block,"link"),
    body:tag(block,"description")||tag(block,"content:encoded"),
    show_notes:tag(block,"itunes:summary"),
    audio_url:attr(block,"enclosure","url")
  })).filter(e=>e.title&&e.audio_url);
}

async function getEpisodes(limit){
  const errors=[];
  try{
    const api=await requestText(API+"/last/"+limit+"?categories=podcast");
    if(api.status>=200&&api.status<300){
      const data=JSON.parse(api.body);
      if(Array.isArray(data)&&data.length)return {items:data,source:"site-api"};
      errors.push("site-api returned empty data");
    }else errors.push("site-api HTTP "+api.status);
  }catch(e){errors.push("site-api: "+e.message)}

  for(const source of RSS_SOURCES){
    try{
      const rss=await requestText(source);
      if(rss.status>=200&&rss.status<300){
        const items=rssToEntries(rss.body,limit);
        if(items.length)return {items,source};
        errors.push(source+" returned no RSS items");
      }else errors.push(source+" HTTP "+rss.status);
    }catch(e){errors.push(source+": "+e.message)}
  }
  throw new Error(errors.join("; "));
}

const server=http.createServer(async(req,res)=>{
  const u=new URL(req.url,"http://localhost");
  if(u.pathname==="/api/episodes"){
    const n=Math.min(Math.max(Number(u.searchParams.get("limit")||70),1),200);
    try{
      const result=await getEpisodes(n);
      return send(res,200,JSON.stringify(result.items),"application/json; charset=utf-8","public, max-age=120",{"X-RadioT-Source":result.source});
    }catch(e){
      return send(res,502,JSON.stringify({error:"upstream unavailable",detail:e.message}),"application/json; charset=utf-8");
    }
  }
  if(u.pathname==="/health"){
    return send(res,200,'{"ok":true}',"application/json; charset=utf-8");
  }
  return send(res,200,page,"text/html; charset=utf-8","no-cache");
});

server.listen(PORT);
