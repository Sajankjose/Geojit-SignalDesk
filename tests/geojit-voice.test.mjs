import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {prepareDraftResult,providerFraming,completePost,unverifiedGeojitOpinion,sweepingImpact} from "../netlify/functions/lib/draft-quality.mjs";
import draftHandler from "../netlify/functions/draft.mjs";
const ui=readFileSync(new URL("../official-poc.js",import.meta.url),"utf8");
const prompt=readFileSync(new URL("../netlify/functions/draft.mjs",import.meta.url),"utf8");
const evidence={title:"Large-cap stocks show mixed performance across defensive and cyclical sectors",publisher:"MarketsMojo",excerpt:"Defensive and cyclical segments moved differently.",userPasted:true};

test("Geojit posts never claim that MarketsMojo authored the market perspective",()=>{
 assert.equal(providerFraming("MarketsMojo's observation of divergent stocks suggests a shift in sentiment.",evidence),true);
 assert.equal(providerFraming("According to MarketsMojo, large caps are mixed.",evidence),true);
 assert.equal(providerFraming("Large-cap stocks show mixed performance.",evidence),false);
 const result=prepareDraftResult({
  news:"MarketsMojo's observation of mixed trends in the large-cap segment highlights the ongoing divergence between defensive and cyclical stocks, which can indicate varying investor sentiment and sector performance. Understanding these trends can aid inves",
  insight:"MarketsMojo highlighted this as a change in investor sentiment.",
  hashtags:["#StockMarket"],risks:[],contextStatus:"supported",contextNote:"MarketsMojo believes investors should watch."
 },evidence);
 assert.equal(result.news,"Large-cap stocks show mixed performance across defensive and cyclical sectors.");
 assert.doesNotMatch(result.news,/marketsmojo/i);
 assert.ok(result.news.length<=165);
 assert.equal(result.insight,"");
 assert.equal(result.contextStatus,"needs_source");
 assert.ok(result.risks.some(x=>/editorial voice|publisher-framed|factual voice/i.test(x)));
});
test("Publisher-prefixed source title is neutralized rather than pretending Geojit made the observation",()=>{
 const result=prepareDraftResult({
  news:"MarketsMojo reports that banking and technology stocks moved differently in today's session.",
  insight:"",
  hashtags:[],risks:[],contextStatus:"needs_source",contextNote:""
 },{publisher:"MarketsMojo",title:"MarketsMojo's observation of mixed trends across large-cap defensive and cyclical stocks",excerpt:"",userPasted:true});
 assert.equal(result.news,"Mixed trends across large-cap defensive and cyclical stocks.");
 assert.doesNotMatch(result.news,/marketsmojo/i);
});
test("No output ends with a truncated word or clipped clause",()=>{
 assert.equal(completePost("Large-cap stocks showed mixed sector performance. This may aid inves",165),
  "Large-cap stocks showed mixed sector performance.");
 assert.equal(completePost("The banking sector showed mixed results without details and may aid inves",165),"");
 const result=prepareDraftResult({
  news:"Large-cap stocks showed mixed sector performance. Understanding the mix may help inves",
  insight:"A change in sector movements can aid inves",
  hashtags:[],risks:[],contextStatus:"supported",contextNote:""
 },evidence);
 assert.equal(result.news,"Large-cap stocks showed mixed sector performance.");
 assert.equal(result.insight,"");
 assert.equal(result.contextStatus,"needs_source");
 assert.ok(/[.!?]$/.test(result.news));
 assert.equal(/inves$/i.test(result.news),false);
});
test("Unverified Geojit Research authorship and speculative effects are rejected",()=>{
 assert.equal(unverifiedGeojitOpinion("Geojit Research expects investors to gain."),true);
 assert.equal(unverifiedGeojitOpinion("Our analysts believe stocks will rise."),true);
 assert.equal(sweepingImpact("This indicates a shift in investor sentiment."),true);
 assert.equal(sweepingImpact("The divergence can indicate varying investor sentiment."),true);
 const result=prepareDraftResult({
  news:"Geojit Research expects large-cap stocks to outperform.",
  insight:"Our analysts believe investors should shift to defensive companies.",
  hashtags:[],risks:[],contextStatus:"supported",contextNote:""
 },evidence);
 assert.equal(result.news,"Large-cap stocks show mixed performance across defensive and cyclical sectors.");
 assert.equal(result.insight,"");
 assert.equal(result.contextStatus,"needs_source");
});
test("Official RBI news remains named as actor and provider reference does not remove regulators",()=>{
 const result=prepareDraftResult({
  news:"RBI announced an updated banking policy framework.",
  insight:"",
  hashtags:["#RBI"],risks:[],contextStatus:"needs_source",contextNote:"Source must be checked."
 },{title:"RBI announced an updated banking policy framework",publisher:"RBI",excerpt:""});
 assert.equal(result.news,"RBI announced an updated banking policy framework.");
});
test("Prompt requires actual Geojit brand voice and complete sentences",()=>{
 for(const phrase of ["GEOJIT BRAND VOICE","Never", "MarketsMojo's observation","Geojit Research believes",
  "publisher","COMPLETENESS"]){
  assert.ok(prompt.toLowerCase().includes(phrase.toLowerCase()),phrase);
 }
 assert.match(prompt,/source-grounded|evidence-led/);
});
test("MarketsMojo POC tweet preview omits provider credit from the body while keeping source verification in Studio",()=>{
 assert.match(ui,/const from=d\.source\.curatedPOC\?"":/);
 assert.match(ui,/studioSourceMeta/);
 assert.match(ui,/studioSourceLink/);
 assert.match(ui,/editorialVoiceV2/);
 assert.match(ui,/earlier draft used the news provider's voice/);
 assert.match(ui,/if\(d\.source\.demoOnly\)/);
});
test("AI endpoint sanitizes publisher framing after a model response before sending it to browser",async()=>{
 const oldFetch=globalThis.fetch;
 const savedManager=process.env.MANAGER_ACCESS_KEY,savedAPI=process.env.OPENAI_API_KEY;
 const manager="unit-test-manager-only";
 try{
  process.env.MANAGER_ACCESS_KEY=manager;process.env.OPENAI_API_KEY="mock-only";
  globalThis.fetch=async url=>{assert.equal(url,"https://api.openai.com/v1/responses");return new Response(JSON.stringify({
   output:[{content:[{type:"output_text",text:JSON.stringify({
    news:"MarketsMojo's observation of mixed trends highlights varying investor sentiment.",
    insight:"MarketsMojo suggests stocks will recover.",
    hashtags:["#StockMarket"],risks:[],contextStatus:"supported",contextNote:""
   })}]}]
  }),{status:200})};
  const response=await draftHandler(new Request("https://test.local/.netlify/functions/draft",{
   method:"POST",headers:{"x-manager-key":manager,"content-type":"application/json"},
   body:JSON.stringify({title:evidence.title,snippet:evidence.excerpt,publisher:"MarketsMojo",sourceUrl:"https://www.marketsmojo.com/news/markets-today",userPasted:true})
  }));
  assert.equal(response.status,200);
  const output=await response.json();
  assert.doesNotMatch(output.news,/marketsmojo/i);
  assert.equal(output.insight,"");
  assert.ok(output.news.endsWith("."));
 }finally{
  globalThis.fetch=oldFetch;
  if(savedManager===undefined)delete process.env.MANAGER_ACCESS_KEY;else process.env.MANAGER_ACCESS_KEY=savedManager;
  if(savedAPI===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=savedAPI;
 }
});
