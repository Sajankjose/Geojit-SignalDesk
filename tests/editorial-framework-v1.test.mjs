import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const registry=JSON.parse(read("config/editorial-categories.v1.json"));
const framework=read("docs/SIGNALDESK_EDITORIAL_FRAMEWORK_V1.md");
const currentRules=read("EDITORIAL_AI_RULES.md");
const liveDraft=read("netlify/functions/draft.mjs");
const liveUi=read("index.html");

test("Six stable, distinct editorial categories with complete purpose and evidence rules",()=>{
 assert.equal(registry.version,"1.0.0");
 assert.equal(registry.status,"proposed_not_live");
 assert.equal(registry.liveImplementation,false);
 assert.equal(registry.doNotChangeStudioUI,true);
 assert.equal(registry.categories.length,6);
 assert.deepEqual(registry.categories.map(c=>c.code),["C1","C2","C3","C4","C5","C6"]);
 assert.deepEqual(registry.categories.map(c=>c.name),[
  "Market & Regulatory Updates","Market Intelligence & Context","Company & Earnings",
  "Financial Education","Money & Wealth Habits","Explainers & Deep Dives"
 ]);
 assert.equal(new Set(registry.categories.map(c=>c.id)).size,6);
 for(const c of registry.categories){
  assert.ok(c.readerPromise.length>20,c.id+" promise");
  assert.ok(c.readerQuestion.length>15,c.id+" reader question");
  assert.ok(c.requiredEvidence.length>=3,c.id+" evidence");
  assert.ok(c.writingSteps.length>=3,c.id+" prompt structure");
  assert.ok(c.forbiddenClaims.length>=3,c.id+" prohibited");
  assert.ok(c.withholdWhen.length>=2,c.id+" withhold rules");
  assert.ok(c.allowedModes.length>=2,c.id+" output modes");
  assert.ok(framework.includes("### "+c.code+" — "+c.name),c.id+" documented");
 }
});
test("Editorial categories are not confused with six output formats",()=>{
 assert.equal(registry.modes.length,6);
 assert.equal(new Set(registry.modes.map(x=>x.id)).size,6);
 const modes=new Set(registry.modes.map(x=>x.id));
 for(const c of registry.categories)for(const m of c.allowedModes){
  assert.ok(modes.has(m),c.code+" unknown mode "+m);
 }
 assert.match(framework,/Category versus output format/);
 assert.match(framework,/Not six compulsory variations per story/);
});
test("Evidence and rights gates prevent generic advice, source laundering and fabricated reasons",()=>{
 for(const expression of [/not provider voice/i,/No invented Geojit Research/i,/More evidence needed/i,/rights/i,/publication dates/i,/Complete, accountable outputs/i,/Human approval/i]){
  assert.match(framework,expression);
 }
 for(const phrase of ["source publisher's narration","human fact-checking","noAutomaticPosting","needs_source"]){
  assert.ok(JSON.stringify(registry).toLowerCase().includes(phrase.toLowerCase()),phrase);
 }
 assert.equal(registry.outputPolicy.noAutomaticPosting,true);
 assert.equal(registry.outputPolicy.whenEvidenceInsufficient,"needs_source");
});
test("Prospective rules are documentation, not a silent change to the active AI contract",()=>{
 assert.match(currentRules,/Framework update \(proposal only\)/);
 assert.match(currentRules,/not yet wired to the live AI endpoint or Studio/);
 assert.match(liveDraft,/news:\{type:"string"\},insight:\{type:"string"\}/);
 assert.doesNotMatch(liveDraft,/editorial-categories\.v1\.json/);
 assert.doesNotMatch(liveUi,/editorial-categories\.v1\.json/);
 assert.match(framework,/present endpoint only returns/);
});
