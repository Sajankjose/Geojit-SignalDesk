// Metadata-only lookup for a bounded list of editorial sources.
// Never fetch arbitrary user URLs or full article bodies; redirects are blocked.
// OpenAI is not involved in this endpoint. Human source checks remain mandatory.
import {timingSafeEqual} from "node:crypto";
const HOSTS=[
 "rbi.org.in","sebi.gov.in","pib.gov.in","nseindia.com","bseindia.com",
 "reuters.com","business-standard.com","livemint.com","moneycontrol.com",
 "thehindubusinessline.com","economictimes.indiatimes.com","cnbctv18.com"
];
const okhost=host=>HOSTS.some(d=>host===d||host.endsWith("."+d));
export function checkedNewsURL(value){
 try{
  const url=new URL(String(value||"").trim());
  if(url.protocol!=="https:"||url.username||url.password||!okhost(url.hostname.toLowerCase())||url.port&&url.port!=="443")return null;
  if(url.href.length>1500)return null;
  return url;
 }catch{return null}
}
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
function auth(request){
 const configured=process.env.MANAGER_ACCESS_KEY||"",supplied=request.headers.get("x-manager-key")||"";
 if(!configured||configured.length<24||!supplied)return false;
 const a=Buffer.from(configured),b=Buffer.from(supplied);
 return a.length===b.length&&timingSafeEqual(a,b);
}
const entities=s=>String(s||"").replace(/&(?:amp|lt|gt|quot|apos|nbsp|#(\d+)|#x([0-9a-f]+));/gi,(match,decimal,hex)=>{
 if(decimal||hex){const n=parseInt(decimal||hex,hex?16:10);return n>=32&&n<=0x10ffff?String.fromCodePoint(n):" "}
 return ({"&amp;":"&","&lt;":"<","&gt;":">","&quot;":'"',"&apos;":"'","&nbsp;":" "})[match.toLowerCase()]||" "
}).replace(/\s+/g," ").trim();
const tags=html=>[...html.matchAll(/<meta\b[^>]*>/gi)].map(x=>x[0]);
function meta(html,keys){
 for(const tag of tags(html)){
  const attrs=Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map(v=>[v[1].toLowerCase(),v[2]??v[3]??""]));
  const key=(attrs.property||attrs.name||"").toLowerCase();
  if(keys.includes(key)&&attrs.content)return entities(attrs.content).slice(0,500);
 }
 return "";
}
export function articleMetadata(html,url){
 const title=meta(html,["og:title","twitter:title"])||entities((html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||"");
 const description=meta(html,["og:description","twitter:description","description"]);
 const publisher=meta(html,["og:site_name"])||new URL(url).hostname.replace(/^www\./,"");
 return {title:title.replace(/<[^>]*>/g," ").slice(0,240),snippet:description.replace(/<[^>]*>/g," ").slice(0,850),publisher:publisher.slice(0,70),sourceUrl:url};
}
export default async function handler(request){
 if(!auth(request))return json({error:"Manager access is required. Connect AI in Studio first."},401);
 if(request.method!=="POST")return json({error:"POST required"},405);
 const origin=request.headers.get("origin");
 if(origin){try{if(new URL(origin).origin!==new URL(request.url).origin)return json({error:"Origin not allowed"},403)}catch{return json({error:"Origin not allowed"},403)}}
 let input;
 try{if(Number(request.headers.get("content-length")||0)>2500)return json({error:"Request too large"},413);input=await request.json()}catch{return json({error:"Invalid request"},400)}
 const safe=checkedNewsURL(input?.url);
 if(!safe)return json({error:"This URL isn't in the supported source list. Paste a headline and news text instead; add the original URL for reference."},422);
 try{
  const response=await fetch(safe.href,{redirect:"manual",headers:{"Accept":"text/html,application/xhtml+xml;q=0.9","User-Agent":"Geojit-SignalDesk-EditorialPOC/1.0"},signal:AbortSignal.timeout(9000)});
  if(!response.ok)return json({error:response.status>=300&&response.status<400?"This publisher redirects or restricts automated previews. Paste the headline and excerpt instead.":"Publisher unavailable ("+response.status+"). Paste the news text instead."},422);
  const mime=response.headers.get("content-type")||"";
  if(!/text\/html|application\/xhtml\+xml/i.test(mime))return json({error:"This page does not provide readable HTML metadata. Paste the news text instead."},422);
  if(Number(response.headers.get("content-length")||0)>400000)return json({error:"Preview is too large. Paste the headline instead."},422);
  const html=(await response.text()).slice(0,400000);
  const data=articleMetadata(html,safe.href);
  if(!data.title||data.title.length<12)return json({error:"No usable headline metadata found. Paste the headline and news text instead."},422);
  return json({ ...data,previewOnly:true,notice:"Headline and description metadata only. The full article was not read or verified; check the original source."});
 }catch(e){return json({error:"Unable to preview this source right now. Paste the headline and relevant text instead."},502)}
}
