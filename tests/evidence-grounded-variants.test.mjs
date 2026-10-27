import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {vagueOpening,sweepingImpact,prepareDraftResult} from "../netlify/functions/lib/draft-quality.mjs";

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
