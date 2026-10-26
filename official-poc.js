(()=>{
"use strict";
const $=id=>document.getElementById(id);
let payload={stories:[],sources:[],warnings:[]},source="all",windowDays=7,search="",selected=null,loading=false;
const dateFmt=(v,withYear=false)=>{const d=new Date(v);return Number.isNaN(d.getTime())?"Date unavailable":d.toLocaleString("en-IN",{timeZone:"Asia/Kolkata",day:"2-digit",month:"short",...(withYear?{year:"numeric"}:{}),hour:"2-digit",minute:"2-digit"})+" IST"};
$("clock").textContent=new Date().toLocaleDateString("en-IN",{timeZone:"Asia/Kolkata",weekday:"short",day:"numeric",month:"short",year:"numeric"});
const elt=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e};
const add=(parent,...children)=>{for(const c of children)parent.append(c);return parent};
function renderHealth(){
  $("total").textContent=payload.stories.length;
  $("todayCount").textContent=payload.stories.filter(s=>Date.now()-new Date(s.publishedAt).getTime()<=86400000).length;
  $("health").textContent=payload.sources.filter(s=>s.ok).length+" / 4";
  const box=$("sources");box.replaceChildren();
  if(!payload.sources.length){box.append(elt("p","muted","No source response yet"));return}
  for(const s of payload.sources){
    const row=elt("div","feed-status");const left=elt("span","",s.name);
    const right=elt("span","status-badge "+(s.ok?"ok":"fail"),s.ok?(s.count+" items"):"Unavailable");
    add(row,left,right);box.append(row);
  }
}
function renderStories(){
  const box=$("news");box.replaceChildren();
  const now=Date.now();
  let shown=payload.stories.filter(s=>(source==="all"||s.publisher===source)&&
    ((now-new Date(s.publishedAt).getTime())<=windowDays*86400000)&&
    (s.title+" "+s.snippet+" "+s.category).toLowerCase().includes(search));
  if(!shown.length){
    const msg=payload.stories.length?"No official updates match this filter. Try 30 days or another source.":"No recent source-backed stories available. Check the source health panel or retry.";
    box.append(elt("div","empty",msg));return;
  }
  for(const s of shown){
    const card=elt("article","news-card");
    const top=elt("div","card-top");
    add(top,elt("span","pill",s.publisher),elt("span","pill secondary",s.category),elt("span","pill secondary","Source-backed · unverified"));
    const title=elt("h3","card-title",s.title);
    const summary=elt("p","story-summary",s.snippet||"Open the official source for the complete statement.");
    const meta=elt("div","story-meta");
    add(meta,elt("span","",dateFmt(s.publishedAt)),elt("span","","Editorial priority "+s.priority));
    const actions=elt("div","story-buttons");
    const link=elt("a","outline","Open original ↗");link.href=s.url;link.target="_blank";link.rel="noopener noreferrer";
    const draft=elt("button","outline dark","Prepare manual draft");
    draft.type="button";draft.addEventListener("click",()=>openDraft(s));
    add(actions,link,draft);add(card,top,title,summary,meta,actions);box.append(card);
  }
}
function render(){
  renderHealth();renderStories();
  const warning=$("error");
  const failures=payload.warnings||[];
  if(failures.length){warning.textContent="Source note: "+failures.join(" · ");warning.hidden=false}
  else warning.hidden=true;
  $("lastFetch").textContent=payload.fetchedAt?"Updated "+dateFmt(payload.fetchedAt):"Awaiting feed response";
}
async function refresh(){
  if(loading)return;
  loading=true;$("refresh").disabled=true;$("refresh").textContent="Checking official feeds…";
  try{
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),27000);
    let res;
    try{res=await fetch("/.netlify/functions/official-feed",{signal:controller.signal,cache:"no-store"})}finally{clearTimeout(timer)}
    const data=await res.json();
    if(!res.ok&&!Array.isArray(data.sources))throw Error(data.error||"Feed request failed");
    payload=data;
  }catch(e){payload={stories:[],sources:[],warnings:["Could not retrieve RSS: "+(e?.message||String(e))]};}
  finally{loading=false;$("refresh").disabled=false;$("refresh").textContent="↻ Refresh official feeds";render()}
}
function draftValue(s){
  const p=s.publisher==="RBI"?"Reserve Bank of India":"Securities and Exchange Board of India";
  return p+" update: "+s.title+"\n\nSource: "+s.url;
}
function openDraft(s){
  selected=s;
  $("chosenSource").textContent=s.publisher+" · "+dateFmt(s.publishedAt,true)+" · "+s.category;
  $("original").href=s.url;
  $("draftBody").value=draftValue(s);
  $("verified").checked=false;
  updateCounter();$("draftDialog").showModal();
}
function updateCounter(){
  const len=$("draftBody").value.length;
  $("charCount").textContent=len+" characters (unweighted estimate; X may count links differently)";
  $("charCount").style.color=len>280?"#a13f3f":"#668078";
  $("copy").disabled=!selected||!$("verified").checked||!$("draftBody").value.trim()||len>280;
}
$("refresh").addEventListener("click",refresh);
$("sourceTabs").addEventListener("click",e=>{
  const b=e.target.closest("button[data-source]");if(!b)return;source=b.dataset.source;
  document.querySelectorAll("button[data-source]").forEach(x=>x.classList.toggle("selected",x===b));renderStories();
});
$("window").addEventListener("change",e=>{windowDays=Number(e.target.value);renderStories()});
$("search").addEventListener("input",e=>{search=e.target.value.trim().toLowerCase();renderStories()});
$("draftBody").addEventListener("input",updateCounter);
$("verified").addEventListener("change",updateCounter);
$("closeDialog").addEventListener("click",()=>$("draftDialog").close());
$("cancel").addEventListener("click",()=>$("draftDialog").close());
$("copy").addEventListener("click",async()=>{
  if($("copy").disabled)return;
  try{await navigator.clipboard.writeText($("draftBody").value);$("copy").textContent="Copied ✓";setTimeout(()=>$("copy").textContent="Copy checked draft",1400)}
  catch{$("copy").textContent="Clipboard unavailable";}
});
refresh();
})();