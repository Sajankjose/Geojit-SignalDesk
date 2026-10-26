import test from "node:test";
import assert from "node:assert/strict";
import {classify,inWindow,fetchOfficialFeeds,FEED_SOURCES} from "../netlify/functions/official-feed.mjs";

test("Official feed sources only contain RBI and SEBI",()=>{
  assert.equal(FEED_SOURCES.length,4);
  for(const s of FEED_SOURCES)assert.match(s.url,/^https:\/\/(www\.)?(rbi\.org\.in|sebi\.gov\.in)\//);
});
test("Interest-rate announcements rank ahead of general official updates",()=>{
 const a=classify({title:"RBI monetary policy and repo rate decision",snippet:""});
 const b=classify({title:"RBI annual awareness workshop",snippet:""});
 assert.equal(a.category,"Monetary policy");
 assert.ok(a.priority>b.priority);
});
test("Freshness range excludes future/outdated and invalid dates",()=>{
 const now=Date.UTC(2026,9,26,10);
 assert.equal(inWindow("2026-10-25T10:00:00Z",7,now),true);
 assert.equal(inWindow("2026-09-01T10:00:00Z",7,now),false);
 assert.equal(inWindow("not-a-date",7,now),false);
 assert.equal(inWindow("2026-11-01T10:00:00Z",7,now),false);
});
test("Malformed and unreachable regulators display source failures, not fabricated stories",async()=>{
 const old=globalThis.fetch;
 globalThis.fetch=async()=>new Response("error",{status:503});
 try{
   const result=await fetchOfficialFeeds();
   assert.equal(result.sources.length,4);
   assert.ok(result.sources.every(s=>!s.ok));
   assert.deepEqual(result.stories,[]);
   assert.ok(result.warnings.length);
 }finally{globalThis.fetch=old}
});
test("Official headlines preserve publisher and original link",async()=>{
 const old=globalThis.fetch;
 const stamp=new Date().toUTCString();
 globalThis.fetch=async url=>new Response('<rss><channel><item><title><![CDATA[RBI announces policy update]]></title><link>https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx?prid=111</link><description>Official regulator update</description><pubDate>'+stamp+'</pubDate></item></channel></rss>',{status:200});
 try{
   const result=await fetchOfficialFeeds();
   assert.ok(result.stories.length>0);
   assert.equal(result.stories[0].title,"RBI announces policy update");
   assert.equal(result.stories[0].publisher,"RBI");
   assert.match(result.stories[0].url,/rbi\.org\.in/);
   assert.equal(result.demo,true);
 }finally{globalThis.fetch=old}
});
