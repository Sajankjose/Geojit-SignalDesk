import { allowed, originOK, response } from "./lib/auth.mjs";
// SignalDesk server-side collection. Metadata only; no scraping or full article copying.
// RBI/SEBI public RSS + optional licensed NewsAPI. All output still requires human verification.
const FEEDS=[
  {name:"RBI",url:"https://rbi.org.in/pressreleases_rss.xml",official:true},
  {name:"RBI Notifications",url:"https://www.rbi.org.in/notifications_rss.xml",official:true},
  {name:"PIB",url:"https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=1",official:true},
  {name:"SEBI",url:"https://www.sebi.gov.in/sebirss.xml",official:true}
];
const WHITELIST=["reuters.com","bloomberg.com","business-standard.com","livemint.com","moneycontrol.com","cnbctv18.com","thehindubusinessline.com","economictimes.indiatimes.com"];
const KEYWORDS=/\b(rbi|sebi|market|equity|equities|stocks?|nifty|sensex|inflation|interest|monetary|policy|rupee|forex|bond|mutual fund|securities|investment|ipo|earnings|results|bank|fund|gdp|economy|economic|crude|tax|regulat|capital|credit|trading|finance|fiscal|exchange)\b/i;
const unescapeXml=x=>String(x||"").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1").replace(/&#(x[\da-f]+|\d+);/gi,(_,n)=>{const v=n.toLowerCase().startsWith("x")?parseInt(n.slice(1),16):+n;return v>0&&v<=0x10ffff?String.fromCodePoint(v):""}).replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&apos;|&#39;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&nbsp;/g," ");
const clean=x=>unescapeXml(String(x||"")).replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim();
const tag=(s,t)=>{const r=new RegExp("<(?:[\\w-]+:)?"+t+"(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w-]+:)?"+t+">","i");return r.exec(s)?.[1]||""};
const link=(chunk)=>{const raw=tag(chunk,"link")||(/<link[^>]*href=["']([^"']+)["']/i.exec(chunk)?.[1]||"");try{const url=new URL(clean(raw));if(url.protocol==="http:")url.protocol="https:";return url.protocol==="https:"?url.href:null}catch{return null}};
const iso=s=>{const t=Date.parse(s);return Number.isFinite(t)?new Date(t).toISOString():null};
export function parseRSS(xml,source){
const chunks=[...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi),...xml.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi)];
return chunks.slice(0,65).map((m,i)=>{
const raw=m[1],url=link(raw),publishedAt=iso(clean(tag(raw,"pubDate")||tag(raw,"published")||tag(raw,"updated")||tag(raw,"date")));
if(!url||!publishedAt)return null;
return {id:source.name.toLowerCase()+"-"+hash(url),publisher:source.name,title:clean(tag(raw,"title")).slice(0,240),snippet:clean(tag(raw,"description")||tag(raw,"summary")).slice(0,420),url,publishedAt,official:true,category:"Regulatory",relatedSources:[],feed:source.name};
}).filter(Boolean)
}
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return(h>>>0).toString(36)}
const category=t=>/rbi|monetary|inflation|gdp|economy|rupee|fiscal|interest rate/i.test(t)?"Economy":/sebi|regulat|circular|investor protect/i.test(t)?"Regulation":/mutual fund|sip|amc/i.test(t)?"Mutual funds":/company|results|earnings|ipo/i.test(t)?"Companies":"Markets";
const score=s=>{
const t=s.title+" "+s.snippet;let v=s.official?74:58;
if(/\b(RBI|SEBI|Nifty|Sensex|rate decision|GDP|inflation|quarterly results|policy)\b/i.test(t))v+=15;
if(/\b(investors?|market|stocks?|mutual funds?|earnings)\b/i.test(t))v+=6;
return Math.min(99,v)
};
const stop=new Set(["the","and","for","with","that","from","this","after","amid","have","into","over","under","india","indian","market","markets","says","news","today","stocks"]);
const words=t=>new Set(String(t).toLowerCase().replace(/[^a-z0-9 ]/g," ").split(/\s+/).filter(w=>w.length>3&&!stop.has(w)));
function duplicate(a,b){if(a.url===b.url)return true;const w=words(a.title),z=words(b.title);if(w.size<3||z.size<3)return false;let overlap=0;for(const k of w)if(z.has(k))overlap++;return overlap/Math.min(w.size,z.size)>.76&&overlap/Math.max(w.size,z.size)>.43}
const hostAllowed=u=>{try{const h=new URL(u).hostname.toLowerCase();return WHITELIST.some(d=>h===d||h.endsWith("."+d))}catch{return false}};
const istDay=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
async function xmlFetch(feed){
const response=await fetch(feed.url,{headers:{"User-Agent":"Geojit-SignalDesk/0.1 (editorial RSS reader)","Accept":"application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.8"},signal:AbortSignal.timeout(8500)});
if(!response.ok)throw Error("HTTP "+response.status);
const body=await response.text();if(!/<(?:rss|feed|rdf:RDF)/i.test(body))throw Error("not RSS/Atom XML");
return parseRSS(body,feed)
}
async function licensedNews(){
const key=process.env.NEWSAPI_KEY;if(!key)return null;
const u=new URL("https://newsapi.org/v2/everything");
u.searchParams.set("q",'(India OR Indian OR RBI OR SEBI OR Nifty OR Sensex) AND (markets OR stocks OR inflation OR policy OR economy OR earnings OR rupee)');
u.searchParams.set("language","en");u.searchParams.set("sortBy","publishedAt");u.searchParams.set("pageSize","70");
u.searchParams.set("from",new Date(Date.now()-36*3600000).toISOString());u.searchParams.set("domains",WHITELIST.join(","));
const r=await fetch(u,{headers:{"X-Api-Key":key},signal:AbortSignal.timeout(9000)});
const j=await r.json();if(!r.ok||j.status!=="ok")throw Error(j.message||"NewsAPI failure");
return (j.articles||[]).filter(a=>a.url&&hostAllowed(a.url)&&a.title&&a.publishedAt).map(a=>({
 id:"publisher-"+hash(a.url),publisher:clean(a.source?.name||new URL(a.url).hostname).slice(0,70),
 title:clean(a.title).slice(0,240),snippet:clean(a.description).slice(0,420),url:a.url,
 publishedAt:iso(a.publishedAt),official:false,category:"Markets",relatedSources:[],feed:"NewsAPI"
})).filter(s=>s.publishedAt)
}
let cache=null;
export default async function handler(request){
const h={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
if(!allowed(request))return response({error:"Access denied or manager key missing."},401);
if(!originOK(request))return response({error:"Origin mismatch."},403);
if(request.method!=="GET")return response({error:"GET required"},405);
if(cache&&Date.now()-cache.when<10*60*1000)return new Response(JSON.stringify(cache.data),{headers:h});
const tasks=await Promise.allSettled([...FEEDS.map(async s=>({source:s.name,stories:await xmlFetch(s)})),...(process.env.NEWSAPI_KEY?[licensedNews().then(stories=>({source:"NewsAPI",stories}))]:[])]);
const sources=[],errors=[],combined=[];
for(let i=0;i<tasks.length;i++){
const s=tasks[i],name=i<FEEDS.length?FEEDS[i].name:"NewsAPI";
if(s.status==="fulfilled"){combined.push(...s.value.stories);sources.push({name,ok:true,count:s.value.stories.length})}
else{errors.push(name+" unavailable: "+String(s.reason?.message||s.reason));sources.push({name,ok:false,count:0})}
}
const cutoff=Date.now()-36*3600000;
const results=combined.filter(s=>s.title&&s.url&&Date.parse(s.publishedAt)>=cutoff&&KEYWORDS.test(s.title+" "+s.snippet));
results.forEach(s=>{s.category=category(s.title+" "+s.snippet);s.score=score(s)});
results.sort((a,b)=>b.score-a.score||Date.parse(b.publishedAt)-Date.parse(a.publishedAt));
const dedup=[];
for(const s of results){const found=dedup.find(x=>duplicate(s,x));if(found){if(found.publisher!==s.publisher)found.relatedSources.push({publisher:s.publisher,url:s.url,publishedAt:s.publishedAt})}else dedup.push(s)}
const data={day:istDay(),stories:dedup.slice(0,70),sources,errors,fetchedAt:new Date().toISOString()};
if(dedup.length)cache={when:Date.now(),data};
return new Response(JSON.stringify(data),{headers:h})
}
