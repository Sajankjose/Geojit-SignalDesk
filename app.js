(() => {
"use strict";
const $=s=>document.querySelector(s);
const safe=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const href=s=>{try{const u=new URL(s);return /^https:$/.test(u.protocol)?u.href:"#"}catch{return "#"}};
const todayIST=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const dayKey="signaldesk:day:"+todayIST();
const time=s=>{try{return new Date(s).toLocaleString("en-IN",{timeZone:"Asia/Kolkata",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})+" IST"}catch{return "Time unavailable"}};
const load=(k,def)=>{try{return JSON.parse(localStorage.getItem(k))??def}catch{return def}};
for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k?.startsWith("signaldesk:day:")&&k!==dayKey){localStorage.removeItem(k);i--}}
let state=load(dayKey,{drafts:{},manual:[],settings:{disclosure:""},seen:{}});
state.drafts ||= {};state.manual ||= [];state.savedStories ||= {};state.seen ||= {};state.settings ||= {};
let feed=[],errors=[],sourceStatus=[],busy=false,active="today",selected=null,filter="all",query="",token=sessionStorage.getItem("signaldesk:key")||"";
let serverReady=false,saveTimer=null,saving=false,dirty=false,syncError="";
const storageURL="/.netlify/functions/workspace";
function markSync(s){const e=$("#syncIndicator");if(e){e.textContent=s;e.title=s}}
function localPersist(){localStorage.setItem(dayKey,JSON.stringify(state))}
function persist(){
  localPersist();
  if(!serverReady){markSync("Offline · local only");return}
  dirty=true;markSync("Saving…");clearTimeout(saveTimer);
  saveTimer=setTimeout(()=>{void flushWorkspace()},450);
}
async function flushWorkspace(){
  if(!serverReady)return false;
  clearTimeout(saveTimer);
  if(saving){while(saving)await new Promise(resolve=>setTimeout(resolve,40));if(!dirty)return !syncError}
  saving=true;
  try{
    while(dirty){
      dirty=false;
      const snapshot=JSON.stringify(state);
      const res=await fetch(storageURL,{method:"PUT",headers:{"Content-Type":"application/json","x-manager-key":token},body:snapshot,cache:"no-store"});
      const body=await res.json();
      if(!res.ok)throw Error(body.error||"Cloud save failed");
    }
    syncError="";markSync("Saved in workspace");
    return true;
  }catch(e){
    dirty=true;syncError=String(e.message||e);markSync("Not saved · retry");
    toast("Workspace sync failed: "+syncError);
    return false;
  }finally{saving=false}
}
async function initialiseWorkspace(){
  if(!token)return false;
  markSync("Connecting…");
  try{
    const res=await fetch(storageURL,{headers:{"x-manager-key":token},cache:"no-store"});
    const data=await res.json();
    if(res.status===401){sessionStorage.removeItem("signaldesk:key");token="";$("#accessDialog").showModal();throw Error("Invalid manager key")}
    if(!res.ok)throw Error(data.error||"Workspace unavailable");
    const previous=state;
    state=data.state;
    state.drafts ||= {};state.manual ||= [];state.savedStories ||= {};state.seen ||= {};state.settings ||= {};
    serverReady=true;syncError="";markSync("Workspace connected");
    if(!data.persisted&&(Object.keys(previous.drafts||{}).length||(previous.manual||[]).length)){
      state=previous;state.savedStories ||= {};persist();await flushWorkspace();
    }else localPersist();
    render();return true;
  }catch(e){serverReady=false;syncError=String(e.message||e);markSync("Offline · local only");toast("Unable to load workspace: "+syncError);render();return false}
}
async function initialise(){const ok=await initialiseWorkspace();if(ok)await fetchNews()}

const toast=s=>{const e=$("#toast");e.textContent=s;e.style.display="block";clearTimeout(toast.t);toast.t=setTimeout(()=>e.style.display="none",4000)};
const stories=()=>[...new Map([...state.manual,...Object.values(state.savedStories),...feed].map(s=>[s.id,s])).values()].sort((a,b)=>((b.score||0)-(a.score||0))||new Date(b.publishedAt)-new Date(a.publishedAt));
const get=id=>stories().find(s=>s.id===id);
const selectedStory=()=>get(selected);
const draft=id=>state.drafts[id]||null;
const status=id=>draft(id)?.status||"New";
const finalText=id=>{
  const s=get(id),d=draft(id);if(!s||!d)return"";
  if(d.status==="Published"&&d.publishedText)return d.publishedText;
  const prefix=(state.settings.disclosure||"").trim(),body=(d.variants?.[d.variant]||"").trim();
  const attribution="Source: "+s.publisher+(d.sourceLink?" "+s.url:"");
  return [prefix,body,attribution].filter(Boolean).join("\n\n");
};
const summaryCounts=()=>{
const d=Object.values(state.drafts);
return {stories:stories().length, drafts:d.filter(x=>["Draft","Ready"].includes(x.status)).length,ready:d.filter(x=>x.status==="Ready").length,published:d.filter(x=>x.status==="Published").length};
};
const badge=(text,kind="")=>'<span class="badge '+kind+'">'+safe(text)+'</span>';
function layout(inner){$("#content").innerHTML='<div class="content-inner">'+inner+'<p class="footer-note">SignalDesk is a manager-controlled content preparation tool. Headlines/excerpts are NOT independently fact-checked. Review the original publisher or primary source before using any statement. No automatic X publishing.</p></div>'}
function storyHtml(s,compact=false){
const d=draft(s.id),official=s.official,description=s.snippet||"Open the original article to verify the full context.";
return '<article class="'+(compact?"story":"card story-card")+'"><div class="story-line">'+badge(s.publisher,official?"official":"")+badge(s.category||"Finance","neutral")+
 (d?badge(d.status,d.status==="Published"?"official":d.status==="Ready"?"":"neutral"):"")+
 '</div><h3>'+safe(s.title)+'</h3><p>'+safe(description).slice(0,360)+'</p><div class="meta"><span>'+safe(time(s.publishedAt))+'</span><span>Priority '+safe(s.score||"—")+'</span>'+
 (s.relatedSources?.length?'<span>'+s.relatedSources.length+' supporting source(s)</span>':"")+'</div>'+
 '<div class="actions"><a class="btn sm ghost" href="'+safe(href(s.url))+'" target="_blank" rel="noopener noreferrer">↗ Original source</a>'+
 '<button class="btn sm secondary" data-action="create" data-id="'+safe(s.id)+'">✎ '+(d?"Continue draft":"Create draft")+'</button>'+(!d?'<button class="btn sm ghost" data-action="skip" data-id="'+safe(s.id)+'">Skip</button>':'')+'</div></article>';
}
const empty=(a,b)=>'<div class="empty"><strong>'+safe(a)+'</strong>'+safe(b)+'</div>';
const notices=()=>errors.length?'<div class="notice warning"><strong>Source update notes:</strong> '+errors.map(s=>safe(s)).join(" · ")+'</div>':"";
function pageToday(){
const c=summaryCounts(),pool=stories().slice(0,5),target=Math.min(c.published,6);
layout('<div class="hero"><div><h1>Your editorial day, simplified.</h1><p>Discover credible stories, turn them into Geojit-style posts and publish manually after verification.</p></div><button class="btn primary" data-page="discover">Explore stories →</button></div>'+
'<div class="kpis"><div class="kpi accent"><div class="num">'+target+' / 6</div><div class="lab">Manually published today</div></div><div class="kpi"><div class="num">'+c.stories+'</div><div class="lab">Stories discovered</div></div><div class="kpi"><div class="num">'+c.drafts+'</div><div class="lab">In the studio</div></div><div class="kpi"><div class="num">'+c.ready+'</div><div class="lab">Ready for X</div></div></div>'+
notices()+
'<div class="grid-two"><section class="panel"><div class="panel-head"><h2 class="section-title">Stories worth reviewing</h2><button class="btn sm ghost" data-page="discover">View all →</button></div>'+
(pool.length?pool.map(s=>storyHtml(s,true)).join(""):empty("No fetched stories yet","Use Refresh stories, connect a licensed provider, or add an original link manually in Discover."))+'</section>'+
'<section class="panel"><div class="panel-head"><h2 class="section-title">Today’s publishing desk</h2>'+badge(c.published+" published","official")+'</div>'+
'<div class="section-desc">Six is an editorial target, never a reason to publish unverified or repetitive material.</div>'+
(Object.entries(state.drafts).length?Object.entries(state.drafts).map(([id,d])=>{const s=get(id);return s?'<div class="list-row"><div><strong>'+safe(s.title)+'</strong><div class="meta">'+badge(d.status,d.status==="Published"?"official":d.status==="Ready"?"":"neutral")+'</div></div><button class="btn sm" data-action="edit" data-id="'+safe(id)+'">Open</button></div>':''}).join("")+
'<div class="divider"></div>':'<div class="notice">The manager selects stories for the editorial queue. No AI autoposts and no preset filler content.</div>')+
'<button class="btn secondary" style="width:100%;margin-top:15px" data-page="published">View publishing status →</button></section></div>');
}
function pageDiscover(){
const all=stories().filter(s=>(filter==="skipped"?!!state.seen[s.id]:!state.seen[s.id]&&(filter==="all"||filter==="official"&&s.official||filter==="drafted"&&!!draft(s.id)||filter==="undrafted"&&!draft(s.id)))&&
 (s.title+" "+s.publisher+" "+s.snippet).toLowerCase().includes(query.toLowerCase()));
const tabs=[["all","All"],["official","Official"],["undrafted","Not drafted"],["drafted","In studio"],["skipped","Skipped"]];
layout('<div class="hero"><div><h1>Discover & curate</h1><p>Current-day stories, ranked for Indian investor relevance. Every card links to its source.</p></div><button class="btn secondary" data-action="refresh">↻ Fetch latest</button></div>'+notices()+
'<div class="toolbar"><input class="input search" id="storySearch" type="search" value="'+safe(query)+'" placeholder="Search stories, publishers, keywords"><div class="tabs">'+tabs.map(([k,l])=>'<button data-filter="'+k+'" class="'+(filter===k?"active":"")+'">'+l+'</button>').join("")+'</div></div>'+
'<div class="feed">'+(all.length?all.map(s=>storyHtml(s)).join(""):empty("No matching sources","Adjust the filters or check source connectivity."))+'</div>'+
'<section class="panel" style="margin-top:20px"><details class="manual-details"><summary>+ Add a verified source manually (useful for Reuters, Bloomberg or approved Geojit Research)</summary>'+
'<form id="manualForm"><div class="field"><label class="label" for="mTitle">Headline</label><input id="mTitle" required maxlength="250" placeholder="Accurate original headline"></div>'+
'<div class="field"><label class="label" for="mPublisher">Original publisher</label><input id="mPublisher" required maxlength="70" placeholder="e.g. Reuters"></div>'+
'<div class="field"><label class="label" for="mUrl">Original article URL (HTTPS)</label><input id="mUrl" type="url" required placeholder="https://..."></div>'+
'<div class="field"><label class="label" for="mSummary">Verified facts or summary (optional)</label><textarea id="mSummary" maxlength="700" placeholder="Only facts that you have read and checked; no article copy-pasting"></textarea></div>'+
'<button class="btn primary" type="submit">Add to today’s desk</button></form></details></section>');
}
function startDraft(id){
const s=get(id);if(!s)return;
state.savedStories[id]=s;if(!state.drafts[id])state.drafts[id]={status:"Draft",verified:false,variant:"news",variants:{news:s.title,insight:""},sourceLink:false,xUrl:"",hashtags:[],risks:[]};
selected=id;persist();active="studio";render();toast("Headline starter loaded. Verify source and use AI to draft in Geojit voice.");
}
function pageStudio(){
const ids=Object.keys(state.drafts).filter(id=>!!get(id));
if(!selected||!get(selected)||!draft(selected))selected=ids[0]||null;
if(!selected){layout('<div class="hero"><div><h1>Content Studio</h1><p>Turn a sourced story into an investor-friendly post.</p></div></div>'+empty("No draft selected","Choose a story from Discover to start writing.")+'<button class="btn primary" data-page="discover">Discover stories →</button>');return}
const s=get(selected),d=draft(selected),output=finalText(selected),over=output.length>280;
const invalid=(!serverReady||!d.verified||!(state.settings.disclosure||"").trim()||!d.variants?.[d.variant]?.trim()||over);
const line=(s.relatedSources||[]).filter(x=>x.url&&x.publisher).map(x=>'<a href="'+safe(href(x.url))+'" target="_blank" rel="noopener">'+safe(x.publisher)+'</a>').join(", ");
layout('<div class="hero"><div><h1>Content Studio</h1><p>Keep source facts separate from interpretation. Verify before marking ready.</p></div>'+
'<select id="draftSelect" aria-label="Choose draft">'+ids.map(id=>'<option value="'+safe(id)+'" '+(selected===id?"selected":"")+'>'+safe(get(id).title.slice(0,50))+'</option>').join("")+'</select></div>'+
'<div class="studio-grid"><section class="panel"><div class="panel-head"><h2 class="section-title">Write in Geojit’s voice</h2>'+badge(d.status,d.status==="Published"?"official":"")+'</div>'+
'<div class="field"><label class="label">Writing angle</label><div class="tabs"><button data-variant="news" '+(d.status==="Published"?"disabled":"")+' class="'+(d.variant==="news"?"active":"")+'">News update</button><button data-variant="insight" '+(d.status==="Published"?"disabled":"")+' class="'+(d.variant==="insight"?"active":"")+'">Investor insight</button></div></div>'+
'<div class="field"><label class="label">Editable post text (excluding disclosure and source line)</label><textarea id="draftText" rows="7" '+(d.status==="Published"?"disabled":"")+' placeholder="Generate a brand-aligned version or write a factual post manually">'+safe(d.variants?.[d.variant]||"")+'</textarea></div>'+
'<div class="actions"><button class="btn primary" id="generateBtn" data-action="generate" '+(busy||d.status==="Published"?"disabled":"")+'>'+ (busy?"Generating…":"✦ Generate Geojit-tone drafts")+'</button><button class="btn secondary" data-action="simplify" '+(d.status==="Published"?"disabled":"")+'>Make concise</button></div>'+
(d.risks?.length?'<div class="notice warning"><b>AI/editorial cautions</b><br>'+d.risks.map(safe).join("<br>")+'</div>':"")+
'<div class="divider"></div><div class="field"><label class="label">X post preview · Disclosure + text + source attribution</label><div class="compose-preview"><div class="user-row"><span class="user-icon">G</span><span><b>Geojit</b><br><span class="muted tiny">Draft · Nothing is published from here</span></span></div><div class="tweet">'+safe(output||"Start your draft")+'</div></div><div class="counter '+(over?"over":"")+'">'+output.length+' / 280 estimated characters</div></div>'+
'<label class="checkline"><input id="addSourceLink" type="checkbox" '+(d.status==="Published"?"disabled ":"")+(d.sourceLink?"checked":"")+'> Include original article link in the post (uses characters)</label>'+
'<div class="divider"></div><label class="checkline"><input type="checkbox" id="verifiedCheck" '+(d.status==="Published"?"disabled ":"")+(d.verified?"checked":"")+'> I opened the original source and verified the date, numbers, meaning, disclosure and final wording. I accept responsibility for publishing.</label>'+
(!state.settings.disclosure?.trim()?'<div class="notice warning">Approved SEBI disclosure prefix is missing. Add it in Settings before preparing a final post.</div>':"")+
(!serverReady?'<div class="notice warning">Workspace unavailable. Draft locally, then reconnect before marking Ready.</div>':"")+
'<div class="actions"><button class="btn primary" data-action="ready" '+(invalid?"disabled":"")+'>✓ Mark as ready</button><button class="btn secondary" data-action="copy" '+(d.status!=="Ready"&&d.status!=="Published"?"disabled":"")+'>Copy post</button><button class="btn secondary" data-action="openX" '+(d.status!=="Ready"&&d.status!=="Published"?"disabled":"")+'>↗ Open X</button></div>'+
'<p class="section-desc">Publishing happens manually on X. Return to Published to record the link. Edits after Ready automatically revert to Draft.</p></section>'+
'<section class="panel"><div class="panel-head"><h2 class="section-title">Source evidence</h2>'+badge(s.official?"Official regulator":"Publisher / manual",s.official?"official":"neutral")+'</div><h3>'+safe(s.title)+'</h3>'+
'<div class="meta">'+safe(s.publisher)+' · '+safe(time(s.publishedAt))+'</div>'+
'<div class="source-facts" style="margin-top:18px"><b class="tiny">SOURCE EXCERPT (not fully verified)</b><p>'+safe(s.snippet||"No excerpt available. Read the full original source.")+'</p></div>'+
'<div class="actions"><a class="btn primary" href="'+safe(href(s.url))+'" target="_blank" rel="noopener noreferrer">↗ Read original source</a></div>'+
(line?'<p class="section-desc">Additional sources: '+line+'</p>':"")+
'<div class="divider"></div><h2 class="section-title">Editorial guidance</h2>'+
'<div class="notice">State what happened. Explain why it may matter to investors. Avoid predictions, hype, guaranteed returns or unsupported numerical claims. No independent stock recommendations.</div>'+
'<p class="section-desc">AI sees only the metadata/excerpt displayed here, NOT the full copyrighted article. Always inspect the source yourself.</p></section></div>');
}
function pagePublished(){
const ids=Object.keys(state.drafts).filter(x=>get(x)); const entries=ids.filter(id=>["Ready","Published","Draft"].includes(status(id)));
layout('<div class="hero"><div><h1>Publishing tracker</h1><p>Manager-only manual X publishing. Status is not inferred from X.</p></div></div>'+
'<section class="panel"><div class="panel-head"><h2 class="section-title">Today’s content statuses</h2>'+badge(summaryCounts().published+" published","official")+'</div>'+
(entries.length?entries.map(id=>{const d=draft(id),s=get(id);return '<div class="story"><div class="story-line">'+badge(d.status,d.status==="Published"?"official":d.status==="Ready"?"":"neutral")+'<span class="muted tiny">'+safe(s.publisher)+'</span></div><h3>'+safe(s.title)+'</h3>'+
(d.xUrl?'<p><a target="_blank" rel="noopener" href="'+safe(href(d.xUrl))+'">↗ View recorded X post</a></p>':"")+
'<div class="actions"><button class="btn sm secondary" data-action="edit" data-id="'+safe(id)+'">Open draft</button>'+
(d.status==="Ready"?'<button class="btn sm" data-action="copy" data-id="'+safe(id)+'">Copy post</button><button class="btn sm" data-action="openX">Open X</button><button class="btn sm primary" data-action="record" data-id="'+safe(id)+'">Record published link</button>':"")+'</div></div>'}).join(""):empty("No content to track yet","Create a draft from Discover."))+'</section>');
}
function pageSettings(){
layout('<div class="hero"><div><h1>Workspace settings</h1><p>One social media manager. No publishing automation or approval hierarchy.</p></div></div>'+
'<div class="grid-two"><section class="panel"><h2 class="section-title">Compliance prefix</h2>'+
'<p class="section-desc">For securities-market content, enter the exact registered name and relevant SEBI registration number(s) approved by Geojit Compliance. This text will appear at the beginning of the composed post.</p>'+
'<form id="settingsForm"><div class="field"><label class="label" for="disclosureInput">Approved prefix</label><textarea id="disclosureInput" rows="3" placeholder="Approved registered name + SEBI registration number(s)">'+safe(state.settings.disclosure||"")+'</textarea></div>'+
'<button class="btn primary" type="submit">Save for today</button></form>'+
'<div class="divider"></div><h2 class="section-title">Access</h2><p class="section-desc">An individual access key is entered each browser session. Protect the entire Netlify deployment for production.</p><button class="btn secondary" data-action="changeKey">Change manager key</button></section>'+
'<section class="panel"><h2 class="section-title">Connected systems</h2><div class="list-row"><strong>Official RSS news ingestion</strong>'+badge("RBI & SEBI","official")+'</div>'+
'<div class="list-row"><strong>Licensed news provider</strong>'+badge(sourceStatus.some(x=>x.name==="NewsAPI"&&x.ok)?"Connected":"Optional","neutral")+'</div>'+
'<div class="list-row"><strong>AI writing (OpenAI)</strong>'+badge("Server-side optional","neutral")+'</div>'+
'<div class="list-row"><strong>X/Twitter API</strong>'+badge("Not connected","neutral")+'</div>'+
'<p class="section-desc" style="margin-top:17px">Configure MANAGER_ACCESS_KEY and OPENAI_API_KEY in Netlify. NEWSAPI_KEY requires an eligible paid licence and appropriate publisher rights. Nothing belongs in GitHub secrets committed as code.</p></section></div>');
}
function render(){
const titles={today:"Today’s desk",discover:"Discover stories",studio:"Content Studio",published:"Publishing tracker",settings:"Settings"};
$("#pageTitle").textContent=titles[active];$("#todayDate").textContent=new Date().toLocaleDateString("en-IN",{timeZone:"Asia/Kolkata",weekday:"short",day:"numeric",month:"short",year:"numeric"});
document.querySelectorAll("[data-page]").forEach(b=>b.classList.toggle("active",b.dataset.page===active));
if(active==="today")pageToday();else if(active==="discover")pageDiscover();else if(active==="studio")pageStudio();else if(active==="published")pagePublished();else pageSettings();
}
async function fetchNews(){
if(!token){$("#accessDialog").showModal();return}
busy=true;$("#refreshBtn").disabled=true;
try{
const res=await fetch("/.netlify/functions/news",{headers:{"x-manager-key":token},cache:"no-store"});
const data=await res.json();
if(res.status===401){sessionStorage.removeItem("signaldesk:key");token="";$("#accessDialog").showModal();throw Error("Invalid manager access key")}
if(!res.ok)throw Error(data.error||"Feed server unavailable");
feed=Array.isArray(data.stories)?data.stories:[];errors=data.errors||[];sourceStatus=data.sources||[];
toast(feed.length+" source-backed stories refreshed");
}catch(e){errors=[String(e.message||e)];if(!feed.length)toast("Sources unavailable; manual source entry remains available")}
finally{busy=false;$("#refreshBtn").disabled=false;render()}
}
async function generate(){
const s=selectedStory(),d=draft(selected);if(!s||!d||busy)return;
if(!token){$("#accessDialog").showModal();return}
busy=true;render();
try{
const res=await fetch("/.netlify/functions/draft",{method:"POST",headers:{"Content-Type":"application/json","x-manager-key":token},body:JSON.stringify({title:s.title,snippet:s.snippet,publisher:s.publisher,sourceUrl:s.url,publishedAt:s.publishedAt})});
const out=await res.json();if(!res.ok)throw Error(out.error||"AI drafting failed");
d.variants={news:out.news,insight:out.insight};d.verified=false;d.status="Draft";d.risks=out.risks||[];d.hashtags=out.hashtags||[];
persist();toast("Two AI drafts ready. Validate every claim against the original.");
}catch(e){toast(String(e.message||e))}
finally{busy=false;render()}
}
const redraw=()=>{persist();render()};
async function copyText(text){
try{await navigator.clipboard.writeText(text);toast("Copied. Publish manually in X.")}catch{const t=document.createElement("textarea");t.value=text;document.body.append(t);t.select();document.execCommand("copy");t.remove();toast("Copied to clipboard")}
}
function editFrom(id){if(get(id)&&draft(id)){selected=id;active="studio";render()}}
document.addEventListener("click",async e=>{
const b=e.target.closest("button");if(!b)return;
if(b.dataset.page){active=b.dataset.page;render();return}
if(b.dataset.filter){filter=b.dataset.filter;render();return}
if(b.dataset.variant&&selected){const d=draft(selected);if(d.status==="Published")return;d.variant=b.dataset.variant;redraw();return}
const action=b.dataset.action,id=b.dataset.id||selected,d=draft(id);
switch(action){
case "refresh":await fetchNews();break;
case "create":startDraft(id);break;
case "skip":state.seen[id]=true;redraw();toast("Story skipped for today.");break;
case "edit":editFrom(id);break;
case "generate":await generate();break;
case "simplify":if(d){if(d.status==="Published")return;const t=d.variants?.[d.variant]||"";d.variants[d.variant]=t.replace(/\s+/g," ").trim();d.status="Draft";d.verified=false;redraw();toast("Whitespace reduced; revise the draft manually.")}break;
case "ready":if(d){if(!serverReady||!d.verified||!state.settings.disclosure?.trim()||finalText(id).length>280){toast("Check source, regulatory prefix and 280-character limit.");break}d.status="Ready";redraw();if(await flushWorkspace())toast("Verified and saved. Ready for manual X publishing.");else{d.status="Draft";redraw();toast("Could not save Ready state.")}}break;
case "copy":if(d&&["Ready","Published"].includes(d.status))await copyText(finalText(id));break;
case "openX":window.open("https://x.com/compose/post","_blank","noopener,noreferrer");break;
case "record":if(d&&d.status==="Ready"){const u=prompt("Paste the actual published X post URL (x.com/.../status/123...).");if(!u)return;try{const parsed=new URL(u);if(!["x.com","www.x.com","twitter.com","www.twitter.com"].includes(parsed.hostname)||!/^\/[A-Za-z0-9_]+\/status\/\d+/.test(parsed.pathname))throw Error();d.publishedText=finalText(id);d.xUrl=parsed.href;d.status="Published";redraw();if(await flushWorkspace())toast("Published URL recorded in workspace.");else toast("Published URL saved locally; workspace sync failed.")}catch{toast("Please paste a valid published X status URL.")}}break;
case "changeKey":sessionStorage.removeItem("signaldesk:key");token="";$("#accessDialog").showModal();break;
}
});
document.addEventListener("input",e=>{
if(e.target.id==="storySearch"){query=e.target.value;const pos=e.target.selectionStart;render();const n=$("#storySearch");if(n){n.focus();n.setSelectionRange(pos,pos)}}
if(e.target.id==="draftText"&&selected){const d=draft(selected);if(d.status==="Published")return;d.variants[d.variant]=e.target.value;d.status="Draft";d.verified=false;persist();const output=finalText(selected);const preview=document.querySelector(".tweet");if(preview)preview.textContent=output;const count=document.querySelector(".counter");if(count){count.textContent=output.length+" / 280 estimated characters";count.classList.toggle("over",output.length>280)}const check=document.querySelector("#verifiedCheck");if(check)check.checked=false;const ready=document.querySelector('[data-action="ready"]');if(ready)ready.disabled=true}
});
document.addEventListener("change",e=>{
if(e.target.id==="draftSelect"){selected=e.target.value;render()}
if(e.target.id==="verifiedCheck"){const d=draft(selected);if(d.status==="Published")return;d.verified=e.target.checked;if(d.status==="Ready")d.status="Draft";redraw()}
if(e.target.id==="addSourceLink"){const d=draft(selected);if(d.status==="Published")return;d.sourceLink=e.target.checked;d.verified=false;if(d.status==="Ready")d.status="Draft";redraw()}
});
document.addEventListener("submit",e=>{
if(e.target.id==="accessForm"){e.preventDefault();token=$("#accessInput").value.trim();sessionStorage.setItem("signaldesk:key",token);$("#accessDialog").close();void initialise();return}
if(e.target.id==="settingsForm"){e.preventDefault();state.settings.disclosure=$("#disclosureInput").value.trim();for(const d of Object.values(state.drafts)){if(d.status==="Ready"){d.status="Draft";d.verified=false}}redraw();toast("Disclosure updated; workspace syncing.");return}
if(e.target.id==="manualForm"){e.preventDefault();const title=$("#mTitle").value.trim(),publisher=$("#mPublisher").value.trim(),url=href($("#mUrl").value.trim()),snippet=$("#mSummary").value.trim();if(url==="#"){toast("Use a valid HTTPS original source URL.");return}
const story={id:"manual-"+Date.now(),title,publisher,url,snippet,publishedAt:new Date().toISOString(),category:"Manual",score:55,official:false,relatedSources:[]};state.manual.unshift(story);persist();startDraft(story.id);toast("Source added for manager verification.");return}
});
$("#refreshBtn").addEventListener("click",fetchNews);
render();if(token){void initialise()}else $("#accessDialog").showModal();
})();
