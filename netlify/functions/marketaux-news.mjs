// Indian-market publisher metadata via Marketaux.
// Strictly manager-gated and disabled until permitted internal commercial use
// of this API/data has been confirmed in MARKET AUX's licence/terms.
// Never expose the API token to client, logs, source code or public HTML.
import {marketauxAuthenticated,sameOrigin} from "./lib/marketaux-auth.mjs";
import {rankOfficialStory,suggestedHashtags} from "./lib/editorial.mjs";
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
const validUrl=value=>{
 try{const u=new URL(value);return u.protocol==="https:"&&!u.username&&!u.password&&u.href.length<=1500?u.href:""}catch{return ""}
};
const clean=(s,n)=>String(s||"").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim().slice(0,n);
export function normaliseMarketaux(data,now=Date.now()){
 if(!Array.isArray(data))return [];
 const seenURLs=new Set(),seenTitles=new Set(),out=[];
 for(const item of data.slice(0,3)){
  const title=clean(item?.title,260),url=validUrl(item?.url);
  const time=Date.parse(item?.published_at);
  if(!title||title.length<12||!url||!Number.isFinite(time)||time>now+60*60_000||time<now-14*86400_000)continue;
  const titleKey=title.toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,105);
  if(seenURLs.has(url)||seenTitles.has(titleKey))continue;
  seenURLs.add(url);seenTitles.add(titleKey);
  const publisher=clean(item?.source||new URL(url).hostname.replace(/^www\./,""),90);
  const snippet=clean(item?.description||"",240);
  const base={id:"marketaux:"+String(item?.uuid||url).slice(0,120),title,snippet,url,publisher,provider:"Marketaux",official:false,
   sourceId:"marketaux-india",sourceName:"Indian markets · Marketaux",publishedAt:new Date(time).toISOString(),dateOnly:false,category:"Company & markets"};
  // Reuse topic/date ranking as an editorial heuristic, never claim market impact or verified facts.
  const ranked=rankOfficialStory(base,now);
  out.push({...base,priority:Math.min(76,ranked.priority),impact:"medium",
   reason:"Publisher-reported company/market news. Confirm figures and material facts against original reporting or exchange filings.",
   rankBasis:"Marketaux India entity relevance + topic/recency. Unverified publisher report.",
   category:ranked.category==="Official update"?"Company & markets":ranked.category,
   suggestedHashtags:suggestedHashtags(base)});
 }
 return out;
}
let memo=null,inflight=null;
export async function fetchMarketaux(now=Date.now()){
 const key=process.env.MARKETAUX_API_TOKEN;
 if(!key)throw Object.assign(new Error("Marketaux token unavailable in Netlify Functions production context."),{status:503});
 if(memo&&now-memo.time<45*60_000)return {...memo.value,cached:true};
 if(inflight)return inflight;
 inflight=(async()=>{
  const url=new URL("https://api.marketaux.com/v1/news/all");
  url.searchParams.set("api_token",key);
  url.searchParams.set("countries","in"); // Country of the exchange of article entities, not publisher locale.
  url.searchParams.set("language","en");
  url.searchParams.set("filter_entities","true");
  url.searchParams.set("group_similar","true");
  url.searchParams.set("limit","3");
  const after=new Date(now-7*86400_000).toISOString().slice(0,19);
  url.searchParams.set("published_after",after);
  let response;
  try{response=await fetch(url,{headers:{"Accept":"application/json"},signal:AbortSignal.timeout(9500),redirect:"error"})}
  catch{throw Object.assign(new Error("Marketaux could not be reached. Try again later."),{status:502})}
  // Never include raw response URLs or provider errors containing the token.
  if(!response.ok){
   const state=response.status===429?"Marketaux free-plan request limit reached. Try later.":response.status===401||response.status===403?"Marketaux token was rejected; check the Functions environment value.":"Marketaux upstream returned HTTP "+response.status+".";
   throw Object.assign(new Error(state),{status:response.status===429?429:502});
  }
  let data;
  try{data=await response.json()}catch{throw Object.assign(new Error("Marketaux returned unreadable data."),{status:502})}
  if(!Array.isArray(data?.data))throw Object.assign(new Error("Unexpected Marketaux response format."),{status:502});
  const stories=normaliseMarketaux(data.data,now);
  const value={source:"Marketaux · India",provider:"Marketaux",stories,checkedAt:new Date(now).toISOString(),
    count:stories.length,windowDays:7,limit:3,
    note:"India-linked financial publisher metadata only, not verified exchange facts or live stock prices.",
    rights:"Do not republish article text or photographs. The manager must check source accuracy and Geojit publishing rights."};
  memo={time:now,value};
  return {...value,cached:false};
 })();
 try{return await inflight}finally{inflight=null}
}
export default async function handler(request){
 if(request.method!=="GET")return json({error:"GET required"},405);
 if(!sameOrigin(request))return json({error:"Origin not allowed"},403);
 if(!marketauxAuthenticated(request))return json({error:"Your Indian Markets session has expired. Sign in once to resume."},401);
 if(process.env.MARKETAUX_USAGE_APPROVED!=="true")
  return json({enabled:false,error:"Marketaux feed is prepared but disabled pending confirmation that Geojit may use this API/data in an internal commercial editorial tool. Once authorised, set MARKETAUX_USAGE_APPROVED to true in Netlify Functions production settings and redeploy."},403);
 if(!process.env.MARKETAUX_API_TOKEN)return json({enabled:false,error:"MARKETAUX_API_TOKEN is not available to the Netlify Functions production deployment. Confirm scope and redeploy."},503);
 try{return json({enabled:true,...await fetchMarketaux()})}
 catch(e){return json({enabled:false,error:String(e.message||"Marketaux unavailable")},e.status||502)}
}
