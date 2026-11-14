(()=>{
"use strict";
const $=id=>document.getElementById(id);
const el=(name,cls,text)=>{const node=document.createElement(name);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node};
const append=(parent,...nodes)=>{nodes.forEach(n=>parent.append(n));return parent};
const storeKey="signaldesk:unified:poc:v1";
const read=()=>{try{const x=JSON.parse(localStorage.getItem(storeKey)||"{}");return x&&typeof x==="object"&&x.drafts&&typeof x.drafts==="object"?x:{drafts:{},disclosure:""}}catch{return {drafts:{},disclosure:""}}};
let workspace=read(),payload={stories:[],sources:[],warnings:[]},active="discover",source="all",windowDays=7,search="",rankMode="top",selectedId=null,loading=false,generating=false,mojoStories=[],pibStories=[],pibLoading=false,pibLoadedAt=0;

// In-page alerts only. They are NOT OS notifications, background checks or push delivery.
const feedStateKey="signaldesk:official-feed-tracking:v1";
function loadFeedState(){
 try{const x=JSON.parse(localStorage.getItem(feedStateKey)||"{}");return {known:Array.isArray(x.known)?x.known:[],unread:Array.isArray(x.unread)?x.unread:[]}}catch{return {known:[],unread:[]}}
}
let feedState=loadFeedState(),alertsOpen=false;
// Browser alerts are opt-in and work only while SignalDesk is open.
// No push service worker, continuous server-side monitor, or OS alerts after close.
const desktopAlertPrefKey="signaldesk:desktop-alerts-enabled:v1";
const desktopAlertHistoryKey="signaldesk:desktop-alerts-shown:v1";
function readDesktopAlertPreference(){
 try{return localStorage.getItem(desktopAlertPrefKey)==="enabled"}catch{return false}
}
let desktopAlertsEnabled=readDesktopAlertPreference();
function desktopSupported(){
 return typeof window!=="undefined"&&window.isSecureContext&&typeof window.Notification==="function";
}
function desktopAlertsActive(){
 return desktopAlertsEnabled&&desktopSupported()&&window.Notification.permission==="granted";
}
function setDesktopPreference(enabled){
 desktopAlertsEnabled=!!enabled;
 try{localStorage.setItem(desktopAlertPrefKey,enabled?"enabled":"disabled")}catch{}
 renderDesktopAlertControls();
}
function renderDesktopAlertControls(){
 const toggle=$("desktopAlertToggle"),test=$("desktopAlertTest"),status=$("desktopAlertStatus");
 if(!desktopSupported()){
  toggle.disabled=true;toggle.textContent="Unavailable";test.hidden=true;
  status.textContent="Desktop alerts are not supported in this browser or secure context. The in-app bell still works.";
  return;
 }
 const permission=window.Notification.permission;
 test.hidden=!desktopAlertsActive();
 toggle.disabled=false;
 if(desktopAlertsActive()){
  toggle.textContent="Turn off";
  status.textContent="On · New high-priority RBI/SEBI news can appear as a browser notification while this page is open.";
 }else if(permission==="denied"){
  toggle.textContent=desktopAlertsEnabled?"Turn off":"Browser blocked";
  toggle.disabled=!desktopAlertsEnabled;
  status.textContent="Notification access is blocked. To enable it, change SignalDesk's notification permission in browser site settings.";
 }else{
  toggle.textContent="Enable alerts";
  status.textContent="Off · Enable to be notified about newly detected high-priority RBI/SEBI releases.";
 }
}
async function toggleDesktopAlerts(){
 if(desktopAlertsEnabled){setDesktopPreference(false);return}
 if(!desktopSupported()){renderDesktopAlertControls();return}
 if(window.Notification.permission==="denied"){renderDesktopAlertControls();return}
 try{
  // Called by a direct user click. Never ask permission on page load.
  const permission=window.Notification.permission==="granted"?"granted":
   await window.Notification.requestPermission();
  setDesktopPreference(permission==="granted");
  if(permission!=="granted")$("desktopAlertStatus").textContent=permission==="denied"?
   "Browser notifications were blocked; use site settings if you want to allow them.":
   "Permission was not granted. The in-app alert bell still works.";
 }catch{
  setDesktopPreference(false);
  $("desktopAlertStatus").textContent="The browser could not enable notifications. The in-app bell is still available.";
 }
}
function showBrowserNotification(title,body,tag,onDeliveryEvent){
 if(!desktopAlertsActive())return false;
 try{
  // Creating a Notification only confirms that Chrome accepted the request.
  // Windows banner delivery can still be suppressed by notification settings.
  const notification=new window.Notification(title,{
   body:String(body||"").slice(0,170),tag:String(tag||"signaldesk-update").slice(0,100)
  });
  if(typeof onDeliveryEvent==="function"){
   notification.onshow=()=>onDeliveryEvent("shown");
   notification.onerror=()=>onDeliveryEvent("error");
  }else{
   notification.onerror=()=>{$("desktopAlertStatus").textContent=
    "A desktop notification could not be displayed. Check Chrome and Windows notification settings; the in-app bell still works."};
  }
  notification.onclick=()=>{
   try{window.focus()}catch{}
   navigate("discover");setAlertsOpen(true);
   try{notification.close()}catch{}
  };
  return true;
 }catch{
  $("desktopAlertStatus").textContent="Chrome could not create a notification. Check browser and Windows permissions; the in-app bell still works.";
  if(typeof onDeliveryEvent==="function")onDeliveryEvent("error");
  return false;
 }
}
function readDesktopNotificationHistory(){
 try{const ids=JSON.parse(localStorage.getItem(desktopAlertHistoryKey)||"[]");
  return Array.isArray(ids)?ids.filter(x=>typeof x==="string").slice(-300):[]
 }catch{return []}
}
function notifyNewHighPriority(stories){
 if(!desktopAlertsActive()||!stories.length)return;
 const now=Date.now(),shown=new Set(readDesktopNotificationHistory());
 const fresh=stories.filter(s=>s&&(s.publisher==="RBI"||s.publisher==="SEBI")
  &&!shown.has(s.id)&&Number.isFinite(Date.parse(s.publishedAt))
  &&Date.parse(s.publishedAt)<=now
  &&now-Date.parse(s.publishedAt)<=24*60*60*1000);
 if(!fresh.length)return;
 const primary=fresh[0],multiple=fresh.length>1;
 const title=multiple?"Geojit SignalDesk · "+fresh.length+" new high-priority updates":
  "Geojit SignalDesk · "+primary.publisher+" update";
 const body=(multiple?primary.publisher+" · ":"")+primary.title;
 if(!showBrowserNotification(title,body,"signaldesk-official-"+primary.id))return;
 const next=[...shown,...fresh.map(s=>s.id)].slice(-300);
 try{localStorage.setItem(desktopAlertHistoryKey,JSON.stringify(next))}catch{}
}
function showDesktopTestToast(message){
 // Always give immediate, visible IN-PAGE feedback, separate from the native
 // Windows notification whose display cannot be guaranteed by this website.
 const toast=$("desktopTestToast");
 if(!toast)return;
 toast.textContent=message;
 toast.hidden=false;
 if(typeof setTimeout==="function"){
  if(desktopTestToastTimeout)clearTimeout(desktopTestToastTimeout);
  desktopTestToastTimeout=setTimeout(()=>{toast.hidden=true},9000);
 }
}
let desktopTestToastTimeout=null,desktopTestSerial=0;
function testDesktopAlert(){
 if(!desktopAlertsActive()){
  renderDesktopAlertControls();
  showDesktopTestToast("Desktop alerts are not enabled in Chrome. Use Enable alerts in the bell menu.");
  return;
 }
 // A unique tag avoids Chrome silently replacing an earlier test notification.
 const tag="signaldesk-test-"+Date.now()+"-"+(++desktopTestSerial);
 const message="SignalDesk test confirmed in this page. Requesting a Chrome desktop notification…";
 showDesktopTestToast(message);
 const sent=showBrowserNotification("Geojit SignalDesk · Test alert",
  "This is a test notification. New high-priority RBI/SEBI alerts can appear while SignalDesk stays open.",
  tag,event=>{
   if(event==="shown"){
    $("desktopAlertStatus").textContent="Chrome reported the notification was shown. If there was no popup, check Windows Notification Centre, Chrome banners and Do not disturb.";
   }else{
    $("desktopAlertStatus").textContent="Chrome reported a notification display error. Check Windows Notifications → Google Chrome, banners and Do not disturb.";
    showDesktopTestToast("Desktop notification display failed. The SignalDesk in-page test is working; check Windows notifications.");
   }
  });
 if(sent){
  $("desktopAlertStatus").textContent="Test requested from Chrome. A Windows popup is not guaranteed. If you see nothing, check Windows Notifications → Google Chrome, banners and Do not disturb.";
  showDesktopTestToast("SignalDesk in-page test succeeded. Chrome was asked to show a separate desktop popup; check Windows notification settings if it is missing.");
 }
}
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
 if(open){updateAlertUI();renderDesktopAlertControls()}
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
 notifyNewHighPriority(newImportant);
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
let aiConnectionState=managerKey?"checking":"disconnected";
let aiConnectionDetail="";
let aiStatusRequestSeq=0;
function renderAIConnectionState(){
 const states={
  connected:{label:"AI connected",detail:"Verified with Netlify for this browser tab. You can generate AI tweet variants."},
  disconnected:{label:"AI not connected",detail:"Enter your manager access key to enable AI drafting. Manual editing still works."},
  checking:{label:"Checking AI connection…",detail:"Verifying your saved manager access with Netlify. Please wait."},
  error:{label:"AI connection issue",detail:"Connection could not be verified on this computer. Recheck or connect with your manager key."}
 };
 const active=states[aiConnectionState]||states.disconnected;
 const detail=aiConnectionDetail||active.detail;
 for(const prefix of ["studio","compose"]){
  $(prefix+"AIStatus").dataset.state=aiConnectionState;
  $(prefix+"AIStatusLabel").textContent=active.label;
  $(prefix+"AIStatusDetail").textContent=detail;
 }
 $("studioAISummaryState").textContent=active.label;
 $("composeConnectionState").textContent=active.label;
 $("studioAIRecheck").hidden=!managerKey;
 $("studioAIDisconnect").hidden=!managerKey;
 if(!$("saveManagerKey").disabled)$("saveManagerKey").textContent=aiConnectionState==="connected"?"Change key":"Connect AI";
 if(!$("composeConnect").disabled)$("composeConnect").textContent=aiConnectionState==="connected"?"Change key":"Connect";
}
function setAIConnectionState(state,detail=""){
 aiConnectionState=state;aiConnectionDetail=detail;
 renderAIConnectionState();
}
function disconnectAI(){
 ++aiStatusRequestSeq;
 managerKey="";
 try{sessionStorage.removeItem("signaldesk:manager:key")}catch{}
 $("managerKey").value="";$("composeManagerKey").value="";
 setAIConnectionState("disconnected","Disconnected in this browser tab. Enter your manager key to use AI again.");
}
// Successful authentication confirms manager access and that Netlify has an
// OpenAI key configured. It does not call the paid model or guarantee quota.
async function verifyAIConnection(candidate,{remember=true}={}){
 if(!candidate){setAIConnectionState("disconnected");return false}
 const seq=++aiStatusRequestSeq;
 const oldKey=managerKey,oldState=aiConnectionState;
 setAIConnectionState("checking");
 try{
  let response;
  try{response=await fetch("/.netlify/functions/ai-status",{
    headers:{"x-manager-key":candidate},cache:"no-store",signal:AbortSignal.timeout(12000)
  })}catch(e){
   throw Error(e?.name==="TimeoutError"||e?.name==="AbortError"?
    "Netlify did not respond within 12 seconds. Check network, VPN or firewall.":
    "This computer could not reach the AI endpoint. Check the network and browser security settings.");
  }
  let info;
  try{info=await response.json()}catch{throw Error("The AI status endpoint returned an unreadable response.")}
  if(!response.ok||!info.ready){
   const err=Error(info.error||"AI connection was not accepted by Netlify.");
   err.invalidKey=response.status===401;
   throw err;
  }
  if(seq!==aiStatusRequestSeq)return false;
  managerKey=candidate;
  if(remember){try{sessionStorage.setItem("signaldesk:manager:key",candidate)}catch{}}
  setAIConnectionState("connected");
  return true;
 }catch(e){
  if(seq!==aiStatusRequestSeq)return false;
  if(oldKey&&oldState==="connected"&&oldKey!==candidate){
   setAIConnectionState("connected","Your earlier connection remains active. The new key could not be verified: "+String(e.message||e));
  }else{
   if(e.invalidKey&&managerKey===candidate){
    managerKey="";
    try{sessionStorage.removeItem("signaldesk:manager:key")}catch{}
   }
   setAIConnectionState("error",String(e.message||e));
  }
  return false;
 }
}

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
// MarketsMojo POC stories are MANUALLY selected by an editor; no page reader,
// scraper, or MarketsMojo API is used without approval of that source.
const mojoStorageKey="signaldesk:marketsmojo:curated:v1";
function validMojoUrl(raw){
 try{
  const u=new URL(String(raw||"").trim());
  if(u.protocol!=="https:"||u.username||u.password
    ||!["marketsmojo.com","www.marketsmojo.com"].includes(u.hostname.toLowerCase())
    ||!u.pathname.toLowerCase().startsWith("/news"))return "";
  u.hash="";return u.href;
 }catch{return ""}
}
function mojoId(url){
 let h=2166136261;for(let i=0;i<url.length;i++)h=Math.imul(h^url.charCodeAt(i),16777619);
 return "mojo:"+(h>>>0).toString(36);
}
function mojoStory(source){
 const url=validMojoUrl(source.url),added=Date.parse(source.curatedAt);
 if(!url||typeof source.title!=="string"||source.title.trim().length<12||source.title.length>240)return null;
 const at=Number.isFinite(added)?new Date(added).toISOString():new Date().toISOString();
 return {id:mojoId(url),url,title:source.title.trim(),snippet:String(source.snippet||"").slice(0,1000),
  category:String(source.category||"Market updates").slice(0,50),curatedAt:at,publishedAt:at,
  publishedAtEstimated:true,curatedPOC:true,demoOnly:true,provider:"MarketsMojo POC",publisher:"MarketsMojo",
  priority:55,rankBasis:"Manually selected for internal demo, not market relevance or newsworthiness scoring.",
  reason:"Editorially selected for a POC. Verify the original story and any figures using independent primary sources.",
  suggestedHashtags:[]};
}
function readMojo(){
 try{const data=JSON.parse(localStorage.getItem(mojoStorageKey)||"[]");
  return Array.isArray(data)?data.slice(0,35).map(mojoStory).filter(Boolean):[];
 }catch{return []}
}
mojoStories=readMojo();
function saveMojo(){
 try{localStorage.setItem(mojoStorageKey,JSON.stringify(mojoStories.map(x=>({
  url:x.url,title:x.title,snippet:x.snippet,category:x.category,curatedAt:x.curatedAt
 }))))}catch{$("mojoFormStatus").textContent="Could not save to browser storage. Stories may not survive a refresh."}
}
function updateMojoCount(){
 $("mojoCount").textContent=mojoStories.length+" curated "+(mojoStories.length===1?"story":"stories");
}
function showMojoPanel(){
 $("mojoPanel").hidden=source!=="MarketsMojo";updateMojoCount();
}
function setMojoForm(open){
 $("mojoForm").hidden=!open;
 $("mojoOpenForm").setAttribute("aria-expanded",String(open));
 $("mojoOpenForm").textContent=open?"Close form":"+ Add news story";
 if(open)$("mojoURL").focus();
}
function addMojoStory(withAI=false){
 const raw=$("mojoURL").value,url=validMojoUrl(raw),title=$("mojoHeadline").value.trim(),
  snippet=$("mojoFacts").value.trim(),category=$("mojoCategory").value;
 if(!url){$("mojoFormStatus").textContent="Enter an HTTPS MarketsMojo news link, not a different publisher.";$("mojoURL").focus();return}
 if(title.length<12){$("mojoFormStatus").textContent="Please add a clear headline, at least 12 characters.";$("mojoHeadline").focus();return}
 if(mojoStories.some(x=>x.url===url)){
  $("mojoFormStatus").textContent="This story URL is already in Discover. Select Create post on its card.";return
 }
 if(mojoStories.length>=35){$("mojoFormStatus").textContent="The POC collection holds up to 35 stories. Remove an older one first.";return}
 const story=mojoStory({url,title,snippet,category,curatedAt:new Date().toISOString()});
 if(!story){$("mojoFormStatus").textContent="Headline or URL is not valid.";return}
 mojoStories.unshift(story);saveMojo();updateMojoCount();renderHealth();renderStories();
 $("mojoForm").reset();setMojoForm(false);
 if(withAI){
  startDraft(story);
  if(managerKey)generate();
  else notify("The MarketsMojo story is saved. Connect your manager key under AI connection in Studio, then generate drafts. Publishing remains disabled for this POC.");
 }
}
function removeMojo(id){
 if(!mojoStories.some(x=>x.id===id))return;
 if(!window.confirm("Remove this curated story from Discover? Existing Studio drafts will remain."))return;
 mojoStories=mojoStories.filter(x=>x.id!==id);saveMojo();renderStories();renderHealth();updateMojoCount();
}
function visibleStories(){
 const rows=source==="MarketsMojo"?mojoStories:
  source==="PIB"?pibStories:
  source==="all"?[...payload.stories,...pibStories,...mojoStories]:
  payload.stories.filter(x=>x.publisher===source);
 const seen=new Set();
 return rows.filter(x=>{
  const key=String(x.url||"").toLowerCase().replace(/\/$/,"");
  if(!key||seen.has(key))return false;seen.add(key);return true
 });
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
// Drishti internal licensed feed evaluation. Do not mix this provider's
// raw metadata into the PUBLIC Discover cards or the OpenAI draft endpoint.
let drishtiReady=false,drishtiLoading=false,drishtiLastChecked=0;
function drishtiMessage(text,isError=false){
 const node=$("drishtiStatus");node.textContent=text;
 node.dataset.error=isError?"true":"false";
}
async function drishtiRequest(mode){
 if(!managerKey)throw Error("Connect manager access in Studio first. Drishti API key stays only in Netlify.");
 let response,data;
 try{
  response=await fetch("/.netlify/functions/drishti-news?mode="+mode,{
   headers:{"x-manager-key":managerKey},cache:"no-store",
   signal:AbortSignal.timeout(15000)
  });
 }catch(e){throw Error(e?.name==="TimeoutError"||e?.name==="AbortError"?
  "Drishti connection timed out. Check Netlify network and try again.":
  "Could not reach the SignalDesk Drishti function from this browser.")}
 try{data=await response.json()}catch{throw Error("The Drishti function returned an unreadable response.")}
 if(!response.ok)throw Error(data.error||"Drishti request failed (HTTP "+response.status+").");
 return data;
}
function showDrishtiPanel(){
 $("drishtiPanel").hidden=source!=="Drishti";
 if(source==="Drishti"&&!managerKey){
  drishtiReady=false;$("drishtiLoad").disabled=true;
  $("drishtiStudioLink").hidden=false;
  drishtiMessage("Manager connection required. Open Studio, connect with the SignalDesk manager key, then return here. The Drishti key is only stored in Netlify.");
 }else if(source==="Drishti"){
  $("drishtiStudioLink").hidden=true;
 }
}
async function checkDrishtiAccess(){
 if(drishtiLoading)return;
 drishtiLoading=true;drishtiReady=false;
 $("drishtiCheck").disabled=true;$("drishtiLoad").disabled=true;
 drishtiMessage("Checking Drishti account and News access using the server-side API key…");
 try{
  const data=await drishtiRequest("status");
  drishtiReady=data.keyValid===true&&data.newsEnabled===true;
  if(!drishtiReady){
   drishtiMessage("Drishti account connected, but News product access is not enabled for this key. Check the Drishti developer console.",true);
  }else{
   drishtiMessage("Drishti connection successful. News product enabled. Select Load news to check actual Indian-market coverage (1 credit when results are returned).");
  }
  $("drishtiMeta").hidden=false;
  $("drishtiMeta").textContent="Account plan: "+(data.plan||"Unknown")+
   (typeof data.credits==="number"?" · Credits: "+data.credits:"")+
   " · Read-only manager trial";
 }catch(e){
  drishtiMessage("Connection check: "+String(e.message||e),true);
 }finally{
  drishtiLoading=false;$("drishtiCheck").disabled=false;
  $("drishtiLoad").disabled=!drishtiReady;
 }
}
function startDrishtiDraft(story){
 const url=validUrl(story?.originalUrl||"");
 if(!url||!story?.title){drishtiMessage("This story has no valid original publisher link. Verify the source before drafting.",true);return}
 const id="drishti:"+encodeURIComponent(url);
 if(!workspace.drafts[id]){
  const now=new Date().toISOString();
  workspace.drafts[id]={
   id,manual:false,source:{id,title:story.title,snippet:story.summary||"",url,
    publisher:story.publisher||"Original publisher",category:"Indian markets · Drishti trial",
    publishedAt:story.publishedAt||now,dateOnly:!story.publishedAt,
    provider:"Drishti",licensing:"internal_preview_only",demoOnly:true,suggestedHashtags:[]},
   variants:{news:"",insight:""},variant:"news",status:"Draft",verified:false,
   sourceLink:false,publishedText:"",xUrl:"",risks:["Drishti trial metadata is internal-only. Check original publisher facts.","External AI and public reuse require contractual rights."],
   hashtags:[],suggestedHashtags:[],createdAt:now,updatedAt:now
  };
  persist();
 }
 selectedId=id;navigate("studio");
 notify("Drishti story opened for internal review. For AI variants, select AI draft from verified facts and enter independently checked details. Trial content cannot be copied or published.");
}
function renderDrishtiTrial(rows){
 const list=$("drishtiList");list.replaceChildren();
 if(!rows.length){list.append(el("p","muted","No dated Drishti headlines were returned in the preview window. Try again later or check News coverage in the Drishti console."));return}
 for(const story of rows){
  const card=el("article","drishti-story");
  const top=el("div","drishti-story-meta");
  top.append(el("span","",story.publisher||"Original publisher not supplied"));
  const dt=Date.parse(story.publishedAt);
  if(Number.isFinite(dt))top.append(el("span","",new Date(dt).toLocaleString("en-IN",{timeZone:"Asia/Kolkata",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})));
  else top.append(el("span","","Publication time not supplied"));
  if(story.symbol)top.append(el("span","",story.symbol));
  const title=el("strong","",story.title);
  const summary=el("p","",story.summary||"Open the original source to verify the details.");
  const link=el("a","drishti-original","View original source ↗");
  link.href=story.originalUrl;link.target="_blank";link.rel="noopener noreferrer";
  const actions=el("div","drishti-story-actions");
  const create=el("button","drishti-create","✦ Create Tweet");
  create.type="button";
  create.addEventListener("click",()=>startDrishtiDraft(story));
  actions.append(create,link);
  card.append(top,title,summary,actions);list.append(card);
 }
}
async function loadDrishtiTrial(){
 if(drishtiLoading||!drishtiReady)return;
 drishtiLoading=true;$("drishtiLoad").disabled=true;$("drishtiCheck").disabled=true;
 drishtiMessage("Retrieving up to 20 recent market headlines from Drishti…");
 try{
  const data=await drishtiRequest("news");
  if(!Array.isArray(data.articles))throw Error("Drishti news response was not recognised.");
  renderDrishtiTrial(data.articles);
  drishtiLastChecked=Date.now();
  drishtiMessage("Loaded "+data.articles.length+" dated headlines. "+
   (data.cached?"Recent server cache used; no new provider call.":"Provider queried; a successful non-empty page uses one credit.")+
   " Review source freshness and relevance before choosing a subscription.");
 }catch(e){
  drishtiMessage("News loading failed: "+String(e.message||e),true);
 }finally{
  drishtiLoading=false;$("drishtiCheck").disabled=false;$("drishtiLoad").disabled=!drishtiReady;
 }
}
function switchSource(next){
 source=next;
 document.querySelectorAll("button[data-source]").forEach(x=>x.classList.toggle("selected",x.dataset.source===source));
 showPIBPanel();showMojoPanel();showDrishtiPanel();renderStories();
 if(source==="PIB")loadPIB();
}
function renderHealth(){
 $("total").textContent=payload.stories.length+mojoStories.length+pibStories.length;
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
 source==="Drishti"?"Drishti headlines are shown above. Select Create Tweet to prepare an internal draft; AI and publishing remain restricted during the trial.":
 source==="MarketsMojo"?(mojoStories.length?"No curated stories match these filters. Try Latest or 30 days.":"No MarketsMojo stories have been curated yet. Add a link, headline and verified facts above."):
 payload.stories.length?"No updates match these filters. Try 30 days or another source.":"No recent source-backed stories available. Check source health or retry.";
  list.append(el("div","empty",msg));return;
 }
 for(const s of shown){
  const item=el("article","news-card"),top=el("div","card-top");
  const existing=workspace.drafts[s.id];
  append(top,el("span","pill",s.publisher),el("span","pill secondary",s.category||"Official update"));
  if(s.curatedPOC)top.append(el("span","pill mojo-label","Curated · Internal POC"));
  if(s.provider==="PIB RSS")top.append(el("span","pill secondary","Government source · PIB"));
  const score=s.curatedPOC?el("span","score-label score-low","Manual selection"):
   el("span","score-label "+(important(s)?"score-high":priorityOf(s)>=60?"score-mid":"score-low"),
    (important(s)?"High impact · ":"Relevance · ")+priorityOf(s)+"/100");
  score.title=s.rankBasis||"Editorial relevance estimate, not a fact check";
  top.append(score);
  if(feedState.unread.includes(s.id))top.append(el("span","pill new-pill","NEW"));
  if(existing)top.append(el("span","pill "+(existing.status==="Published"?"":"secondary"),existing.status));
  const title=el("h3","card-title",s.title),summary=el("p","story-summary",s.snippet||"Open the original publisher source for details.");
  const meta=el("div","story-meta");
  append(meta,el("span","",s.curatedPOC?"Added to POC "+dateFmt(s.curatedAt||s.publishedAt):s.publishedAtEstimated?"Publication date not provided by PIB":dateFmt(s.publishedAt,false,s.dateOnly)));
  const rationale=el("p","why-relevant",s.reason||"Relevance is a provisional editorial estimate; verify the primary source.");
  const actions=el("div","story-buttons"),link=el("a","outline","Source ↗"),btn=el("button","outline dark",existing?"Continue draft →":"Create post →");
  link.href=validUrl(s.url)||"#";link.target="_blank";link.rel="noopener noreferrer";
  btn.type="button";btn.addEventListener("click",()=>startDraft(s));
  link.addEventListener("click",()=>readStory(s.id));
  if(s.curatedPOC){
   const remove=el("button","mojo-remove","Remove from POC");
   remove.type="button";remove.addEventListener("click",()=>removeMojo(s.id));actions.append(remove);
  }
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
 return s.curatedPOC?s.title:publisher+" update: "+s.title;
}
function startDraft(s){
 if(!s?.id||!validUrl(s.url))return;
 if(!workspace.drafts[s.id]){
  const ts=new Date().toISOString();
  workspace.drafts[s.id]={id:s.id,source:{id:s.id,title:s.title,snippet:s.snippet||"",url:s.url,publisher:s.publisher,category:s.category||"Official update",publishedAt:s.publishedAt,dateOnly:!!s.dateOnly,publishedAtEstimated:!!s.publishedAtEstimated,curatedPOC:!!s.curatedPOC,demoOnly:!!s.demoOnly,provider:s.provider||"Official RSS",suggestedHashtags:defaultTags(s)},
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
 renderAIConnectionState();
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
// This diagnostic intentionally sends NO manager key. A 401 from the
// unauthenticated endpoint is the expected, healthy reachability result.
async function checkComposerEndpoint(){
 const btn=$("composeCheckEndpoint"),output=$("composeDiagnostic");
 btn.disabled=true;btn.textContent="Checking…";output.textContent="Checking whether this browser can reach the SignalDesk AI function…";
 try{
  const response=await fetch("/.netlify/functions/ai-status",{
   cache:"no-store",signal:AbortSignal.timeout(12000)
  });
  if(response.status===401||response.ok){
   output.textContent="AI endpoint reachable from this computer (HTTP "+response.status+"). The expected HTTP 401 means access is protected. Now connect with your manager key; no separate OpenAI key is needed.";
  }else if(response.status===503){
   output.textContent="AI endpoint reachable, but Netlify reports that its server configuration is incomplete (HTTP 503). Check MANAGER_ACCESS_KEY and OPENAI_API_KEY in Netlify Functions.";
  }else if(response.status===404){
   output.textContent="This computer reached Netlify, but the AI function was not found (HTTP 404). Check the production deploy and function URL.";
  }else if(response.status===403||response.status===407){
   output.textContent="The AI function returned HTTP "+response.status+". A company proxy or security filter may be blocking the endpoint; ask IT to review this HTTPS URL.";
  }else{
   output.textContent="The AI function responded with HTTP "+response.status+". Try a hard refresh; if it persists, check the Netlify function logs.";
  }
 }catch(e){
  output.textContent=e?.name==="TimeoutError"||e?.name==="AbortError"?
   "The AI endpoint did not respond within 12 seconds from this computer. Check network, VPN and corporate firewall, or try another network.":
   "This browser could not reach the AI endpoint. Check network/VPN, Chrome security extensions or company web filtering. You can also open the endpoint test link; no key is included.";
 }finally{btn.disabled=false;btn.textContent="Check AI connection"}
}
async function connectComposerAI(){
 const candidate=$("composeManagerKey").value.trim();
 if(!candidate){
  if(!managerKey){
   $("composeCredentials").open=true;
   composeNotice("AI not connected. Enter the manager access key once on this computer.",true);
   updateComposeConnection();return false;
  }
  if(aiConnectionState==="connected"){
   composeNotice("AI is connected and ready for drafting in this browser tab.");
   updateComposeConnection();return true;
  }
 }
 $("composeConnect").disabled=true;$("composeConnect").textContent="Checking…";
 const verified=await verifyAIConnection(candidate||managerKey);
 if(verified){
  $("composeManagerKey").value="";$("composeCredentials").open=false;
  composeNotice("AI connected and verified with Netlify. You can generate tweet variants.");
 }else{
  $("composeCredentials").open=true;
  composeNotice("Could not connect AI: "+(aiConnectionDetail||"Connection could not be verified.")+".",true);
 }
 $("composeConnect").disabled=false;
 updateComposeConnection();
 return verified;
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
  if(response.status===401){disconnectAI();setAIConnectionState("error","Manager access was rejected. Reconnect with your current key.");$("composeCredentials").open=true}
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
 if(useAI&&aiConnectionState!=="connected"){
  if($("composeManagerKey").value.trim()||managerKey){
   const connected=await connectComposerAI();
   if(!connected)return;
  }else{
   $("composeCredentials").open=true;
   composeNotice("AI not connected. Enter your manager access key, then click Generate again.",true);
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
// Older manually created drafts may have a MarketsMojo source URL but lack
// the newer curatedPOC/demoOnly flags. Treat them as POC-only for safety.
function isMojoPOC(d){
 if(!d?.source)return false;
 if(d.source.demoOnly||d.source.curatedPOC||d.source.provider==="Drishti"||d.source.licensing==="internal_preview_only")return true;
 const publisher=String(d.source.publisher||"").trim().toLowerCase().replace(/^www\./,"");
 if(publisher==="marketsmojo"||publisher==="marketsmojo.com")return true;
 try{
  const host=new URL(d.source.url||"").hostname.toLowerCase();
  return host==="marketsmojo.com"||host==="www.marketsmojo.com";
 }catch{return false}
}
function reviewProblem(d,text){
 if(!d)return "No draft selected.";
 if(d.status==="Published")return "This post was already published.";
 if(!d.verified)return "Confirm that you reviewed the original source and checked the facts.";
 if(d.manual&&!validUrl(d.source.url))return "Add the original HTTPS source link before proceeding.";
 if(!String(d.variants?.[d.variant]||"").trim())return "Finish the selected draft before marking it ready.";
 if(text.length>280)return "The preview is "+text.length+" characters. Shorten it by "+(text.length-280)+" to fit the 280-character X limit.";
 return "";
}
function buildText(d){
 if(!d)return"";
 if(d.status==="Published"&&d.publishedText)return d.publishedText;
 const prefix=(workspace.disclosure||"").trim(),body=(d.variants[d.variant]||"").trim();
 // For internal MarketsMojo concept drafts, attribution is kept in Studio's
 // source-reference panel rather than presented as the author of Geojit's text.
 // These drafts are disabled for external publishing until licensing is cleared.
 const from=isMojoPOC(d)?"":d.manual&&!validUrl(d.source.url)?"Source: User-provided text (not verified)":
 "Source: "+d.source.publisher+(d.sourceLink&&validUrl(d.source.url)?" "+d.source.url:"");
 const uniqueTags=(Array.isArray(d.hashtags)?parseTags(d.hashtags.join(" ")):defaultTags(d.source))
  .filter(tag=>!body.toLowerCase().includes(tag.toLowerCase()));
 return [prefix,body,uniqueTags.join(" "),from].filter(Boolean).join("\n\n");
}
function updatePreview(){
 const d=current();if(!d)return;
 const demo=isMojoPOC(d),text=buildText(d),length=text.length,blocker=reviewProblem(d,text);
 $("studioPreview").textContent=text||"Start writing your post";
 $("studioCount").textContent=length+" / 280 characters";
 $("studioCount").classList.toggle("over-limit",length>280);
 // POC content may be internally reviewed but never sent to X from here.
 $("publishDetails").hidden=demo;
 $("publishDetails").open=!demo&&(d.status==="Ready"||d.status==="Published");
 $("draftStatus").textContent=d.status;
 $("sourceVerified").checked=!!d.verified;
 $("reviewCheckLabel").textContent=demo?
  "I reviewed the original and checked the draft facts for this internal POC":
  "I checked the original and verified the final text";
 $("markReady").disabled=!!blocker;
 $("markReady").textContent=d.status==="Published"?"Already published":
  demo?(d.status==="Ready for review"?"Review ready ✓":"Mark ready for review"):
  d.status==="Ready"?"Ready ✓":"Mark ready";
 $("reviewEligibility").textContent=blocker||(
  demo?(d.status==="Ready for review"?
   "Ready for internal management review. Copying and publishing remain disabled until content rights are approved.":
   "Ready for internal review. This does not authorise publication or external copying.") :
  d.status==="Ready"?"Ready for the manager's final publication checks.":"Source verified. You can mark this draft ready.");
 $("reviewEligibility").classList.toggle("review-warning",!!blocker);
 $("reviewPublishingNote").textContent=demo?
  "Internal POC only — final publication, copying and X composer are unavailable. Keep original-source attribution in the Studio reference.":
  "The manager publishes manually. Nothing is sent to X automatically.";
 $("copyFinal").disabled=demo||!["Ready","Published"].includes(d.status)||length>280;
 $("copyFinal").title=demo?"Copying POC content is disabled until reuse and publication permissions are confirmed.":"Copy the reviewed final post";
 $("recordPublished").disabled=demo||d.status!=="Ready";
 $("publishedUrl").disabled=demo||d.status==="Published";
 $("publishedUrl").value=d.xUrl||"";
 $("studioText").disabled=d.status==="Published";
 $("hashtagsInput").disabled=d.status==="Published";
 $("sourceLinkToggle").disabled=d.status==="Published";
 $("aiGenerate").disabled=d.status==="Published"||generating;
  $("aiGenerate").textContent=d.source.provider==="Drishti"?"✦ AI draft from verified facts":"✦ Generate 2 AI versions";
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
 // One-time safety migration for previously generated POC posts that made the
 // news provider the narrative subject. They must be regenerated, not silently
 // transformed into an asserted Geojit research opinion.
 if(isMojoPOC(d)&&d.status!=="Published"&&!d.editorialVoiceV2){
  const wronglyFramed=["news","insight"].some(v=>/\bmarketsmojo\b/i.test(String(d.variants?.[v]||"")));
  if(wronglyFramed){
   d.variants={news:"",insight:""};d.variant="news";
   d.contextStatus="needs_source";
   d.contextNote="Regenerate using the updated Geojit voice. Verify the source facts before writing an explanation.";
   d.risks=[...new Set(["An earlier draft used the news provider's voice. It was cleared for regeneration.",...(d.risks||[])])].slice(0,9);
   d.status="Draft";d.verified=false;
  }
  d.source.demoOnly=true;
  d.editorialVoiceV2=true;persist();
 }
 const sel=$("draftSelect");sel.replaceChildren();
 for(const x of entries){
  const opt=el("option","",x.source.publisher+" · "+x.source.title.slice(0,90));
  opt.value=x.id;opt.selected=x.id===selectedId;sel.append(opt);
 }
 $("studioStoryTitle").textContent=d.source.title;
 $("studioSourceMeta").textContent=d.source.publisher+" · "+(d.source.curatedPOC?"Manually curated for POC":d.source.publishedAtEstimated?"Publication date not supplied":dateFmt(d.source.publishedAt,true,d.source.dateOnly))+" · "+d.source.category;
 $("studioDemoNotice").hidden=!isMojoPOC(d);
  if(isMojoPOC(d)&&d.source.provider==="Drishti")$("studioDemoNotice").textContent="DRISHTI TRIAL · Internal feed text cannot be sent to AI. Select AI draft from verified facts to enter independently checked publisher information. Copying and publishing this trial draft remain disabled.";
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
 if(isMojoPOC(d))
  $("evidenceBasis").textContent=d.source.provider==="Drishti"?"Drishti provides news discovery metadata only. Verify the publisher source and supply your own factual notes to AI through Create from news. No Drishti trial text is sent to AI.":"Geojit editorial voice: only editor-supplied facts are used. MarketsMojo remains a source reference, never the author of the draft. No article was fetched by SignalDesk. Demo only.";
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
  if(d.source.provider==="Drishti"||d.source.licensing==="internal_preview_only"){
   // Open independent source-backed composer; never copy Drishti summary or headline to AI.
   navigate("discover");composerOpen(true);setComposerMode("link");
   $("composeURL").value=d.source.url||"";
   $("composeHeadline").value="";$("composeExcerpt").value="";
   $("composeFallback").open=true;updateComposeLinkHelp();
   composeNotice("Check the original publisher and enter independently verified facts. Drishti trial text will not be sent to AI.");
   $("composeHeadline").focus();return;
  }
 if(!managerKey){$("aiSetupPanel").open=true;notify("AI not connected. Enter your manager key to generate AI versions.",true);$("managerKey").focus();return}
 if(aiConnectionState!=="connected"){
  const valid=await verifyAIConnection(managerKey);
  if(!valid){$("aiSetupPanel").open=true;notify("AI connection issue: "+aiConnectionDetail+". Reconnect before generating.",true);return}
 }
 generating=true;$("aiGenerate").disabled=true;$("aiGenerate").textContent="Generating…";
 try{
  const result=await fetch("/.netlify/functions/draft",{method:"POST",headers:{"Content-Type":"application/json","x-manager-key":managerKey},body:JSON.stringify({title:d.source.title,snippet:d.source.snippet,publisher:d.source.publisher,publishedAt:d.source.publishedAt,sourceUrl:d.source.url,userPasted:!!d.manual||isMojoPOC(d)})});
  const body=await result.json();
  if(!result.ok){
   if(result.status===401){disconnectAI();setAIConnectionState("error","Netlify rejected the manager key. Connect again.");$("aiSetupPanel").open=true}
   throw Error(body.error||"AI drafting unavailable");
  }
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
$("composeCheckEndpoint").addEventListener("click",checkComposerEndpoint);
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
$("desktopAlertToggle").addEventListener("click",toggleDesktopAlerts);
$("desktopAlertTest").addEventListener("click",testDesktopAlert);
$("alertsClose").addEventListener("click",()=>setAlertsOpen(false));
$("clearAlerts").addEventListener("click",()=>{
 feedState.unread=[];saveFeedState();updateAlertUI();setAlertsOpen(false);renderStories();
});
document.addEventListener("click",e=>{if(alertsOpen&&!e.target.closest(".alert-anchor"))setAlertsOpen(false)});
$("drishtiCheck").addEventListener("click",checkDrishtiAccess);
 $("drishtiLoad").addEventListener("click",loadDrishtiTrial);
 $("drishtiStudioLink").addEventListener("click",()=>{navigate("studio");$("aiSetupPanel").open=true;});
 $("pibReload").addEventListener("click",()=>{pibLoadedAt=0;loadPIB()});
 $("mojoOpenForm").addEventListener("click",()=>setMojoForm($("mojoForm").hidden));
$("mojoCancel").addEventListener("click",()=>setMojoForm(false));
$("mojoForm").addEventListener("submit",e=>{e.preventDefault();addMojoStory(false)});
$("mojoAddAndDraft").addEventListener("click",()=>addMojoStory(true));
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
 const text=buildText(d),blocker=reviewProblem(d,text);
 if(blocker){notify(blocker,true);updatePreview();return}
 const demo=isMojoPOC(d);
 d.status=demo?"Ready for review":"Ready";
 d.updatedAt=new Date().toISOString();persist();updatePreview();
 notify(demo?
  "Ready for internal management review. This POC is not cleared for external copying or publishing.":
  "Draft is marked Ready in this browser. Check Geojit compliance requirements before copying or publishing.");
});
$("copyFinal").addEventListener("click",async()=>{
 const d=current();if(!d||isMojoPOC(d)||!["Ready","Published"].includes(d.status))return;
 const text=buildText(d);if(!text||text.length>280)return;
 try{await navigator.clipboard.writeText(text);notify("Final text copied. Publication on X is completely manual.")}
 catch(e){notify("Clipboard access was blocked by your browser. Select the preview and copy it manually.",true)}
});
$("recordPublished").addEventListener("click",()=>{
 const d=current();if(!d||isMojoPOC(d)||d.status!=="Ready")return;
 const actual=sourceURLAccepted($("publishedUrl").value.trim());
 if(!actual){$("recordMessage").textContent="Enter a valid X post URL such as https://x.com/account/status/123456789";return}
 d.publishedText=buildText(d);d.xUrl=actual;d.status="Published";d.updatedAt=new Date().toISOString();
 persist();renderStudio();renderPublished();notify("Manual publication recorded in this browser. This is not a compliance archive.");
});
$("saveManagerKey").addEventListener("click",async()=>{
 const candidate=$("managerKey").value.trim();
 if(!candidate&&!managerKey){
  $("aiSetupPanel").open=true;
  notify("AI not connected. Enter your manager access key first.",true);return;
 }
 $("saveManagerKey").disabled=true;$("saveManagerKey").textContent="Checking…";
 const connected=await verifyAIConnection(candidate||managerKey);
 if(connected){
  $("managerKey").value="";
  notify("AI connected and verified with Netlify. You can generate AI versions.");
 }else{
  $("aiSetupPanel").open=true;
  notify("AI connection issue: "+(aiConnectionDetail||"Could not verify access.")+" Manual drafting remains available.",true);
 }
 $("saveManagerKey").disabled=false;renderAIConnectionState();
});
$("studioAIRecheck").addEventListener("click",async()=>{
 if(!managerKey){setAIConnectionState("disconnected");return}
 const ok=await verifyAIConnection(managerKey);
 notify(ok?"AI connected and verified for this browser tab.":"AI check: "+aiConnectionDetail,!ok);
});
$("studioAIDisconnect").addEventListener("click",()=>{
 disconnectAI();
 notify("AI disconnected from this browser tab. Your drafts are unaffected.");
});
$("aiGenerate").addEventListener("click",generate);
const initialView=location.hash.replace("#","");
updateComposeConnection();
if(managerKey)void verifyAIConnection(managerKey,{remember:false});
renderDesktopAlertControls();
updateNavCounts();navigate(initialView,false);refresh();
setInterval(()=>{if(!document.hidden||desktopAlertsActive())refresh()},5*60*1000);
window.addEventListener("storage",event=>{if(event.key===desktopAlertPrefKey){desktopAlertsEnabled=readDesktopAlertPreference();renderDesktopAlertControls()}});
})();