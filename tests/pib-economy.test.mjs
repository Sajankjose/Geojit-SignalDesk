import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import pibHandler,{preparePIBStories,PIB_FEED_URL,loadPIB} from "../netlify/functions/pib-economy.mjs";
const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const client=readFileSync(new URL("../official-poc.js",import.meta.url),"utf8");
const now=Date.UTC(2026,9,29,10,0,0);
const item=(title,url,at=now-3600_000,description="")=>`<item><title><![CDATA[${title}]]></title><link>${url}</link><description><![CDATA[${description}]]></description><pubDate>${new Date(at).toUTCString()}</pubDate></item>`;
const xml=items=>"<rss version=\"2.0\"><channel>"+items.join("")+"</channel></rss>";
test("PIB RSS is a preconfigured official government source, not an arbitrary URL",()=>{
 assert.equal(PIB_FEED_URL,"https://www.pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3");
});
test("Filter finance and economy headlines but exclude unrelated news and offsite links",()=>{
 const rss=xml([
  item("Ministry of Finance releases banking policy update","https://pib.gov.in/PressReleasePage.aspx?PRID=12001"),
  item("Launch of regional classical dance festival","https://pib.gov.in/PressReleasePage.aspx?PRID=12002"),
  item("India publishes GDP estimates and inflation data","https://pib.gov.in/PressReleasePage.aspx?PRID=12003"),
  item("Ministry of Finance publication","https://evil.example/article"),
  item("Banking press release from last year","https://pib.gov.in/PressReleasePage.aspx?PRID=12004",now-400*86400000)
 ]);
 const rows=preparePIBStories(rss,now);
 assert.equal(rows.length,2);
 assert.ok(rows.every(r=>r.publisher==="PIB"&&r.provider==="PIB RSS"&&r.official));
 assert.ok(rows.every(r=>r.url.startsWith("https://pib.gov.in/")));
 assert.ok(rows.every(r=>r.rightsNote.includes("attribution")));
 assert.ok(rows.every(r=>r.priority<=85));
});
test("Endpoint provides source attribution and no manager login or Marketaux request",async()=>{
 const old=globalThis.fetch;let called=0;
 try{
  globalThis.fetch=async (url,opts)=>{
   called++;assert.ok([PIB_FEED_URL,"https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3"].includes(url));
   assert.equal(opts.redirect,"manual");
   return new Response(xml([item("India government announces new infrastructure investment programme","https://pib.gov.in/PressReleasePage.aspx?PRID=12555",Date.now()-2000)]),{status:200,headers:{"content-type":"application/rss+xml"}});
  };
  const res=await pibHandler(new Request("https://geojitsignaldesk.netlify.app/.netlify/functions/pib-economy"));
  assert.equal(res.status,200);
  const body=await res.json();
  assert.equal(body.stories.length,1);
  assert.match(body.attribution,/Press Information Bureau/);
  assert.ok(called>=1&&called<=2);
  assert.ok(!JSON.stringify(body).includes("MARKETAUX_API_TOKEN"));
 }finally{globalThis.fetch=old}
});
test("Malformed upstream response is an error and never invents stories",()=>{
 assert.deepEqual(preparePIBStories("<html>Not a feed</html>",now),[]);
});
test("Discover has a standalone government feed and clear alternative to blocked Marketaux",()=>{
 assert.match(html,/data-source="PIB"/);
 for(const id of ["pibPanel","pibReload","pibStatus","openPibAlternative"])assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(client,/async function loadPIB\(/);
 assert.match(client,/if\(source==="PIB"\)loadPIB\(\)/);
 assert.match(client,/provider==="PIB RSS"/);
 assert.match(client,/source==="all"\?\[\.\.\.payload.stories,\.\.\.pibStories,\.\.\.marketauxStories\]/);
 assert.match(client,/\$\("openPibAlternative"\)\.addEventListener/);
 assert.doesNotMatch(client,/api\.x\.com\/2\/tweets|api\.twitter\.com\/2\/tweets/);
});

test("Same-origin PIB redirects are followed safely and never leave the publisher's RSS hostname",async()=>{
 const old=globalThis.fetch;let redirected=0;
 try{
  globalThis.fetch=async (url,opts)=>{
   if(url.startsWith("https://www.pib.gov.in")){redirected++;return new Response(null,{status:302,headers:{location:"https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3"}})}
   return new Response(xml([item("Ministry of Finance reports banking reforms","https://pib.gov.in/PressReleasePage.aspx?PRID=18923",Date.now()-3000)]),{status:200});
  };
  const value=await loadPIB();
  assert.ok(Array.isArray(value.stories));
  assert.ok(value.stories.length>=1);
 }finally{globalThis.fetch=old}
});

test("Actual PIB-style title/link-only RSS items are retained and explicitly marked undated",()=>{
 const current=Date.UTC(2026,9,29,13,0,0);
 const raw='<rss version="2.0"><channel><title>Press Information Bureau</title>'+
  '<item><title>Ministry of Finance announces new banking measures</title><link>https://pib.gov.in/PressReleaseIframePage.aspx?PRID=2222222</link></item>'+
  '<item><title>Regional arts event held today</title><link>https://pib.gov.in/PressReleaseIframePage.aspx?PRID=2222221</link></item></channel></rss>';
 const result=preparePIBStories(raw,current);
 assert.equal(result.length,1);
 assert.equal(result[0].provider,"PIB RSS");
 assert.equal(result[0].publishedAtEstimated,true);
 assert.equal(result[0].publishedAt,new Date(current).toISOString());
 assert.match(result[0].rankBasis,/NOT original publication/);
 assert.ok(result[0].priority<=65);
});
test("Frontend does not misstate RSS retrieval time as PIB story publication time",()=>{
 assert.match(client,/Publication date not provided by PIB/);
 assert.match(client,/Publication date not supplied/);
 assert.match(client,/publishedAtEstimated:!!s\.publishedAtEstimated/);
});
