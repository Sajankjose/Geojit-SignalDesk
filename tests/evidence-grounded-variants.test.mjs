import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {vagueOpening,sweepingImpact,prepareDraftResult} from "../netlify/functions/lib/draft-quality.mjs";
import draftHandler from "../netlify/functions/draft.mjs";

const ui=readFileSync(new URL("../official-poc.js",import.meta.url),"utf8");
const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const server=readFileSync(new URL("../netlify/functions/draft.mjs",import.meta.url),"utf8");
const evidence={title:"Cybersecurity Training Institute in Bhubaneswar, Odisha",excerpt:"",publisher:"RBI",userPasted:false};
const raw={news:"This development could strengthen India's financial system.",insight:"This development may improve security and efficiency, boosting investor confidence and operational resilience.",hashtags:["#RBI","#Cybersecurity"],risks:[],contextStatus:"supported",contextNote:"Potential effects on the system."};

test("Avoid news and context versions starting with an unexplained This",()=>{
 assert.equal(vagueOpening("This development could change investor confidence."),true);
 assert.equal(vagueOpening("The move could benefit consumers."),true);
 assert.equal(vagueOpening("RBI has announced a cybersecurity training institute."),false);
 assert.equal(vagueOpening("A cybersecurity institute has been announced in Odisha."),false);
});
test("Flag sweeping benefit claims even when opening names a subject",()=>{
 assert.equal(sweepingImpact("RBI's institute will boost investor confidence."),true);
 assert.equal(sweepingImpact("RBI's institute is set to transform the market."),true);
 assert.equal(sweepingImpact("RBI announced training facilities in Odisha."),false);
});
test("Withhold speculative Why It Matters rather than inventing relevance",()=>{
 const result=prepareDraftResult(raw,evidence);
 assert.ok(result.news.startsWith("RBI: "));
 assert.ok(!vagueOpening(result.news));
 assert.equal(result.insight,"");
 assert.equal(result.contextStatus,"needs_source");
 assert.match(result.contextNote,/source/);
 assert.ok(result.risks.some(x=>/source|headline/i.test(x)));
});
test("Preserve evidence-grounded independent versions",()=>{
 const result=prepareDraftResult({
  news:"RBI announced a cybersecurity training institute in Bhubaneswar.",
  insight:"RBI's institute will offer specialised cyber training for regulated entities.",
  hashtags:["#RBI","#Cybersecurity","#Noise"],
  risks:[],contextStatus:"supported",contextNote:"The source says who receives training."
 },{title:evidence.title,excerpt:"The institute will offer cyber training for regulated entities.",publisher:"RBI",userPasted:false});
 assert.match(result.news,/^RBI announced/);
 assert.match(result.insight,/^RBI's institute/);
 assert.equal(result.contextStatus,"supported");
 assert.equal(result.hashtags.length,2);
});
test("Explicitly allow no speculative context when the evidence is insufficient",()=>{
 const result=prepareDraftResult({
  news:"RBI announced a new institute in Bhubaneswar.",
  insight:"",
  hashtags:["#RBI"],risks:[],contextStatus:"needs_source",contextNote:"Check the release for audience and scope."
 },evidence);
 assert.equal(result.insight,"");
 assert.match(result.contextNote,/audience and scope/);
});
test("Studio uses News Update / Why It Matters and displays source-evidence limitations",()=>{
 assert.match(html,/>News Update<\/button>/);
 assert.match(html,/>Why It Matters<\/button>/);
 for(const id of ["variantHint","evidenceBasis","contextNotice"]){
  assert.ok(html.includes('id="'+id+'"'),id);
 }
 assert.match(ui,/d\.contextStatus==="needs_source"/);
 assert.match(ui,/AI input: official RSS headline and excerpt/);
 assert.match(ui,/AI input: headline only/);
 assert.match(ui,/typeof body\.insight!=="string"/);
});
test("The AI prompt demands standalone subject-first posts and explicit sufficiency status",()=>{
 assert.match(server,/BOTH variants must make sense to someone/);
 assert.match(server,/NEVER start either variant with/);
 assert.match(server,/contextStatus/);
 assert.match(server,/prepareDraftResult\(parsed,evidence\)/);
 assert.match(server,/temperature:0\.15/);
});

test("Live drafting endpoint applies the no-vague-context safety check after a model response",async()=>{
 const fetchOriginal=globalThis.fetch;
 const savedKey=process.env.MANAGER_ACCESS_KEY, savedOpenAI=process.env.OPENAI_API_KEY;
 const manager="test-only-manager-key-over-24-chars";
 let sent;
 try{
  process.env.MANAGER_ACCESS_KEY=manager;
  process.env.OPENAI_API_KEY="fake-test-api-key-do-not-use";
  globalThis.fetch=async (url,options)=>{
   assert.equal(url,"https://api.openai.com/v1/responses");
   sent=JSON.parse(options.body);
   const content=JSON.stringify(raw);
   return new Response(JSON.stringify({output:[{content:[{type:"output_text",text:content}]}]}),{status:200,headers:{"Content-Type":"application/json"}});
  };
  const result=await draftHandler(new Request("https://app.example/.netlify/functions/draft",{
   method:"POST",headers:{"x-manager-key":manager,"content-type":"application/json"},
   body:JSON.stringify({title:evidence.title,snippet:"",publisher:"RBI",sourceUrl:"https://www.rbi.org.in/Scripts/pressreleases.aspx"})
  }));
  assert.equal(result.status,200);
  const generated=await result.json();
  assert.match(generated.news,/^RBI:/);
  assert.equal(generated.insight,"");
  assert.equal(generated.contextStatus,"needs_source");
  assert.ok(generated.contextNote.length>20);
  assert.ok(generated.risks.some(x=>/original/i.test(x)));
  assert.match(sent.instructions,/NEVER start either variant with/);
  assert.equal(sent.text.format.schema.required.includes("contextStatus"),true);
 }finally{
  globalThis.fetch=fetchOriginal;
  if(savedKey===undefined)delete process.env.MANAGER_ACCESS_KEY;else process.env.MANAGER_ACCESS_KEY=savedKey;
  if(savedOpenAI===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=savedOpenAI;
 }
});
