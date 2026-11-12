import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {runInContext,createContext} from "node:vm";
const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const js=readFileSync(new URL("../official-poc.js",import.meta.url),"utf8");
const css=readFileSync(new URL("../official-poc.css",import.meta.url),"utf8");
const github=readFileSync(new URL("../.github/workflows/official-feeds.yml",import.meta.url),"utf8");

const p=js.indexOf("const mojoStorageKey="),q=js.indexOf("function updateMojoCount(){",p);
assert.ok(p>=0&&q>p,"MarketsMojo core module is present");
function ctx(records=[]){
 const scope={URL,Date,Math,mojoStories:[],localStorage:{getItem:()=>JSON.stringify(records)}};
 const context=createContext(scope);
 runInContext(js.slice(p,q),context);
 return context;
}
const evalIn=(context,code)=>JSON.parse(JSON.stringify(runInContext(code,context)));
test("MarketsMojo POC accepts only HTTPS news URLs on the exact publisher domain",()=>{
 const context=ctx();
 assert.equal(evalIn(context,'validMojoUrl("https://www.marketsmojo.com/news/markets-today")'),
   "https://www.marketsmojo.com/news/markets-today");
 assert.equal(evalIn(context,'validMojoUrl("https://marketsmojo.com/news/market-update")'),
   "https://marketsmojo.com/news/market-update");
 for(const url of ["http://marketsmojo.com/news/x","https://notmarketsmojo.com/news/x",
   "https://marketsmojo.com.evil.example/news/x","https://evil.example/",
   "https://marketsmojo.com/markets","javascript:alert(1)"]){
  assert.equal(evalIn(context,"validMojoUrl("+JSON.stringify(url)+")"),"",url);
 }
});
test("Browser-local curation normalizes real source links and never invents article publication dates",()=>{
 const context=ctx([
  {url:"https://www.marketsmojo.com/news/market-update",title:"India market indices ended higher in a volatile session",
   category:"Market updates",snippet:"An independently checked factual note.",curatedAt:"2026-11-12T09:00:00.000Z"},
  {url:"https://notmarketsmojo.example/news/example",title:"Unsafe external story"}
 ]);
 const stories=evalIn(context,"mojoStories");
 assert.equal(stories.length,1);
 assert.equal(stories[0].publisher,"MarketsMojo");
 assert.equal(stories[0].provider,"MarketsMojo POC");
 assert.equal(stories[0].curatedPOC,true);
 assert.equal(stories[0].demoOnly,true);
 assert.equal(stories[0].publishedAtEstimated,true);
 assert.equal(stories[0].snippet,"An independently checked factual note.");
 assert.equal(stories[0].priority,55);
 assert.match(stories[0].rankBasis,/not market relevance/);
});
test("MarketsMojo POC UI shows editor input and real source link, not a fake automatic connection",()=>{
 assert.match(html,/data-source="MarketsMojo"/);
 assert.match(html,/https:\/\/www\.marketsmojo\.com\/news\/markets-today/);
 for(const id of ["mojoPanel","mojoOpenForm","mojoForm","mojoURL","mojoHeadline","mojoFacts","mojoAddAndDraft","mojoCount","studioDemoNotice"]){
  assert.ok(html.includes('id="'+id+'"'),id)
 }
 assert.match(html,/Nothing is scraped or automatically synced/);
 assert.match(html,/No permission for external publishing/);
 assert.match(js,/function addMojoStory\(withAI=false\)/);
 assert.match(js,/mojoStories\.unshift\(story\)/);
 assert.match(js,/if\(managerKey\)generate\(\)/);
 assert.match(js,/source==="all"\?\[\.\.\.payload.stories,\.\.\.pibStories,\.\.\.mojoStories\]/);
});
test("All new MarketsMojo drafts remain internal demos and AI receives user-provided facts",()=>{
 assert.match(js,/demoOnly:!!s\.demoOnly/);
 assert.match(js,/userPasted:!!d\.manual\|\|!!d\.source\.curatedPOC/);
 assert.match(js,/\$\("markReady"\)\.disabled=!!d\.source\.demoOnly/);
 assert.match(js,/\$\("copyFinal"\)\.disabled=!!d\.source\.demoOnly/);
 assert.match(js,/\$\("recordPublished"\)\.disabled=!!d\.source\.demoOnly/);
 assert.match(js,/if\(d\.source\.demoOnly\)\{notify\("MarketsMojo POC drafts/);
 assert.match(js,/if\(!d\|\|d\.source\.demoOnly\|\|!\["Ready","Published"\]/);
 assert.match(js,/if\(!d\|\|d\.source\.demoOnly\|\|d\.status!=="Ready"\)/);
 assert.match(js,/No article was fetched by SignalDesk/);
 assert.doesNotMatch(js,/api\.x\.com\/2\/tweets|api\.twitter\.com\/2\/tweets/i);
});
test("Retire Marketaux source, manager-cookie endpoints, and all frontend references",()=>{
 assert.doesNotMatch(html+js+css,/marketaux/i);
 for(const file of ["netlify/functions/marketaux-news.mjs","netlify/functions/marketaux-session.mjs",
 "netlify/functions/lib/marketaux-auth.mjs","MARKETAUX_POC.md"]){
  assert.equal(existsSync(new URL("../"+file,import.meta.url)),false,file);
 }
 assert.doesNotMatch(github,/marketaux/i);
});
