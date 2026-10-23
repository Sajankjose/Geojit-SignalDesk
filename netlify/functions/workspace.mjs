import { getStore } from "@netlify/blobs";
import { allowed,istDay,response,originOK } from "./lib/auth.mjs";

// Production and preview are separate namespaces to prevent preview overwrites.
// Only the current IST date is exposed. Older records aren't shown or deleted here:
// published communications may have records-retention obligations.
export function workspaceStore(){
  const context=process.env.CONTEXT==="production"?"production":process.env.CONTEXT==="deploy-preview"?"preview":"branch";
  return getStore({name:"signaldesk-workspace-"+context,consistency:"strong"});
}
const blank=()=>({drafts:{},manual:[],savedStories:{},settings:{disclosure:""},seen:{}});
const isObj=o=>o!==null&&typeof o==="object"&&!Array.isArray(o);
const validText=(s,max=3000)=>typeof s==="string"&&s.length<=max;
function checkPayload(input){
  if(!isObj(input)||!isObj(input.drafts)||!Array.isArray(input.manual)||!isObj(input.savedStories)||!isObj(input.settings)||!isObj(input.seen))return false;
  if(Object.keys(input.drafts).length>80||input.manual.length>80||Object.keys(input.savedStories).length>120||Object.keys(input.seen).length>180)return false;
  if(!validText(input.settings.disclosure??"",300))return false;
  for(const s of [...input.manual,...Object.values(input.savedStories)]){
    if(!isObj(s)||!validText(s.id,120)||!validText(s.title,260)||!validText(s.publisher,100)||!validText(s.url,1200)||!/^https:\/\//i.test(s.url)||!validText(s.snippet??"",1000))return false;
  }
  for(const d of Object.values(input.drafts)){
    if(!isObj(d)||!["Draft","Ready","Published"].includes(d.status)||!isObj(d.variants)||
    !validText(d.variants.news??"",5000)||!validText(d.variants.insight??"",5000)||
    !validText(d.xUrl??"",800)||!validText(d.publishedText??"",4000)||!["news","insight"].includes(d.variant))return false;
  }
  return true;
}
export default async function handler(request){
  if(!allowed(request))return response({error:"Access denied or MANAGER_ACCESS_KEY not configured (minimum 24 characters)."},401);
  if(!originOK(request))return response({error:"Cross-origin request rejected"},403);
  if(request.method!=="GET"&&request.method!=="PUT")return response({error:"Only GET or PUT supported"},405);
  const day=istDay(),key="day-"+day;
  try{
    const store=workspaceStore();
    if(request.method==="GET"){
      const state=await store.get(key,{type:"json",consistency:"strong"});
      return response({day,state:state||blank(),persisted:!!state});
    }
    const contentLength=Number(request.headers.get("content-length")||0);
    if(contentLength>175000)return response({error:"Workspace too large"},413);
    let state;
    try{state=await request.json()}catch{return response({error:"Invalid JSON"},400)}
    if(JSON.stringify(state).length>175000||!checkPayload(state))return response({error:"Invalid workspace payload"},400);
    await store.setJSON(key,state);
    return response({day,saved:true});
  }catch(e){
    console.error("workspace storage failed:",e?.message);
    return response({error:"Workspace storage unavailable; contact the administrator."},503);
  }
}
