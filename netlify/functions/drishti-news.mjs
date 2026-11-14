// Drishti Sandbox trial — manager-only internal preview.
// Never expose DRISHTI_API_KEY to the browser, GitHub or page source.
// All Drishti content is internal-use metadata, NOT authorised for
// public redistribution or external AI processing by this connector.
import {timingSafeEqual} from "node:crypto";
const ORIGIN="https://developers.manasija.in";
const TTL=15*60_000,MAX=20;
const headers={"Content-Type":"application/json; charset=utf-8","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
const safeString=(value,max=300)=>typeof value==="string"?value.replace(/[\u0000-\u001f\u007f]/g," ").replace(/\s+/g," ").trim().slice(0,max):"";
const safeLink=(value)=>{
 try{
  const u=new URL(String(value||""));
  if(u.protocol!=="https:"||u.username||u.password)return "";
  if(["localhost","127.0.0.1","0.0.0.0","::1"].includes(u.hostname.toLowerCase()))return "";
  return u.href;
 }catch{return ""}
};
function validManager(request){
 const configured=process.env.MANAGER_ACCESS_KEY||"",provided=request.headers.get("x-manager-key")||"";
 if(!configured||!provided)return false;
 const a=Buffer.from(configured),b=Buffer.from(provided);
 return a.length===b.length&&timingSafeEqual(a,b);
}
export function normalizeNews(rows,now=Date.now()){
 if(!Array.isArray(rows))return [];
 const dedup=new Set(),output=[];
 for(const item of rows.slice(0,MAX)){
  if(!item||typeof item!=="object")continue;
  const title=safeString(item.title,240);
  const originalUrl=safeLink(item.link||item.url);
  const dateRaw=safeString(item.date||item.published_at||item.publishedAt,45);
  const time=Date.parse(dateRaw);
  if(title.length<10||!originalUrl||!Number.isFinite(time)||time>now+3600000||time<now-14*86400000)continue;
  const key=originalUrl.toLowerCase();if(dedup.has(key))continue;dedup.add(key);
  const rawSource=typeof item.source==="object"?(item.source?.name||""):item.source;
  output.push({
   id:safeString(item.id,90)||"drishti-"+output.length,
   title,summary:safeString(item.summary,280),
   originalUrl,publishedAt:new Date(time).toISOString(),
   publisher:safeString(rawSource,100)||"Source not specified",
   company:safeString(item.company,100),symbol:safeString(item.symbol,30),
   sentiment:["positive","negative","neutral"].includes(item.sentiment)?item.sentiment:null,
   provider:"Drishti",licensing:"internal_preview_only"
  });
 }
 return output;
}
let cache=null,inFlight=null;
async function fetchDrishti(path){
 const key=process.env.DRISHTI_API_KEY;
 if(!key)throw {code:"not_configured",status:503};
 let response;
 try{
  response=await fetch(ORIGIN+path,{
   method:"GET",headers:{"X-API-Key":key,"Accept":"application/json"},
   redirect:"error",signal:AbortSignal.timeout(11000)
  });
 }catch(e){throw {code:"drishti_unreachable",status:502}}
 if(!response.ok){
  const status=response.status;
  throw {code:status===401?"invalid_key":status===403?"news_scope_unavailable":
   status===402?"credits_exhausted":status===429?"rate_limited":"provider_error",
   status:status===401||status===403||status===402||status===429?status:502};
 }
 try{return await response.json()}catch{throw {code:"invalid_provider_response",status:502}}
}
export async function drishtiAccount(){
 const result=await fetchDrishti("/v1/account");
 const data=result?.data;
 if(!data||typeof data!=="object")throw {code:"invalid_provider_response",status:502};
 const products=Array.isArray(data.products)?data.products:[];
 return {configured:true,keyValid:true,newsEnabled:products.some(x=>x?.product==="news"&&x.enabled===true),
  plan:safeString(data.metadata?.subscription_plan_name||data.metadata?.subscription_plan_id,60)||"Unknown",
  credits:typeof data.balance==="number"?data.balance:null};
}
export async function drishtiNews(now=Date.now()){
 if(cache&&now-cache.checkedAt<TTL)return {...cache.result,cached:true};
 if(inFlight)return inFlight;
 inFlight=(async()=>{
  const raw=await fetchDrishti("/v1/news?page=1&limit=20");
  if(!Array.isArray(raw?.data))throw {code:"invalid_provider_response",status:502};
  const articles=normalizeNews(raw.data,now);
  const result={articles,count:articles.length,checkedAt:new Date(now).toISOString(),
   hasNext:raw.has_next===true,source:"Drishti News API",
   notice:"Manager-only preview of licensed news metadata. Not a verified exchange filing. External publishing or sending Drishti content to AI is not enabled.",
   cached:false};
  cache={checkedAt:now,result};
  return result;
 })();
 try{return await inFlight}finally{inFlight=null}
}
export default async function handler(request){
 if(request.method!=="GET")return json({error:"GET required"},405);
 if(!process.env.MANAGER_ACCESS_KEY)return json({error:"Manager authentication is not configured.",code:"manager_not_configured"},503);
 if(!validManager(request))return json({error:"Connect your SignalDesk manager key first.",code:"manager_required"},401);
 if(!process.env.DRISHTI_API_KEY)return json({error:"Set DRISHTI_API_KEY in Netlify Functions → Production and redeploy.",code:"not_configured"},503);
 const mode=new URL(request.url).searchParams.get("mode");
 if(mode!=="status"&&mode!=="news")return json({error:"Choose mode=status or mode=news.",code:"invalid_mode"},400);
 try{
  const result=mode==="status"?await drishtiAccount():await drishtiNews();
  return json(result);
 }catch(e){
  const errorMap={
   invalid_key:"Drishti rejected the API key. Check DRISHTI_API_KEY in Netlify.",
   news_scope_unavailable:"Drishti access is restricted for this key or plan. Check its News product entitlement.",
   credits_exhausted:"Drishti credits are exhausted for this account.",
   rate_limited:"Drishti rate limit reached. Retry after the provider's reset.",
   invalid_provider_response:"Drishti returned an unexpected response. Check the documentation or plan.",
   drishti_unreachable:"SignalDesk could not reach Drishti right now.",
   provider_error:"Drishti returned a server error."
  };
  const code=e?.code||"provider_error";
  return json({code,error:errorMap[code]||"Drishti is unavailable."},Number.isInteger(e?.status)?e.status:502);
 }
}
