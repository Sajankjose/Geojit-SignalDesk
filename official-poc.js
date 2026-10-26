(()=>{
"use strict";
const $=id=>document.getElementById(id);
const el=(name,cls,text)=>{const node=document.createElement(name);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node};
const append=(parent,...nodes)=>{nodes.forEach(n=>parent.append(n));return parent};
const storeKey="signaldesk:unified:poc:v1";
const read=()=>{try{const x=JSON.parse(localStorage.getItem(storeKey)||"{}");return x&&typeof x==="object"&&x.drafts&&typeof x.drafts==="object"?x:{drafts:{},disclosure:""}}catch{return {drafts:{},disclosure:""}}};
let workspace=read(),payload={stories:[],sources:[],warnings:[]},active="discover",source="all",windowDays=7,search="",selectedId=null,loading=false,generating=false;
const validUrl=u=>{try{const v=new URL(u);return v.protocol==="https:"?v.href:""}catch{return ""}};
const safeKey=()=>{try{return sessionStorage.getItem("signaldesk:manager:key")||""}catch{return ""}};
let managerKey=safeKey();
function persist(){try{localStorage.setItem(storeKey,JSON.stringify(workspace))}catch(e){notify("Browser storage is unavailable. Changes may not survive a refresh.",true)}updateNavCounts()}
function notify(message,error=false){const n=$("editorMessage");if(n){n.textContent=message;n.classList.toggle("error",error)}}
const dateFmt=(v,withYear=false,dateOnly=false)=>{
 const d=new Date(v);if(Number.isNaN(d.getTime()))return "Date unavailable";
 if(dateOnly)return d.toLocaleDateString("en-IN",{timeZone:"Asia/Kolkata",day:"2-digit",month:"short",year:"numeric"})+" · date only";
 return d.toLocaleString("en-IN",{timeZone:"Asia/Kolkata",day:"2-digit",month:"short",...(withYear?{year:"numeric"}:{}),hour:"2-digit",minute:"2-digit"})+" IST";
};
$("clock").textContent=new Date().toLocaleDateString("en-IN",{timeZone:"Asia/Kolkata",weekday:"short",day:"numeric",month:"short",year:"numeric"});
const allDrafts=()=>Object.values(workspace.drafts).sort((a,b)=>(b.updatedAt||"").localeCompare(a.updatedAt||""));
const current=()=>selectedId?workspace.drafts[selectedId]||null:null;
function updateNavCounts(){
 $("draftNavCount").textContent=allDrafts().filter(d=>d.status!=="Published").length;
 $("publishedNavCount").textContent=allDrafts().filter(d=>d.status==="Published").length;
}
function navigate(view,updateHash=true){
 active=["discover","studio","published"].includes(view)?view:"discover";
 for(const v of ["discover","studio","published"])$(v+"View").hidden=v!==active;
 document.querySelectorAll(".sidebar .nav[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===active));
 if(active==="studio")renderStudio();
 if(active==="published")renderPublished();
 if(updateHash)history.replaceState(null,"","#"+active);
 window.scrollTo({top:0,behavior:"auto"});
}
function renderHealth(){
 $("total").textContent=payload.stories.length;
 $("todayCount").textContent=payload.stories.filter(s=>{const t=new Date(s.publishedAt).getTime();return t<=Date.now()&&Date.now()-t<=86400000}).length;
 $("health").textContent=payload.sources.filter(s=>s.ok).length+" / 4";
 const box=$("sources");box.replaceChildren();
 if(!payload.sources.length){box.append(el("p","muted","No source response yet"));return}
 for(const s of payload.sources){
  const row=el("div","feed-status"),label=el("span","",s.name),right=el("span","status-badge "+(s.ok?"ok":"fail"),s.ok?(s.count+" items"):"Unavailable");
  append(row,label,right);box.append(row);
 }
}
function renderStories(){
 const list=$("news");list.replaceChildren();const now=Date.now();
 const shown=payload.stories.filter(s=>(source==="all"||s.publisher===source)&&
  ((now-new Date(s.publishedAt).getTime())<=windowDays*86400000)&&
  (s.title+" "+s.snippet+" "+s.category).toLowerCase().includes(search));
 if(!shown.length){
  const msg=payload.stories.length?"No official updates match these filters. Try 30 days or another source.":"No recent source-backed stories available. Check source health or retry.";
  list.append(el("div","empty",msg));return;
 }
 for(const s of shown){
  const item=el("article","news-card"),top=el("div","card-top");
  const existing=workspace.drafts[s.id];
  append(top,el("span","pill",s.publisher),el("span","pill secondary",s.category||"Official update"),el("span","pill secondary","Source-backed · unverified"));
  if(existing)top.append(el("span","pill "+(existing.status==="Published"?"":"secondary"),existing.status));
  const title=el("h3","card-title",s.title),summary=el("p","story-summary",s.snippet||"Open the official source for the full statement.");
  const meta=el("div","story-meta");
  append(meta,el("span","",dateFmt(s.publishedAt,false,s.dateOnly)),el("span","","Editorial priority "+(s.priority||"—")));
  const actions=el("div","story-buttons"),link=el("a","outline","Open original ↗"),btn=el("button","outline dark",existing?"Continue in Studio →":"Create draft →");
  link.href=validUrl(s.url)||"#";link.target="_blank";link.rel="noopener noreferrer";
  btn.type="button";btn.addEventListener("click",()=>startDraft(s));
  append(actions,link,btn);append(item,top,title,summary,meta,actions);list.append(item);
 }
}
function renderFeeds(){
 renderHealth();renderStories();
 const note=$("error"),warnings=payload.warnings||[];
 if(warnings.length){note.textContent="Source note: "+warnings.join(" · ");note.hidden=false}else note.hidden=true;
 $("lastFetch").textContent=payload.fetchedAt?"Updated "+dateFmt(payload.fetchedAt):"Awaiting feed response";
}
async function refresh(){
 if(loading)return;loading=true;
 $("refresh").disabled=true;$("refresh").textContent="Checking official feeds…";
 try{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),27000);
  let response;
  try{response=await fetch("/.netlify/functions/official-feed",{signal:controller.signal,cache:"no-store"})}finally{clearTimeout(timer)}
  const data=await response.json();
  if(!response.ok&&!Array.isArray(data.sources))throw Error(data.error||"Feed request failed");
  payload=data;
 }catch(e){payload={stories:[],sources:[],warnings:["Could not retrieve RSS: "+String(e.message||e)]}}
 finally{loading=false;$("refresh").disabled=false;$("refresh").textContent="↻ Refresh official feeds";renderFeeds()}
}
function starter(s){
 const publisher=s.publisher==="RBI"?"Reserve Bank of India":"Securities and Exchange Board of India";
 return publisher+" update: "+s.title;
}
function startDraft(s){
 if(!s?.id||!validUrl(s.url))return;
 if(!workspace.drafts[s.id]){
  const ts=new Date().toISOString();
  workspace.drafts[s.id]={id:s.id,source:{id:s.id,title:s.title,snippet:s.snippet||"",url:s.url,publisher:s.publisher,category:s.category||"Official update",publishedAt:s.publishedAt,dateOnly:!!s.dateOnly},
   variants:{news:starter(s),insight:""},variant:"news",status:"Draft",verified:false,sourceLink:false,publishedText:"",xUrl:"",risks:[],createdAt:ts,updatedAt:ts};
  persist();
 }
 selectedId=s.id;navigate("studio");
}
function markEdited(d){
 if(d.status==="Published")return;
 d.status="Draft";d.verified=false;d.updatedAt=new Date().toISOString();
 persist();
}
function buildText(d){
 if(!d)return"";
 if(d.status==="Published"&&d.publishedText)return d.publishedText;
 const prefix=(workspace.disclosure||"").trim(),body=(d.variants[d.variant]||"").trim();
 const from="Source: "+d.source.publisher+(d.sourceLink?" "+d.source.url:"");
 return [prefix,body,from].filter(Boolean).join("\n\n");
}
function updatePreview(){
 const d=current();if(!d)return;
 const text=buildText(d),length=text.length;
 $("studioPreview").textContent=text||"Start writing your post";
 $("studioCount").textContent=length+" / 280 estimated characters (links may be weighted differently)";
 $("studioCount").classList.toggle("over-limit",length>280);
 $("draftStatus").textContent=d.status;
 $("sourceVerified").checked=!!d.verified;
 $("markReady").disabled=d.status==="Published"||!d.verified||!d.variants[d.variant]?.trim()||length>280;
 $("markReady").textContent=d.status==="Published"?"Already published":d.status==="Ready"?"Ready ✓":"Mark ready";
 $("copyFinal").disabled=!["Ready","Published"].includes(d.status)||length>280;
 $("recordPublished").disabled=d.status!=="Ready";
 $("publishedUrl").disabled=d.status==="Published";
 $("publishedUrl").value=d.xUrl||"";
 $("studioText").disabled=d.status==="Published";
 $("sourceLinkToggle").disabled=d.status==="Published";
 $("aiGenerate").disabled=d.status==="Published"||generating;
 $("sourceVerified").disabled=d.status==="Published";
 $("disclosure").disabled=false;
 $("recordMessage").textContent=d.status==="Published"?"Published X URL saved in this browser.":"";
}
function renderStudio(){
 const entries=allDrafts(),has=!!entries.length;
 $("studioEmpty").hidden=has;$("studioEditor").hidden=!has;
 if(!has)return;
 if(!current())selectedId=entries[0].id;
 const d=current();if(!d)return;
 const sel=$("draftSelect");sel.replaceChildren();
 for(const x of entries){
  const opt=el("option","",x.source.publisher+" · "+x.source.title.slice(0,90));
  opt.value=x.id;opt.selected=x.id===selectedId;sel.append(opt);
 }
 $("studioStoryTitle").textContent=d.source.title;
 $("studioSourceMeta").textContent=d.source.publisher+" · "+dateFmt(d.source.publishedAt,true,d.source.dateOnly)+" · "+d.source.category;
 $("studioSourceLink").href=validUrl(d.source.url)||"#";
 document.querySelectorAll("[data-variant]").forEach(b=>b.classList.toggle("selected",b.dataset.variant===d.variant));
 $("studioText").value=d.variants[d.variant]||"";
 $("sourceLinkToggle").checked=!!d.sourceLink;
 $("disclosure").value=workspace.disclosure||"";
 const risks=$("draftRisks");risks.hidden=!d.risks?.length;risks.textContent=d.risks?.length?"AI draft review notes: "+d.risks.join(" · "):"";
 updatePreview();
}
function renderPublished(){
 const box=$("publishedList");box.replaceChildren();
 const posts=allDrafts().filter(x=>x.status==="Published");
 if(!posts.length){box.append(el("div","empty roomy","Nothing recorded as published yet. Prepare and review a draft in Content Studio, publish manually in X, then record its link here."));return}
 for(const d of posts){
  const item=el("article","panel published-card"),top=el("div","card-top");
  append(top,el("span","pill",d.source.publisher),el("span","pill","Published manually"));
  const headline=el("h3","",d.source.title),post=el("p","published-text",d.publishedText||"");
  const links=el("div","story-buttons"),original=el("a","outline","Original source ↗"),published=el("a","outline dark","View published X post ↗");
  original.href=validUrl(d.source.url)||"#";published.href=validUrl(d.xUrl)||"#";
  original.target=published.target="_blank";original.rel=published.rel="noopener noreferrer";
  append(links,original,published);append(item,top,headline,post,links);box.append(item);
 }
}
async function generate(){
 const d=current();if(!d||generating||d.status==="Published")return;
 if(!managerKey){notify("AI is optional. Enter the existing manager access key in ‘AI drafting setup’, and configure server-side keys in Netlify. You can continue drafting manually.",true);return}
 generating=true;$("aiGenerate").disabled=true;$("aiGenerate").textContent="Generating…";
 try{
  const result=await fetch("/.netlify/functions/draft",{method:"POST",headers:{"Content-Type":"application/json","x-manager-key":managerKey},body:JSON.stringify({title:d.source.title,snippet:d.source.snippet,publisher:d.source.publisher,publishedAt:d.source.publishedAt,sourceUrl:d.source.url})});
  const body=await result.json();
  if(!result.ok)throw Error(body.error||"AI drafting unavailable");
  if(typeof body.news!=="string"||typeof body.insight!=="string")throw Error("Unexpected drafting response");
  d.variants={news:body.news,insight:body.insight};d.variant="news";
  d.risks=Array.isArray(body.risks)?body.risks.slice(0,10).map(String):[];
  markEdited(d);notify("AI variants generated. Validate every claim using the original source before marking ready.");
  renderStudio();
 }catch(e){notify(String(e.message||e)+". Manual drafting remains available.",true)}
 finally{generating=false;$("aiGenerate").disabled=false;$("aiGenerate").textContent="✦ Generate AI variants"}
}
function sourceURLAccepted(raw){
 try{const u=new URL(raw);return ["x.com","www.x.com","twitter.com","www.twitter.com"].includes(u.hostname)&&/^\/[a-zA-Z0-9_]+\/status\/\d+\/?$/.test(u.pathname)?u.href:null}catch{return null}
}
document.addEventListener("click",e=>{
 const b=e.target.closest("button[data-view]");if(b)navigate(b.dataset.view);
});
$("refresh").addEventListener("click",refresh);
$("sourceTabs").addEventListener("click",e=>{
 const b=e.target.closest("button[data-source]");if(!b)return;
 source=b.dataset.source;document.querySelectorAll("button[data-source]").forEach(x=>x.classList.toggle("selected",x===b));renderStories();
});
$("window").addEventListener("change",e=>{windowDays=Number(e.target.value);renderStories()});
$("search").addEventListener("input",e=>{search=e.target.value.trim().toLowerCase();renderStories()});
$("draftSelect").addEventListener("change",e=>{selectedId=e.target.value;renderStudio()});
document.querySelectorAll("[data-variant]").forEach(b=>b.addEventListener("click",()=>{
 const d=current();if(!d||d.status==="Published")return;
 if(d.variant===b.dataset.variant)return;d.variant=b.dataset.variant;markEdited(d);renderStudio();
}));
$("studioText").addEventListener("input",e=>{
 const d=current();if(!d||d.status==="Published")return;
 d.variants[d.variant]=e.target.value;markEdited(d);updatePreview();
});
$("sourceLinkToggle").addEventListener("change",e=>{
 const d=current();if(!d||d.status==="Published")return;
 d.sourceLink=e.target.checked;markEdited(d);updatePreview();
});
$("disclosure").addEventListener("change",e=>{
 workspace.disclosure=e.target.value.trim().slice(0,400);
 // Changing a shared compliance prefix invalidates all unpublished Ready drafts.
 for(const d of allDrafts()){if(d.status==="Ready"){d.status="Draft";d.verified=false}}
 persist();renderStudio();notify("Disclosure changed. Recheck source and disclosure before marking ready.");
});
$("sourceVerified").addEventListener("change",e=>{
 const d=current();if(!d||d.status==="Published")return;
 d.verified=e.target.checked;if(!d.verified)d.status="Draft";
 d.updatedAt=new Date().toISOString();persist();updatePreview();
});
$("markReady").addEventListener("click",()=>{
 const d=current();if(!d||d.status==="Published")return;
 const text=buildText(d);
 if(!d.verified||!d.variants[d.variant]?.trim()||!text||text.length>280){notify("Verify the original, finish the draft, and ensure it fits the character limit.",true);return}
 d.status="Ready";d.updatedAt=new Date().toISOString();persist();updatePreview();
 notify("Draft is marked Ready in this browser. Check Geojit compliance requirements before copying or publishing.");
});
$("copyFinal").addEventListener("click",async()=>{
 const d=current();if(!d||!["Ready","Published"].includes(d.status))return;
 const text=buildText(d);if(!text||text.length>280)return;
 try{await navigator.clipboard.writeText(text);notify("Final text copied. Publication on X is completely manual.")}
 catch(e){notify("Clipboard access was blocked by your browser. Select the preview and copy it manually.",true)}
});
$("recordPublished").addEventListener("click",()=>{
 const d=current();if(!d||d.status!=="Ready")return;
 const actual=sourceURLAccepted($("publishedUrl").value.trim());
 if(!actual){$("recordMessage").textContent="Enter a valid X post URL such as https://x.com/account/status/123456789";return}
 d.publishedText=buildText(d);d.xUrl=actual;d.status="Published";d.updatedAt=new Date().toISOString();
 persist();renderStudio();renderPublished();notify("Manual publication recorded in this browser. This is not a compliance archive.");
});
$("saveManagerKey").addEventListener("click",()=>{
 managerKey=$("managerKey").value.trim();
 if(managerKey){try{sessionStorage.setItem("signaldesk:manager:key",managerKey)}catch{}notify("Manager key saved for this tab. AI drafting also requires a configured Netlify OpenAI key.")}
 else {try{sessionStorage.removeItem("signaldesk:manager:key")}catch{}notify("Manager key cleared. Manual editing remains available.")}
 $("managerKey").value="";
});
$("aiGenerate").addEventListener("click",generate);
const initialView=location.hash.replace("#","");
updateNavCounts();navigate(initialView,false);refresh();
})();