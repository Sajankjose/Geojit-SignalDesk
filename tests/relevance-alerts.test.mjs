import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {rankOfficialStory,suggestedHashtags} from "../netlify/functions/lib/editorial.mjs";
const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const ui=readFileSync(new URL("../official-poc.js",import.meta.url),"utf8");
const api=readFileSync(new URL("../netlify/functions/official-feed.mjs",import.meta.url),"utf8");
const ai=readFileSync(new URL("../netlify/functions/draft.mjs",import.meta.url),"utf8");
const now=Date.UTC(2026,9,27,10,0,0);
const item=(title,publisher="RBI",days=1)=>({title,publisher,snippet:"Official update",publishedAt:new Date(now-days*86400000).toISOString()});
test("Big policy-rate announcements rank above routine auction notices",()=>{
 const major=rankOfficialStory(item("Monetary Policy Committee policy repo rate decision"),now);
 const routine=rankOfficialStory(item("Variable Rate Repo VRR auction under LAF"),now);
 assert.ok(major.priority>routine.priority+12);
 assert.equal(major.impact,"high");
 assert.ok(major.reason.includes("Policy-rate"));
 assert.ok(major.rankBasis.includes("estimate"));
});
test("Recent releases score above otherwise identical older releases",()=>{
 const latest=rankOfficialStory(item("New regulatory framework for stock brokers","SEBI",0.2),now);
 const old=rankOfficialStory(item("New regulatory framework for stock brokers","SEBI",18),now);
 assert.ok(latest.priority>old.priority);
});
test("Only conservative topic-linked hashtags are offered",()=>{
 assert.deepEqual(suggestedHashtags(item("RBI monetary policy repo rate")),["#MonetaryPolicy","#RBI"]);
 assert.deepEqual(suggestedHashtags(item("New mutual fund scheme regulations","SEBI")),["#MutualFunds","#SEBI"]);
 assert.ok(suggestedHashtags(item("Office administrative update","RBI")).length<=2);
});
test("Ranked feed controls and new-only bell coexist with source filter",()=>{
 for(const mode of ["top","latest","high","unread"])assert.ok(html.includes('data-rank="'+mode+'"'));
 for(const id of ["alertsPanel","alertsButton","alertCount","unreadCount","rankingTabs","feedAlertStatus","hashtagSuggestions","hashtagsInput"])assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(ui,/rankMode==="latest"/);
 assert.match(ui,/priorityOf\(b\)-priorityOf\(a\)/);
 assert.match(ui,/setInterval\(\(\)=>\{if\(!document\.hidden\)refresh\(\)\}/);
 assert.match(ui,/firstVisit=known\.size===0/);
 assert.match(ui,/if\(!firstVisit/);
 assert.doesNotMatch(ui,/Notification\.requestPermission\(|serviceWorker\.register\(/);
});
test("Editorial scores are server-produced and clearly estimated",()=>{
 assert.match(api,/rankOfficialStory\(base\)/);
 assert.match(api,/rankBasis|rankingInfo/);
});
test("Hashtags are appended only once, editable, verified, and in draft preview",()=>{
 assert.match(ui,/const parseTags=/);
 assert.match(ui,/const uniqueTags=/);
 assert.match(ui,/!body\.toLowerCase\(\)\.includes\(tag\.toLowerCase\(\)\)/);
 assert.match(ui,/hashtagsInput"\)\.addEventListener\("input"/);
 assert.match(ui,/hashtags:defaultTags\(s\)/);
 assert.match(ui,/d\.hashtags=Array\.isArray\(body\.hashtags\)/);
 assert.match(ai,/Do NOT place any hashtag in the news or insight text itself/);
 assert.doesNotMatch(ui,/api\.x\.com\/2\/tweets|api\.twitter\.com\/2\/tweets/i);
});
