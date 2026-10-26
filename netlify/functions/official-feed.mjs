// Read-only RBI/SEBI RSS demonstration. No credentials, licensed news,
// proprietary MarketsMojo content, AI drafting or X API calls are used here.
import { parseRSS } from "./news.mjs";

export const FEED_SOURCES=[
  {id:"rbi-press",name:"RBI · Press releases",publisher:"RBI",url:"https://rbi.org.in/pressreleases_rss.xml",fallback:"https://www.rbi.org.in/pressreleases_rss.xml",official:true},
  {id:"rbi-notifications",name:"RBI · Notifications",publisher:"RBI",url:"https://rbi.org.in/notifications_rss.xml",fallback:"https://www.rbi.org.in/notifications_rss.xml",official:true},
  {id:"rbi-speeches",name:"RBI · Speeches",publisher:"RBI",url:"https://www.rbi.org.in/speeches_rss.xml",official:true},
  {id:"sebi",name:"SEBI · Regulatory updates",publisher:"SEBI",url:"https://www.sebi.gov.in/sebirss.xml",official:true}
];
const TOPICS=[
  {category:"Monetary policy",pattern:/monetary policy|repo rate|policy rate|standing deposit|liquidity|inflation|mpc|reverse repo|bank rate|interest rate/i,priority:95},
  {category:"Investor protection",pattern:/investor protection|grievance|fraud|scam|cyber|disclosure|mis.sell|surveillance/i,priority:88},
  {category:"Markets & funds",pattern:/mutual fund|capital market|securities market|equity|derivatives|exchange|listed|stockbroker|stock broker|ipo|portfolio/i,priority:90},
  {category:"Regulation",pattern:/circular|regulation|master direction|guideline|framework|norms|compliance|press release/i,priority:78},
  {category:"Economy & banking",pattern:/bank|nbfc|credit|finance|gdp|economy|fiscal|currency|forex|rupee/i,priority:76}
];
export function classify(story){
  const haystack=(story.title+" "+story.snippet).slice(0,700);
  const match=TOPICS.find(t=>t.pattern.test(haystack));
  return {category:match?.category||"Other official updates",priority:match?.priority||45};
}
export function inWindow(date,days=30,now=Date.now()){
  const t=Date.parse(date);
  return Number.isFinite(t)&&t>=now-days*86400000&&t<=now+12*3600000;
}
const trusted=u=>{
  try{
    const url=new URL(u);
    return url.protocol==="https:"&&["rbi.org.in","sebi.gov.in"].some(d=>url.hostname===d||url.hostname.endsWith("."+d));
  }catch{return false}
};
async function requestFeed(url){
  const r=await fetch(url,{headers:{"Accept":"application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.1","User-Agent":"SignalDesk/0.2 (official public RSS metadata reader)"},signal:AbortSignal.timeout(8000)});
  if(!r.ok)throw Error("HTTP "+r.status);
  const size=Number(r.headers.get("content-length")||0);
  if(size>2_000_000)throw Error("Feed exceeds maximum size");
  const body=(await r.text()).slice(0,2_000_000);
  if(!/<(?:rss|feed|rdf:RDF)(?:\s|>)/i.test(body))throw Error("Feed is not RSS XML");
  return body;
}
async function readSource(source){
  let xml,firstError;
  try{xml=await requestFeed(source.url)}
  catch(e){
    firstError=e;
    if(source.fallback){try{xml=await requestFeed(source.fallback)}catch(e2){throw Error("Primary: "+firstError.message+"; fallback: "+e2.message)}}
    else throw e;
  }
  const all=parseRSS(xml,{name:source.publisher,official:true})
    .filter(s=>trusted(s.url)&&inWindow(s.publishedAt,30))
    .map(s=>({...s,sourceId:source.id,sourceName:source.name,...classify(s)}));
  // Some regulator feeds produce blank/old items; report transparently.
  return all;
}
let cache=null;
export async function fetchOfficialFeeds(now=Date.now()){
  const attempts=await Promise.allSettled(FEED_SOURCES.map(readSource));
  const sources=[],stories=[],warnings=[];
  for(let i=0;i<attempts.length;i++){
    const result=attempts[i],source=FEED_SOURCES[i];
    if(result.status==="fulfilled"){
      const rows=result.value;
      sources.push({id:source.id,name:source.name,ok:true,count:rows.length,lastItemAt:rows[0]?.publishedAt||null});
      stories.push(...rows);
      if(!rows.length)warnings.push(source.name+": connected, no dated items within 30 days.");
    }else{
      sources.push({id:source.id,name:source.name,ok:false,count:0,lastItemAt:null});
      warnings.push(source.name+": "+String(result.reason?.message||result.reason));
    }
  }
  const seen=new Set();
  const unique=stories.filter(s=>{const k=s.url.toLowerCase().replace(/\/$/,"");if(seen.has(k))return false;seen.add(k);return true});
  unique.sort((a,b)=>b.priority-a.priority||Date.parse(b.publishedAt)-Date.parse(a.publishedAt));
  return {stories:unique.slice(0,100),sources,warnings,fetchedAt:new Date(now).toISOString(),windowDays:30,kind:"official-rss-metadata",demo:true,rightsNotice:"Only official RSS metadata. Open and verify the original before editing or publication."};
}
export default async function handler(request){
  if(request.method!=="GET")return new Response(JSON.stringify({error:"GET only"}),{status:405,headers:{"Content-Type":"application/json"}});
  // Fixed URL allowlist, no query-string fetch URLs or user input.
  if(cache&&Date.now()-cache.time<10*60_000)
    return new Response(JSON.stringify(cache.result),{headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"public, max-age=60, s-maxage=600","X-Content-Type-Options":"nosniff"}});
  try{
    const result=await fetchOfficialFeeds();
    if(result.sources.some(s=>s.ok))cache={time:Date.now(),result};
    return new Response(JSON.stringify(result),{status:result.sources.some(s=>s.ok)?200:503,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"public, max-age=60, s-maxage=600","X-Content-Type-Options":"nosniff"}});
  }catch(e){console.error("official RSS POC",e.message);return new Response(JSON.stringify({error:"Official feeds unavailable; retry later."}),{status:503,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}})}
}
