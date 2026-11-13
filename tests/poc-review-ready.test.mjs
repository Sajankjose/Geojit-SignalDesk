import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createContext,runInContext} from "node:vm";
const script=readFileSync(new URL("../official-poc.js",import.meta.url),"utf8");
const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const css=readFileSync(new URL("../official-poc.css",import.meta.url),"utf8");
const begin=script.indexOf("function isMojoPOC(d){");
const end=script.indexOf("function renderStudio(){",begin);
assert.ok(begin>=0&&end>begin,"Review helpers must be available in browser code");
const helpers=script.slice(begin,end);
const handlerStart=script.indexOf('$("markReady").addEventListener("click"');
const handlerEnd=script.indexOf('$("copyFinal").addEventListener("click"',handlerStart);
assert.ok(handlerStart>0&&handlerEnd>handlerStart);
function makeDraft({publisher="MarketsMojo",url="https://www.marketsmojo.com/news/market-update",verified=true,body="Sensex declined as major sectors moved differently.",status="Draft",demoOnly=false}={}){
 return {source:{publisher,url,category:"Market updates",demoOnly,curatedPOC:false},
  variants:{news:body,insight:""},variant:"news",hashtags:["#Sensex"],verified,manual:true,
  sourceLink:false,status,xUrl:""};
}
function simulator(d){
 const dom=new Map();
 const $=id=>{
  if(!dom.has(id))dom.set(id,{id,hidden:false,disabled:false,textContent:"",open:false,title:"",
   classList:{toggle(){}},addEventListener(event,callback){this.clickCallback=callback}});
  return dom.get(id)
 };
 let persisted=0,lastNotice=null;
 const context=createContext({URL,Date,Math,current:()=>d,
  workspace:{disclosure:""},generating:false,$,
  defaultTags:()=>[],parseTags:s=>s.split(" ").filter(Boolean),
  validUrl:u=>typeof u==="string"&&u.startsWith("https://")?u:"",
  persist:()=>{persisted++},notify:(message,error)=>{lastNotice={message,error}}});
 runInContext(helpers,context);
 runInContext(script.slice(handlerStart,handlerEnd),context);
 const fn=(src)=>runInContext(src,context);
 return {dom,$,context,fn,get persisted(){return persisted},get notice(){return lastNotice},
  update(){fn("updatePreview()")},click(){ $("markReady").clickCallback() }};
}
test("Verified MarketsMojo POC draft enables Mark ready for review without enabling external posting",()=>{
 const d=makeDraft({demoOnly:true});
 const sim=simulator(d);
 sim.update();
 assert.equal(sim.$("markReady").disabled,false);
 assert.equal(sim.$("markReady").textContent,"Mark ready for review");
 assert.equal(sim.$("copyFinal").disabled,true);
 assert.equal(sim.$("recordPublished").disabled,true);
 assert.equal(sim.$("publishDetails").hidden,true);
 assert.match(sim.$("reviewEligibility").textContent,/internal review/i);
 sim.click();
 assert.equal(d.status,"Ready for review");
 assert.equal(sim.$("markReady").textContent,"Review ready ✓");
 assert.equal(sim.$("copyFinal").disabled,true);
 assert.equal(sim.$("recordPublished").disabled,true);
 assert.match(sim.notice.message,/internal management review/);
 assert.ok(sim.persisted>0);
});
test("Old MarketsMojo draft without POC flags is still review-only and loses publisher line in preview",()=>{
 const d=makeDraft({demoOnly:false});
 const sim=simulator(d);
 sim.update();
 assert.equal(sim.fn("isMojoPOC(current())"),true);
 assert.equal(sim.$("markReady").disabled,false);
 assert.equal(sim.$("markReady").textContent,"Mark ready for review");
 assert.equal(sim.$("copyFinal").disabled,true);
 assert.equal(sim.$("publishDetails").hidden,true);
 assert.doesNotMatch(sim.$("studioPreview").textContent,/Source: MarketsMojo/i);
 assert.match(sim.$("studioPreview").textContent,/#Sensex/);
 sim.click();
 assert.equal(d.status,"Ready for review");
});
test("Unchecked source verification gives a specific blocker, not a silent disabled button",()=>{
 const d=makeDraft({verified:false});
 const sim=simulator(d);sim.update();
 assert.equal(sim.$("markReady").disabled,true);
 assert.match(sim.$("reviewEligibility").textContent,/reviewed the original source/);
});
test("Over 280 chars shows exact amount to shorten for POC and normal drafts",()=>{
 const d=makeDraft({body:"An unverified and overly verbose statement. ".repeat(9)});
 const sim=simulator(d);sim.update();
 assert.equal(sim.$("markReady").disabled,true);
 assert.match(sim.$("reviewEligibility").textContent,/Shorten it by \d+ to fit/);
});
test("RBI official drafts preserve standard Ready and manual publish workflow",()=>{
 const d=makeDraft({publisher:"RBI",url:"https://www.rbi.org.in/Scripts/pressreleases.aspx",
  status:"Ready",demoOnly:false});
 const sim=simulator(d);sim.update();
 assert.equal(sim.fn("isMojoPOC(current())"),false);
 assert.equal(sim.$("markReady").disabled,false);
 assert.equal(sim.$("markReady").textContent,"Ready ✓");
 assert.equal(sim.$("copyFinal").disabled,false);
 assert.equal(sim.$("publishDetails").hidden,false);
});
test("POC status and attribution are not mistaken for X publication permissions",()=>{
 for(const id of ["reviewEligibility","reviewCheckLabel","reviewPublishingNote","markReady"]){
  assert.match(html,new RegExp('id="'+id+'"'));
 }
 assert.match(css,/\.publishing-details\[hidden\]\{display:none!important\}/);
 assert.match(script,/d\.status=demo\?"Ready for review":"Ready"/);
 assert.match(script,/if\(!d\|\|isMojoPOC\(d\)\|\|d\.status!=="Ready"\)return/);
 assert.match(script,/if\(!d\|\|isMojoPOC\(d\)\|\|!\["Ready","Published"\]\.includes\(d\.status\)\)return/);
 assert.doesNotMatch(script,/api\.x\.com\/2\/tweets|api\.twitter\.com\/2\/tweets/);
});
