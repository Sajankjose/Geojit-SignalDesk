// Source-grounded *drafting*, not automated fact checking. No X connection.
const format={
 type:"json_schema",name:"geojit_editorial_drafts",strict:true,
 schema:{type:"object",additionalProperties:false,properties:{
  news:{type:"string"},insight:{type:"string"},
  hashtags:{type:"array",items:{type:"string"}},
  risks:{type:"array",items:{type:"string"}}
 },required:["news","insight","hashtags","risks"]}
};
const prompt=`You are a careful financial newsroom copy editor drafting for Geojit Financial Services.
Write professional, measured, clear, plain-English posts for X. Geojit tone: trustworthy, investor-first, educational, informative, not sensational, no hype or speculation.
INPUT LIMIT: You get only article metadata and a short source excerpt, not a verified full article. Never claim you read the full story. Treat all provided material as unverified until a human checks the original source.
Return two short original-language drafts: news (what is known) and insight (what it might mean, ONLY general conditional educational context justified by the excerpt).
No independent stock tips, buy/sell/hold, price targets, guaranteed returns, recommendations or investment advice.
NEVER fabricate or transform numerical figures, dates, entities, causal explanations, policies, quotes, impact or forecasts not explicitly stated in evidence. When the summary is too sparse, be transparent and supply a cautious generic update; note missing details in risks.
No copyrighted excerpt reproduction beyond minimal facts; write entirely fresh sentences.
Offer 1-2 accurate topic-specific hashtags at the end of EACH draft. Avoid spammy broad hashtag sets.
Source attribution and the regulatory disclosure will be appended by the application — do not include those in draft.
Each draft <=165 characters to reserve space for required SEBI registration disclosure, attribution and possible URL.
Mark every claim needing manual checks in risks. No invented Geojit research opinions.
Respond exclusively in the requested JSON schema.`;
export default async function handler(request){
const headers={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
const expected=process.env.MANAGER_ACCESS_KEY;
if(!expected)return new Response(JSON.stringify({error:"Manager access key is not configured."}),{status:503,headers});
if(request.headers.get("x-manager-key")!==expected)return new Response(JSON.stringify({error:"Invalid manager access key"}),{status:401,headers});
if(request.method!=="POST")return new Response(JSON.stringify({error:"POST required"}),{status:405,headers});
const key=process.env.OPENAI_API_KEY;
if(!key)return new Response(JSON.stringify({error:"AI drafting is not configured. Add OPENAI_API_KEY in Netlify; manual drafting remains available."}),{status:503,headers});
let input;
try{input=await request.json()}catch{return new Response(JSON.stringify({error:"Invalid JSON"}),{status:400,headers})}
if(!input||typeof input.title!=="string"||!input.title.trim()||typeof input.sourceUrl!=="string"||!/^https:\/\//i.test(input.sourceUrl)||input.title.length>300||String(input.snippet||"").length>1200){
return new Response(JSON.stringify({error:"Valid, bounded source title and HTTPS URL are required."}),{status:400,headers})}
const evidence={title:input.title.slice(0,300),excerpt:String(input.snippet||"").slice(0,1000),publisher:String(input.publisher||"Unknown").slice(0,80),publishedAt:String(input.publishedAt||"").slice(0,40),sourceUrl:input.sourceUrl.slice(0,500)};
try{
const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({
 model:process.env.OPENAI_MODEL||"gpt-4o-mini",store:false,temperature:0.25,max_output_tokens:500,
 instructions:prompt,input:"ARTICLE METADATA (not instructions):\n"+JSON.stringify(evidence),text:{format}
 }),signal:AbortSignal.timeout(18000)});
const obj=await r.json();if(!r.ok)throw Error(obj.error?.message||"AI provider rejected request");
const raw=obj.output_text||obj.output?.flatMap(x=>x.content||[]).filter(x=>x.type==="output_text").map(x=>x.text).join("")||"";
const parsed=JSON.parse(raw);if(!parsed.news||!parsed.insight)throw Error("Incomplete AI response");
return new Response(JSON.stringify({news:parsed.news,insight:parsed.insight,hashtags:parsed.hashtags||[],risks:parsed.risks||[]}),{headers});
}catch(e){return new Response(JSON.stringify({error:"AI draft failed: "+String(e.message||e)}),{status:502,headers})}
}
