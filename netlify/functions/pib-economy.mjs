// Public, attribution-first RSS metadata from the Press Information Bureau.
// The PIB copyright policy permits reproduction of its own material with
// prominent attribution and without misleading changes; third-party items
// are excluded from use without separate permission.
// Source: https://www.pib.gov.in/content/102_2_Copyright-Policy.aspx
import {parseRSS} from "./news.mjs";
import {rankOfficialStory,suggestedHashtags} from "./lib/editorial.mjs";

const FEED="https://www.pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3";
const ALTERNATE="https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3";
export const PIB_FEED_URL=FEED;
const financeTerms=/\b(?:financial|finance|financing|fintech|fiscal|econom(?:y|ic|ics)|gdp|inflation|banking|banks?|credit|taxation|tax|gst|investment|investor|capital markets?|securit(?:y|ies)|stock markets?|mutual funds?|rbi|sebi|budget|insurance|exports?|imports?|trade|commerce|manufacturing|industrial growth|infrastructure|railways|energy|renewables?|ministry of finance|corporate affairs|public procurement|msme|pension|employment|rupee|monetary|interest rates?|sectors?|startups?|semiconductor|reserve bank|digital payments?)\b/i;
const skip=/\b(?:photo gallery|media invitation|photo release|third.party content|copyright third.party)\b/i;
const trusted=raw=>{
 try{const url=new URL(raw);return url.protocol==="https:"&&["pib.gov.in","www.pib.gov.in"].includes(url.hostname.toLowerCase())}catch{return false}
};
export function preparePIBStories(xml,now=Date.now()){
 const items=parseRSS(xml,{name:"PIB",official:true});
 const seen=new Set(),stories=[];
 for(const row of items){
  if(!trusted(row.url)||!row.title||row.title.length<12||skip.test(row.title))continue;
  const time=Date.parse(row.publishedAt);
  if(!Number.isFinite(time)||time<now-30*86400000||time>now+3600000)continue;
  if(!financeTerms.test(row.title+" "+row.snippet))continue;
  const key=row.url.toLowerCase();
  if(seen.has(key))continue;
  seen.add(key);
  const base={...row,sourceId:"pib-economy",sourceName:"PIB · Economy & policy",
   publisher:"PIB",provider:"PIB RSS",official:true,category:"Economy & policy",
   snippet:row.snippet.slice(0,280),rightsNote:"PIB own-content reuse: source attribution required. Check third-party materials separately."};
  const ranked=rankOfficialStory(base,now);
  stories.push({...base,priority:Math.min(85,ranked.priority),impact:ranked.impact,
   category:"Economy & policy",reason:"Government press release mentioning finance, economy, business or industry. Check relevance to investors and read the original.",
   rankBasis:"Keyword relevance and recency. May include general policy news; not market-impact advice.",
   suggestedHashtags:suggestedHashtags(base)});
 }
 return stories.sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)).slice(0,35);
}
// Allow only redirects between the two official PIB RSS hostnames.
const allowedPIB=url=>{
 try{const u=new URL(url);return u.protocol==="https:"&&["pib.gov.in","www.pib.gov.in"].includes(u.hostname.toLowerCase())&&u.pathname.toLowerCase()==="/rssmain.aspx"}catch{return false}
};
async function rssViaPIB(start){
 let url=start;
 for(let hop=0;hop<3;hop++){
  if(!allowedPIB(url))throw Error("PIB RSS redirect left the official source");
  const r=await fetch(url,{headers:{"Accept":"application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.1","User-Agent":"Geojit-SignalDesk/0.4 (PIB RSS reading)"},
    redirect:"manual",signal:AbortSignal.timeout(5500)});
  if(r.status>=300&&r.status<400){
   const next=r.headers.get("location");
   if(!next)throw Error("PIB RSS redirect missing destination");
   url=new URL(next,url).href;continue;
  }
  if(!r.ok)throw Error("PIB RSS returned HTTP "+r.status);
  if(Number(r.headers.get("content-length")||0)>1_500_000)throw Error("PIB RSS too large");
  const xml=(await r.text()).slice(0,1_500_000);
  if(!/<(?:rss|feed|rdf:RDF)(?:\\s|>)/i.test(xml))throw Error("PIB did not return RSS XML");
  return xml;
 }
 throw Error("PIB RSS redirected too many times");
}
let cache=null,loading=null;
export async function loadPIB(now=Date.now()){
 if(cache&&now-cache.time<15*60_000)return {...cache.result,cached:true};
 if(loading)return loading;
 loading=(async()=>{
  let xml;
  try{xml=await Promise.any([rssViaPIB(FEED),rssViaPIB(ALTERNATE)])}
  catch{throw Error("PIB RSS unavailable from its two official hostnames. Open PIB directly or retry later.")}
  const stories=preparePIBStories(xml,now);
  const result={source:"PIB · Government of India",sourceUrl:"https://www.pib.gov.in/",
   stories,count:stories.length,checkedAt:new Date(now).toISOString(),windowDays:30,
   notice:"Government press releases filtered by economy, financial and business topics. Not company-specific market coverage.",
   attribution:"Source: Press Information Bureau, Government of India. Open and verify original before publishing."};
  cache={time:now,result};return {...result,cached:false};
 })();
 try{return await loading}finally{loading=null}
}
export default async function handler(request){
 const headers={"Content-Type":"application/json; charset=utf-8","Cache-Control":"public, max-age=60, s-maxage=900","X-Content-Type-Options":"nosniff"};
 if(request.method!=="GET")return new Response(JSON.stringify({error:"GET required"}),{status:405,headers});
 try{return new Response(JSON.stringify(await loadPIB()),{headers})}
 catch(e){return new Response(JSON.stringify({error:String(e.message||"PIB feed unavailable"),stories:[]}),{status:502,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}})}
}
