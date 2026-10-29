(()=>{
"use strict";
const $=id=>document.getElementById(id);
const el=(name,cls,text)=>{const node=document.createElement(name);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node};
const append=(parent,...nodes)=>{nodes.forEach(n=>parent.append(n));return parent};
const storeKey="signaldesk:unified:poc:v1";
const read=()=>{try{const x=JSON.parse(localStorage.getItem(storeKey)||"{}");return x&&typeof x==="object"&&x.drafts&&typeof x.drafts==="object"?x:{drafts:{},disclosure:""}}catch{return {drafts:{},disclosure:""}}};
let workspace=read(),payload={stories:[],sources:[],warnings:[]},active="discover",source="all",windowDays=7,search="",rankMode="top",selectedId=null,loading=false,generating=false,marketauxStories=[],marketauxLoading=false,marketauxLoadedAt=0,pibStories=[],pibLoading=false,pibLoadedAt=0;

// In-page alerts only. They are NOT OS notifications, background checks or push delivery.
const feedStateKey="signaldesk:official-feed-tracking:v1";
function loadFeedState(){
 try{const x=JSON.parse(localStorage.getItem(feedStateKey)||"{}");return {known:Array.isArray(x.known)?x.known:[],unread:Array.isArray(x.unread)?x.unread:[]}}catch{return {known:[],unread:[]}}
}
let feedState=loadFeedState(),alertsOpen=false;
const priorityOf=s=>Math.max(0,Math.min(100,Number(s.priority)||0));
const important=s=>priorityOf(s)>=77;
function saveFeedState(){
 feedState.known=feedState.known.slice(-600);feedState.unread=feedState.unread.slice(-200);
 try{localStorage.setItem(feedStateKey,JSON.stringify(feedState))}catch{}
}
function readStory(id){
 if(!feedState.unread.includes(id))return;
 feedState.unread=feedState.unread.filter(x=>x!==id);saveFeedState();updateAlertUI();renderStories();
}
function updateAlertUI(){
 const currentNews=payload.stories||[],ids=new Set(feedState.unread);
 const recent=currentNews.filter(x=>ids.has(x.id)&&important(x));
 const count=recent.length;
 $("alertCount").hidden=count===0;$("alertCount").textContent=count>9?"9+":String(count);
 $("unreadCount").hidden=ids.size===0;$("unreadCount").textContent=String(ids.size);
 const panel=$("alertsList");panel.replaceChildren();
 if(!count)panel.append(el("p","small-muted","You're caught up. New high-priority releases will appear here when detected."));
 else for(const story of recent.slice(0,8)){
  const b=el("button","alert-story");b.type="button";
  append(b,el("span","alert-source",story.publisher+" · "+priorityOf(story)+"/100"),el("strong","",story.title));
  b.addEventListener("click",()=>{readStory(story.id);setAlertsOpen(false);startDraft(story)});
  panel.append(b);
 }
}
function setAlertsOpen(open){
 alertsOpen=open;$("alertsPanel").hidden=!open;$("alertsButton").setAttribute("aria-expanded",String(open));
 if(open)updateAlertUI();
}
function registerFeed(newStories){
 if(!newStories.length)return;
 const known=new Set(feedState.known),firstVisit=known.size===0,additions=[];
 for(const s of newStories){
  if(!known.has(s.id)){
   additions.push(s);known.add(s.id);
   if(!firstVisit&&Date.now()-Date.parse(s.publishedAt)<7*86400000)feedState.unread.push(s.id);
  }
 }
 feedState.known=[...known];
 saveFeedState();updateAlertUI();
 const newImportant=additions.filter(x=>!firstVisit&&important(x)&&feedState.unread.includes(x.id));
 $("feedAlertStatus").hidden=newImportant.length===0;
 if(newImportant.length)$("feedAlertStatus").textContent=newImportant.length+" important new update"+(newImportant.length===1?"":"s")+" since your last check. Open the alert bell to review.";
}
const parseTags=input=>[...new Set(String(input||"").split(/[\s,]+/).map(x=>x.trim()).filter(x=>/^#[a-zA-Z][a-zA-Z0-9_]{1,29}$/.test(x)))].slice(0,2);
const defaultTags=story=>Array.isArray(story.suggestedHashtags)?parseTags(story.suggestedHashtags.join(" ")):({RBI:["#RBI"],SEBI:["#SEBI"]}[story.publisher]||[]);
function renderHashtagSuggestions(d){
 const host=$("hashtagSuggestions");host.replaceChildren();
 const suggested=defaultTags(d.source);
 for(const tag of suggested){
  const b=el("button","tag-chip",(d.hashtags||[]).includes(tag)?"✓ "+tag:"+ "+tag);
  b.type="button";b.disabled=d.status==="Published";
  b.addEventListener("click",()=>{
   if(d.status==="Published")return;
   const currentTags=Array.isArray(d.hashtags)?d.hashtags:[];
   d.hashtags=currentTags.includes(tag)?currentTags.filter(x=>x!==tag):parseTags([...currentTags,tag].join(" "));
   $("hashtagsInput").value=d.hashtags.join(" ");markEdited(d);renderHashtagSuggestions(d);updatePreview();
  });
  host.append(b);
 }
}

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
 const headings={discover:"Discover",studio:"Content Studio",published:"Published"};
 $("topbarTitle").textContent=headings[active];
 window.scrollTo({top:0,behavior:"auto"});
}
function visibleStories(){
 const rows=source==="Marketaux"?marketauxStories:
   source==="PIB"?pibStories:
   source==="all"?[...payload.stories,...pibStories,...marketauxStories]:
   payload.stories.filter(s=>s.publisher===source);
 const seen=new Set();
 return rows.filter(s=>{const key=String(s.url||"").toLowerCase().replace(/\/$/,"");if(!key||seen.has(key))return false;seen.add(key);return true});
}
function marketauxNotice(message,warning=false){
 const el=$("marketauxStatus");el.textContent=message;el.classList.toggle("warning",warning);
}
let marketauxSession=false, marketauxAuthPending=false,marketauxReadiness="unknown";
const marketauxReady=()=>marketauxSession&&marketauxReadiness==="ready";
function updateMarketauxAuthUI(){
 $("marketauxSignedIn").hidden=!marketauxSession;
 $("marketauxAuth").hidden=marketauxSession;
 if(marketauxSession)$("marketauxAuth").open=false;
 const ready=marketauxReady();
 $("marketauxLoad").disabled=marketauxLoading||marketauxAuthPending||!ready;
 $("marketauxLoad").textContent=ready?"Load 3 stories":marketauxAuthPending?"Checking access…":
  marketauxReadiness==="approval_required"?"Awaiting permission":
  marketauxReadiness==="token_missing"?"Token not configured":"Sign in to load";
 $("marketauxSetup").hidden=marketauxReadiness!=="approval_required"&&marketauxReadiness!=="token_missing";
 if(marketauxReadiness==="approval_required"&&source==="Marketaux")$("marketauxSetup").open=true;
}
function showMarketauxReadiness(){
 if(!marketauxSession)return;
 if(marketauxReadiness==="approval_required")marketauxNotice("Marketaux connection: permission pending. Your manager session is active, but no API requests will be made until the required commercial-use approval is confirmed. See activation steps below.",true);
 else if(marketauxReadiness==="token_missing")marketauxNotice("Marketaux token missing from the deployed Netlify Functions production environment. Confirm the token scope and redeploy.",true);
 else if(marketauxReadiness==="ready")marketauxNotice("Marketaux is configured and ready. News loads automatically when you open this tab; refreshes are limited to protect the free quota.");
 else marketauxNotice("Checking Marketaux access…");
 updateMarketauxAuthUI();
}
function showPIBPanel(){
 $("pibPanel").hidden=source!=="PIB";
 $("pibReload").disabled=pibLoading;
}
async function loadPIB(){
 if(pibLoading)return;
 if(pibLoadedAt&&Date.now()-pibLoadedAt<15*60_000){
  $("pibStatus").textContent="Showing recently loaded PIB economy and policy releases. Updates refresh approximately every 15 minutes.";
  renderStories();return;
 }
 pibLoading=true;$("pibReload").disabled=true;$("pibReload").textContent="Checking…";
 $("pibStatus").textContent="Retrieving official PIB RSS press releases…";
 try{
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),14000);
  let response;try{response=await fetch("/.netlify/functions/pib-economy",{cache:"no-store",signal:ctrl.signal})}
  finally{clearTimeout(timer)}
  const data=await response.json();
  if(!response.ok)throw Error(data.error||"PIB RSS unavailable.");
  if(!Array.isArray(data.stories))throw Error("Invalid PIB RSS response.");
  pibStories=data.stories;pibLoadedAt=Date.now();
  $("pibStatus").textContent=pibStories.length?
    "Loaded "+pibStories.length+" government economy and policy releases. Source: PIB, Government of India. Check the original before drafting.":
    "PIB responded, but no matching economic press releases appeared in this feed window. You can also browse PIB directly.";
  renderStories();renderHealth();
 }catch(e){
  $("pibStatus").textContent="Could not retrieve PIB feed: "+String(e.message||e)+". You can still browse the official PIB website from the link below.";
 }finally{pibLoading=false;$("pibReload").disabled=false;$("pibReload").textContent="Refresh PIB"}
}
function switchSource(next){
 source=next;
 document.querySelectorAll("button[data-source]").forEach(x=>x.classList.toggle("selected",x.dataset.source===source));
 showMarketauxPanel();showPIBPanel();renderStories();
 if(source==="Marketaux")activateMarketaux();
 if(source==="PIB")loadPIB();
}
function showMarketauxPanel(){
 $("marketauxPanel").hidden=source!=="Marketaux";
 updateMarketauxAuthUI();
}
async function createMarketauxSession(key){
 const r=await fetch("/.netlify/functions/marketaux-session",{
  method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",
  cache:"no-store",body:JSON.stringify({key})
 });
 let result;try{result=await r.json()}catch{throw Error("The manager session service did not respond correctly.")}
 if(!r.ok||!result.authenticated)throw Error(result.error||"Could not sign in to Indian Markets.");
 marketauxSession=true;
 marketauxReadiness=result.marketauxStatus||"unknown";
 showMarketauxReadiness();updateMarketauxAuthUI();
 return true;
}
async function restoreMarketauxSession(){
 if(marketauxAuthPending)return marketauxSession;
 marketauxAuthPending=true;updateMarketauxAuthUI();
 try{
  const r=await fetch("/.netlify/functions/marketaux-session",{credentials:"same-origin",cache:"no-store"});
  let data;try{data=await r.json()}catch{throw Error("The manager session service is unavailable.")}
  marketauxSession=!!(r.ok&&data.authenticated);
  marketauxReadiness=marketauxSession?(data.marketauxStatus||"unknown"):"sign_in_required";
  // If Studio already has a valid key in this tab, exchange it for a cookie once.
  if(!marketauxSession&&managerKey){
   try{await createMarketauxSession(managerKey)}
   catch{marketauxSession=false}
  }
  updateMarketauxAuthUI();
  if(marketauxSession)showMarketauxReadiness();
  if(!marketauxSession){
   $("marketauxAuth").open=true;
   marketauxNotice("Sign in once to view Indian Markets. The secure session is remembered for up to seven days.");
  }
  return marketauxSession;
 }catch(e){
  marketauxSession=false;updateMarketauxAuthUI();$("marketauxAuth").open=true;
  marketauxNotice("Could not restore your session: "+String(e.message||e),true);
  return false;
 }finally{marketauxAuthPending=false;updateMarketauxAuthUI()}
}
async function connectMarketauxManager(){
 const key=$("marketauxManagerKey").value.trim();
 if(!key){marketauxNotice("Enter your manager access key once to continue.",true);return}
 $("marketauxConnect").disabled=true;$("marketauxConnect").textContent="Signing in…";
 try{
  await createMarketauxSession(key);
  $("marketauxManagerKey").value="";
  if(marketauxReady())await loadMarketaux();
  else showMarketauxReadiness();
 }catch(e){
  marketauxSession=false;updateMarketauxAuthUI();$("marketauxAuth").open=true;
  marketauxNotice(String(e.message||e),true);
 }finally{$("marketauxConnect").disabled=false;$("marketauxConnect").textContent="Sign in once"}
}
async function logoutMarketaux(){
 try{await fetch("/.netlify/functions/marketaux-session",{method:"DELETE",credentials:"same-origin",cache:"no-store"})}
 catch{}
 marketauxSession=false;marketauxReadiness="sign_in_required";marketauxStories=[];marketauxLoadedAt=0;
 // Clear the previously entered manager key so the session cannot immediately
 // re-create itself on the next visit. This also signs out AI in this tab.
 managerKey="";try{sessionStorage.removeItem("signaldesk:manager:key")}catch{}
 updateComposeConnection();updateMarketauxAuthUI();$("marketauxAuth").open=true;
 marketauxNotice("Signed out on this browser. Your AI manager connection in this tab was also cleared.");
 renderHealth();renderStories();
}
async function activateMarketaux(){
 if(source!=="Marketaux")return;
 const connected=await restoreMarketauxSession();
 if(connected&&marketauxReady()&&source==="Marketaux")await loadMarketaux();
}
async function loadMarketaux(){
 if(marketauxLoading||marketauxAuthPending)return;
 if(!marketauxSession){
  const restored=await restoreMarketauxSession();
  if(!restored)return;
 }
 if(!marketauxReady()){showMarketauxReadiness();return}
 if(marketauxLoadedAt&&Date.now()-marketauxLoadedAt<45*60_000){
  marketauxNotice("Showing previously loaded India-linked stories. The free-plan request limit is protected by a 45-minute cooldown.");
  renderStories();return;
 }
 marketauxLoading=true;updateMarketauxAuthUI();$("marketauxLoad").textContent="Loading…";
 try{
  const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),16000);
  let r;try{r=await fetch("/.netlify/functions/marketaux-news",{
   credentials:"same-origin",signal:ctrl.signal,cache:"no-store"
  })}finally{clearTimeout(timeout)}
  let data;try{data=await r.json()}catch{throw Error("Marketaux service returned an unreadable response.")}
  if(!r.ok){
   if(r.status===401){
    marketauxSession=false;updateMarketauxAuthUI();$("marketauxAuth").open=true;
   }
   throw Error(data.error||"Indian Markets is unavailable.");
  }
  if(!Array.isArray(data.stories))throw Error("Unexpected Marketaux response.");
  marketauxStories=data.stories;marketauxLoadedAt=Date.now();
  marketauxNotice(marketauxStories.length?
   "Loaded "+marketauxStories.length+" India-linked publisher reports. Check the original and any reuse rights before drafting.":
   "Connected, but no qualifying India-linked stories returned for the past week.");
  renderStories();renderHealth();
 }catch(e){marketauxNotice(String(e.message||e),true)}
 finally{marketauxLoading=false;updateMarketauxAuthUI()}
}
function renderHealth(){
 $("total").textContent=payload.stories.length+marketauxStories.length+pibStories.length;
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
 const shown=visibleStories().filter(s=>
  (now-new Date(s.publishedAt).getTime()<=windowDays*86400000)&&
  (rankMode!=="high"||important(s))&&(rankMode!=="unread"||feedState.unread.includes(s.id))&&
  (s.title+" "+s.snippet+" "+s.category).toLowerCase().includes(search));
 shown.sort((a,b)=>rankMode==="latest"?Date.parse(b.publishedAt)-Date.parse(a.publishedAt):priorityOf(b)-priorityOf(a)||Date.parse(b.publishedAt)-Date.parse(a.publishedAt));
 if(!shown.length){
  const msg=source==="PIB"?(pibStories.length?"No PIB economy/policy releases match these filters. Try 30 days or Latest.":"No PIB economy/policy stories loaded yet. See the status above and the official PIB website."):
 source==="Marketaux"?(marketauxStories.length?"No Indian-market reports match these filters. Try Latest or 7 days.":"No Indian-market articles loaded yet. Use Load 3 stories and check the connection status above."):
 payload.stories.length?"No updates match these filters. Try 30 days or another source.":"No recent source-backed stories available. Check source health or retry.";
  list.append(el("div","empty",msg));return;
 }
 for(const s of shown){
  const item=el("article","news-card"),top=el("div","card-top");
  const existing=workspace.drafts[s.id];
  append(top,el("span","pill",s.publisher),el("span","pill secondary",s.category||"Official update"));
  if(s.provider==="Marketaux")top.append(el("span","pill marketaux-label","Via Marketaux · Unverified"));
  if(s.provider==="PIB RSS")top.append(el("span","pill secondary","Government source · PIB"));
  const score=el("span","score-label "+(important(s)?"score-high":priorityOf(s)>=60?"score-mid":"score-low"),
    (important(s)?"High impact · ":"Relevance · ")+priorityOf(s)+"/100");
  score.title=s.rankBasis||"Editorial relevance estimate, not a fact check";
  top.append(score);
  if(feedState.unread.includes(s.id))top.append(el("span","pill new-pill","NEW"));
  if(existing)top.append(el("span","pill "+(existing.status==="Published"?"":"secondary"),existing.status));
  const title=el("h3","card-title",s.title),summary=el("p","story-summary",s.snippet||"Open the original publisher source for details.");
  const meta=el("div","story-meta");
  append(meta,el("span","",s.publishedAtEstimated?"Publication date not provided by PIB":dateFmt(s.publishedAt,false,s.dateOnly)));
  const rationale=el("p","why-relevant",s.reason||"Relevance is a provisional editorial estimate; verify the primary source.");
  const actions=el("div","story-buttons"),link=el("a","outline","Source ↗"),btn=el("button","outline dark",existing?"Continue draft →":"Create post →");
  link.href=validUrl(s.url)||"#";link.target="_blank";link.rel="noopener noreferrer";
  btn.type="button";btn.addEventListener("click",()=>startDraft(s));
  link.addEventListener("click",()=>readStory(s.id));
  append(actions,link,btn);append(item,top,title,summary,rationale,meta,actions);list.append(item);
 }
}
function renderFeeds(){
 renderHealth();renderStories();updateAlertUI();
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
  if(Array.isArray(data.stories)&&data.sources?.some(x=>x.ok))registerFeed(data.stories);
 }catch(e){payload={stories:[],sources:[],warnings:["Could not retrieve RSS: "+String(e.message||e)]}}
 finally{loading=false;$("refresh").disabled=false;$("refresh").textContent="↻ Refresh official feeds";renderFeeds()}
}
function starter(s){
 const publisher=s.publisher==="RBI"?"Reserve Bank of India":s.publisher==="SEBI"?"Securities and Exchange Board of India":s.publisher==="PIB"?"Press Information Bureau":s.publisher;
 return s.provider==="Marketaux"?s.title:publisher+" update: "+s.title;
}
function startDraft(s){
 if(!s?.id||!validUrl(s.url))return;
 if(!workspace.drafts[s.id]){
  const ts=new Date().toISOString();
  workspace.drafts[s.id]={id:s.id,source:{id:s.id,title:s.title,snippet:s.snippet||"",url:s.url,publisher:s.publisher,category:s.category||"Official update",publishedAt:s.publishedAt,dateOnly:!!s.dateOnly,publishedAtEstimated:!!s.publishedAtEstimated,provider:s.provider||"Official RSS",suggestedHashtags:defaultTags(s)},
   variants:{news:starter(s),insight:""},variant:"news",status:"Draft",verified:false,sourceLink:false,publishedText:"",xUrl:"",risks:[],hashtags:defaultTags(s),suggestedHashtags:defaultTags(s),createdAt:ts,updatedAt:ts};
  persist();
 }
 readStory(s.id);selectedId=s.id;navigate("studio");
}

let composerMode="link",composeBusy=false;
const previewDomains=["rbi.org.in","sebi.gov.in","pib.gov.in","nseindia.com","bseindia.com","reuters.com","business-standard.com","livemint.com","moneycontrol.com","thehindubusinessline.com","economictimes.indiatimes.com","cnbctv18.com"];
function canPreviewUrl(raw){
 try{
  const u=new URL(raw);
  const host=u.hostname.toLowerCase();
  return u.protocol==="https:"&&!u.username&&!u.password&&previewDomains.some(d=>host===d||host.endsWith("."+d));
 }catch{return false}
}
function updateComposeConnection(){
 $("composeConnectionState").textContent=managerKey?"Connected for this tab ✓":"(connect once per browser tab)";
}
function showManualLinkHelp(message){
 $("composeFallback").open=true;
 $("composeLinkHelp").hidden=false;$("composeLinkHelp").textContent=message;
}
function updateComposeLinkHelp(){
 const raw=$("composeURL").value.trim();
 if(!raw){$("composeLinkHelp").hidden=true;return}
 const url=validUrl(raw);
 if(!url){$("composeLinkHelp").hidden=false;$("composeLinkHelp").textContent="Enter a complete HTTPS news link.";return}
 if(canPreviewUrl(url)){
  $("composeLinkHelp").hidden=false;
  $("composeLinkHelp").textContent="Supported source: SignalDesk can try to retrieve its headline and short description. If blocked, paste the facts below.";
 }else{
  showManualLinkHelp("This publisher, including Yahoo Finance, is link-only in SignalDesk. Paste the headline and key facts below; the original URL will be kept for attribution. No automated article extraction.");
 }
}

function composeNotice(message,failed=false){
 const e=$("composeStatus");e.textContent=message;e.classList.toggle("failed",failed);
}
function composerOpen(isOpen){
 $("composePanel").hidden=!isOpen;$("composeToggle").setAttribute("aria-expanded",String(isOpen));
 if(isOpen)$("composePanel").scrollIntoView({block:"nearest",behavior:"smooth"});
}
function setComposerMode(mode){
 composerMode=mode==="text"?"text":"link";
 $("composeLinkFields").hidden=composerMode!=="link";
 $("composeTextFields").hidden=composerMode!=="text";
 document.querySelectorAll("button[data-compose-mode]").forEach(b=>b.classList.toggle("selected",b.dataset.composeMode===composerMode));
}
async function connectComposerAI(){
 const candidate=$("composeManagerKey").value.trim();
 if(!candidate){
  composeNotice(managerKey?"AI is already connected for this browser tab.":"Enter your manager access key to connect AI.",!managerKey);
  updateComposeConnection();
  return !!managerKey;
 }
 $("composeConnect").disabled=true;$("composeConnect").textContent="Checking…";
 try{
  const response=await fetch("/.netlify/functions/ai-status",{headers:{"x-manager-key":candidate},cache:"no-store"});
  let result;try{result=await response.json()}catch{throw Error("AI connection check did not return a valid response.")}
  if(!response.ok||!result.ready)throw Error(result.error||"The AI service is not configured.");
  managerKey=candidate;
  try{sessionStorage.setItem("signaldesk:manager:key",managerKey)}catch{}
  $("composeManagerKey").value="";$("composeCredentials").open=false;
  composeNotice("AI connected. You can generate two editable versions.");
  updateComposeConnection();return true;
 }catch(e){composeNotice("Could not connect AI: "+String(e.message||e)+". Check Netlify settings or try again.",true);return false}
 finally{$("composeConnect").disabled=false;$("composeConnect").textContent="Connect"}
}
const getHost=url=>{try{return new URL(url).hostname.replace(/^www\./,"")}catch{return "User source"}};
async function getComposerStory(useAI){
 const now=new Date().toISOString();
 if(composerMode==="text"){
  const content=$("composeText").value.trim();
  if(content.length<18)throw Error("Paste the news headline and some factual detail first.");
  const lines=content.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const title=(lines[0]||"").slice(0,260);
  const snippet=(lines.slice(1).join(" ")||content).slice(0,3000);
  const inputURL=$("composeReference").value.trim();
  const url=inputURL?validUrl(inputURL):"";
  if(inputURL&&!url)throw Error("The original source URL must use HTTPS.");
  return {title,snippet,url,publisher:url?getHost(url):"User-provided text",publishedAt:now,dateOnly:true};
 }
 const entered=$("composeURL").value.trim();
 const url=validUrl(entered);
 if(!url)throw Error("Enter a valid HTTPS news URL.");
 const fallbackTitle=$("composeHeadline").value.trim().slice(0,260);
 const fallbackText=$("composeExcerpt").value.trim().slice(0,3000);
 if(fallbackTitle.length>=12){
  return {title:fallbackTitle,snippet:fallbackText,url,publisher:getHost(url),publishedAt:now,dateOnly:true};
 }
 if(!canPreviewUrl(url)){
  showManualLinkHelp("Automatic preview is unavailable for this publisher. Paste the news headline and key facts here; the link stays attached to the draft.");
  throw Error("This publisher cannot be previewed automatically. Paste the headline and relevant facts in the expanded fields.");
 }
 if(!managerKey)throw Error("For a supported link preview, connect your manager key above or paste the headline and facts manually.");
 const response=await fetch("/.netlify/functions/news-preview",{method:"POST",headers:{"Content-Type":"application/json","x-manager-key":managerKey},body:JSON.stringify({url}),cache:"no-store"});
 let result;try{result=await response.json()}catch{throw Error("This publisher did not return a usable preview. Paste the headline and a few facts instead.")}
 if(!response.ok){
  if(response.status===401){managerKey="";try{sessionStorage.removeItem("signaldesk:manager:key")}catch{}updateComposeConnection();$("composeCredentials").open=true}
  showManualLinkHelp(result.error||"This source blocked its preview. Paste the headline and key facts instead.");
  throw Error(result.error||"This source could not be previewed. Paste the headline and key facts instead.");
 }
 return {title:result.title,snippet:result.snippet||"",url,publisher:result.publisher||getHost(url),publishedAt:now,dateOnly:true};
}
async function submitComposer(useAI){
 if(composeBusy)return;
 // Validate the news input before requesting credentials or calling the model.
 if(composerMode==="link"){
  const url=$("composeURL").value.trim();
  if(!validUrl(url)){composeNotice("Enter a complete HTTPS news URL first.",true);$("composeURL").focus();return}
  if(!canPreviewUrl(url)&&$("composeHeadline").value.trim().length<12){
   showManualLinkHelp("This source is link-only. Paste its headline and key facts; then Generate will use those facts without scraping the article.");
   composeNotice("This publisher is not supported for automatic previews. Add the headline and key facts below, then try again.",true);
   $("composeHeadline").focus();return;
  }
 }
 if(useAI&&!managerKey){
  if($("composeManagerKey").value.trim()){
   const connected=await connectComposerAI();
   if(!connected)return;
  }else{
   $("composeCredentials").open=true;
   composeNotice("Enter your manager access key here, then click Generate again. No need to open Studio.",true);
   $("composeManagerKey").focus();return;
  }
 }
 composeBusy=true;$("composeGenerate").disabled=true;$("composeManual").disabled=true;
 composeNotice(useAI?"Reading the source and preparing your draft…":"Creating a manual draft…");
 try{
  const src=await getComposerStory(useAI);
  if(src.title.length<12)throw Error("Please provide a meaningful news headline.");
  const id="custom:"+Date.now()+":"+Math.random().toString(36).slice(2,9);
  const timestamp=new Date().toISOString();
  const news=src.title;
  workspace.drafts[id]={id,manual:true,source:{id,title:src.title,snippet:src.snippet,url:src.url,publisher:src.publisher,category:"User-submitted news",publishedAt:src.publishedAt,dateOnly:true,suggestedHashtags:[]},
   variants:{news,insight:""},variant:"news",status:"Draft",verified:false,sourceLink:false,publishedText:"",xUrl:"",risks:[],hashtags:[],suggestedHashtags:[],createdAt:timestamp,updatedAt:timestamp};
  selectedId=id;persist();composerOpen(false);navigate("studio");
  if(useAI){await generate()}
  else notify("Manual draft created. Edit the content or use Generate 2 AI versions. Verify the source before marking Ready.");
 }catch(e){composeNotice(String(e.message||e),true)}
 finally{composeBusy=false;$("composeGenerate").disabled=false;$("composeManual").disabled=false}
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
 const from=d.manual&&!validUrl(d.source.url)?"Source: User-provided text (not verified)":
 "Source: "+d.source.publisher+(d.sourceLink&&validUrl(d.source.url)?" "+d.source.url:"");
 const uniqueTags=(Array.isArray(d.hashtags)?parseTags(d.hashtags.join(" ")):defaultTags(d.source))
  .filter(tag=>!body.toLowerCase().includes(tag.toLowerCase()));
 return [prefix,body,uniqueTags.join(" "),from].filter(Boolean).join("\n\n");
}
function updatePreview(){
 const d=current();if(!d)return;
 const text=buildText(d),length=text.length;
 $("studioPreview").textContent=text||"Start writing your post";
 $("studioCount").textContent=length+" / 280 characters";
 $("publishDetails").open=d.status==="Ready"||d.status==="Published";
 $("studioCount").classList.toggle("over-limit",length>280);
 $("draftStatus").textContent=d.status;
 $("sourceVerified").checked=!!d.verified;
 $("markReady").disabled=d.status==="Published"||!d.verified||!!(d.manual&&!validUrl(d.source.url))||!d.variants[d.variant]?.trim()||length>280;
 $("markReady").textContent=d.status==="Published"?"Already published":d.status==="Ready"?"Ready ✓":"Mark ready";
 $("copyFinal").disabled=!["Ready","Published"].includes(d.status)||length>280;
 $("recordPublished").disabled=d.status!=="Ready";
 $("publishedUrl").disabled=d.status==="Published";
 $("publishedUrl").value=d.xUrl||"";
 $("studioText").disabled=d.status==="Published";
 $("hashtagsInput").disabled=d.status==="Published";
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
 $("studioSourceMeta").textContent=d.source.publisher+" · "+(d.source.publishedAtEstimated?"Publication date not supplied":dateFmt(d.source.publishedAt,true,d.source.dateOnly))+" · "+d.source.category;
 $("studioSourceLink").href=validUrl(d.source.url)||"#";
 $("studioSourceLink").hidden=!validUrl(d.source.url);
 $("manualSourceEdit").hidden=!d.manual;
 $("manualSourceURL").value=d.manual?(d.source.url||""):"";
 document.querySelectorAll("[data-variant]").forEach(b=>b.classList.toggle("selected",b.dataset.variant===d.variant));
 $("studioText").value=d.variants[d.variant]||"";
 $("studioText").placeholder=d.variant==="insight"&&d.contextStatus==="needs_source"?
 "Add verified source details before writing an explanation. Don't invent investor implications.":
 "Write a clear, standalone update naming the organisation and event.";
 $("variantHint").textContent=d.variant==="news"?
 "What happened? Name the organisation, the action and the specific facts.":
 "Why does this particular news matter? Only explain relevance that the source supports.";
 const basis=String(d.source.snippet||"").trim();
 $("evidenceBasis").textContent=d.manual?
 (basis?"AI input: user-supplied headline and text (unverified). Open the original.":"AI input: user-supplied headline only. Open the original."):
 (basis?"AI input: official RSS headline and excerpt, not the full release. Verify original.":"AI input: headline only, not the full release. More source detail may be needed.");
 if(d.source.provider==="PIB RSS")
  $("evidenceBasis").textContent="AI input: PIB press-release headline and short summary only. Verify the original and attribute Press Information Bureau.";
 if(d.source.provider==="Marketaux")
  $("evidenceBasis").textContent="AI input: Marketaux publisher headline and short description only, not the article or exchange filing. Verify before publishing.";
 const note=$("contextNotice");
 note.hidden=!(d.variant==="insight"&&d.contextStatus==="needs_source");
 note.textContent=d.contextStatus==="needs_source"?
 "More evidence needed: "+(d.contextNote||"The available headline/excerpt does not establish a distinct explanation. Read the original and add supported context."):"";
 $("hashtagsInput").value=(d.hashtags||defaultTags(d.source)).join(" ");renderHashtagSuggestions(d);
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
 if(!managerKey){$("aiSetupPanel").open=true;notify("Connect your manager key to generate two real AI versions. The OpenAI API key must be configured securely in Netlify.",true);$("managerKey").focus();return}
 generating=true;$("aiGenerate").disabled=true;$("aiGenerate").textContent="Generating…";
 try{
  const result=await fetch("/.netlify/functions/draft",{method:"POST",headers:{"Content-Type":"application/json","x-manager-key":managerKey},body:JSON.stringify({title:d.source.title,snippet:d.source.snippet,publisher:d.source.publisher,publishedAt:d.source.publishedAt,sourceUrl:d.source.url,userPasted:!!d.manual})});
  const body=await result.json();
  if(!result.ok)throw Error(body.error||"AI drafting unavailable");
  if(typeof body.news!=="string"||!body.news.trim()||typeof body.insight!=="string")throw Error("Unexpected drafting response");
  d.variants={news:body.news,insight:body.insight};d.variant="news";
  d.risks=Array.isArray(body.risks)?body.risks.slice(0,10).map(String):[];
  d.contextStatus=body.contextStatus==="needs_source"?"needs_source":"supported";
  d.contextNote=typeof body.contextNote==="string"?body.contextNote.slice(0,300):"";
  d.hashtags=Array.isArray(body.hashtags)&&body.hashtags.length?parseTags(body.hashtags.join(" ")):defaultTags(d.source);
  markEdited(d);
  notify(d.contextStatus==="needs_source"?
    "News Update is ready to review. Why It Matters needs more verified source detail; no speculative explanation was generated.":
    "Two AI versions drafted. Check both against the original source before selecting one.");
  $("aiSetupPanel").open=false;
  renderStudio();
 }catch(e){notify(String(e.message||e)+". Manual drafting remains available.",true)}
 finally{generating=false;$("aiGenerate").disabled=false;$("aiGenerate").textContent="✦ Generate 2 AI versions"}
}
function sourceURLAccepted(raw){
 try{const u=new URL(raw);return ["x.com","www.x.com","twitter.com","www.twitter.com"].includes(u.hostname)&&/^\/[a-zA-Z0-9_]+\/status\/\d+\/?$/.test(u.pathname)?u.href:null}catch{return null}
}
$("composeToggle").addEventListener("click",()=>{composerOpen($("composePanel").hidden);updateComposeConnection()});
$("composeURL").addEventListener("input",updateComposeLinkHelp);
$("composeClose").addEventListener("click",()=>composerOpen(false));
document.querySelectorAll("button[data-compose-mode]").forEach(b=>b.addEventListener("click",()=>setComposerMode(b.dataset.composeMode)));
$("composeConnect").addEventListener("click",connectComposerAI);
$("composeGenerate").addEventListener("click",()=>submitComposer(true));
$("composeManual").addEventListener("click",()=>submitComposer(false));
$("manualSourceURL").addEventListener("change",e=>{
 const d=current();if(!d||!d.manual||d.status==="Published")return;
 const raw=e.target.value.trim(),url=raw?validUrl(raw):"";
 if(raw&&!url){notify("Please enter a valid HTTPS source URL.",true);return}
 d.source.url=url;if(url&&d.source.publisher==="User-provided text")d.source.publisher=getHost(url);
 markEdited(d);renderStudio();
 notify(url?"Source URL updated. Open it and verify the original before marking Ready.":"Add an original source URL before marking Ready.",!url);
});

document.addEventListener("click",e=>{
 const b=e.target.closest("button[data-view]");if(b)navigate(b.dataset.view);
});
$("refresh").addEventListener("click",refresh);
$("rankingTabs").addEventListener("click",e=>{
 const b=e.target.closest("button[data-rank]");if(!b)return;
 rankMode=b.dataset.rank;document.querySelectorAll("button[data-rank]").forEach(x=>x.classList.toggle("selected",x===b));renderStories();
});
$("alertsButton").addEventListener("click",()=>setAlertsOpen(!alertsOpen));
$("alertsClose").addEventListener("click",()=>setAlertsOpen(false));
$("clearAlerts").addEventListener("click",()=>{
 feedState.unread=[];saveFeedState();updateAlertUI();setAlertsOpen(false);renderStories();
});
document.addEventListener("click",e=>{if(alertsOpen&&!e.target.closest(".alert-anchor"))setAlertsOpen(false)});
$("pibReload").addEventListener("click",()=>{pibLoadedAt=0;loadPIB()});
 $("openPibAlternative").addEventListener("click",()=>switchSource("PIB"));
 $("marketauxLoad").addEventListener("click",loadMarketaux);
 $("marketauxConnect").addEventListener("click",connectMarketauxManager);
$("marketauxLogout").addEventListener("click",logoutMarketaux);
 $("sourceTabs").addEventListener("click",e=>{
 const b=e.target.closest("button[data-source]");if(!b)return;
 switchSource(b.dataset.source);
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
 d.variants[d.variant]=e.target.value;markEdited(d);
 if(d.variant==="insight"&&d.contextStatus==="needs_source"){
   $("contextNotice").textContent="AI could not verify sufficient context. Any explanation you add must be checked against the original release.";
 }
 updatePreview();
});
$("hashtagsInput").addEventListener("input",e=>{
 const d=current();if(!d||d.status==="Published")return;
 d.hashtags=parseTags(e.target.value);markEdited(d);renderHashtagSuggestions(d);updatePreview();
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
 if(!d.verified||!!(d.manual&&!validUrl(d.source.url))||!d.variants[d.variant]?.trim()||!text||text.length>280){notify("Verify the original, finish the draft, and ensure it fits the character limit.",true);return}
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
$("saveManagerKey").addEventListener("click",async()=>{
 const candidate=$("managerKey").value.trim();$("managerKey").value="";
 if(!candidate){managerKey="";try{sessionStorage.removeItem("signaldesk:manager:key")}catch{}notify("No key entered. You can still edit drafts manually.",true);return}
 $("saveManagerKey").disabled=true;$("saveManagerKey").textContent="Checking connection…";
 try{
  const response=await fetch("/.netlify/functions/ai-status",{headers:{"x-manager-key":candidate},cache:"no-store"});
  const body=await response.json();
  if(!response.ok)throw Error(body.error||"AI connection unavailable");
  if(!body.ready)throw Error(body.error||"The OpenAI service is not configured in Netlify yet");
  managerKey=candidate;
  try{sessionStorage.setItem("signaldesk:manager:key",managerKey)}catch{}
  $("aiSetupPanel").open=false;
  notify("AI is connected. Select Generate 2 AI versions for your selected story.");
 }catch(e){managerKey="";try{sessionStorage.removeItem("signaldesk:manager:key")}catch{}notify("AI connection: "+String(e.message||e)+". Manual drafting is still available.",true)}
 finally{$("saveManagerKey").disabled=false;$("saveManagerKey").textContent="Connect AI"}
});
$("aiGenerate").addEventListener("click",generate);
const initialView=location.hash.replace("#","");
updateComposeConnection();
updateNavCounts();navigate(initialView,false);refresh();
setInterval(()=>{if(!document.hidden)refresh()},5*60*1000);
})();