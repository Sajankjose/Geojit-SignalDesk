// Defensive quality checks applied AFTER the model returns a draft.
// They do not fact-check, but enforce Geojit's independent, evidence-led tone.
const vagueStart=/^(?:this|these|it|the move|the development|the announcement|the initiative|such a move|such an initiative|the decision)\b/i;
const unsupportedEffects=/\b(?:boost(?:ing|s)? investor confidence|improv(?:e|es|ing) the (?:security and )?efficiency of (?:india'?s )?financial system|boost(?:ing|s)? operational resilience|will benefit investors|will drive market growth|will lift markets|will boost stock prices|is set to transform|can aid investors?|(?:reflects?|indicates?|suggests?) (?:changes? in |a shift in )?investor sentiment|understanding these trends can)\b/i;
const unverifiedInHouse=/\b(?:geojit(?:'s)?\s+(?:view|research|analysts?|experts?|outlook|observations?|recommends?|believes?|expects?|predicts?)|(?:we|our analysts)\s+(?:believe|forecast|expect|recommend|predict))\b/i;
const nonEditorialPublishers=new Set(["marketsmojo","reuters","bloomberg","business standard","livemint","mint","moneycontrol","cnbc","economic times","financial express","yahoo finance","newsapi"]);
const normalize=s=>String(s||"").replace(/\s+/g," ").trim().replace(/^["“]+|["”]+$/g,"").trim();
const short=s=>normalize(s).slice(0,220);
const escapedName=s=>s.split(/\s+/).map(part=>part.replace(/[^a-z0-9]/gi,"\\$&")).join("\\s+");
function newsPublisher(evidence){
 const name=normalize(evidence?.publisher).toLowerCase();
 return name&&nonEditorialPublishers.has(name)?name:"";
}
// News publishers are citation metadata, not the claimed author of a Geojit
// insight. They stay visible in the source reference panel, never in prose.
export function providerFraming(text,evidence){
 const body=normalize(text),p=newsPublisher(evidence);
 return !!(p&&body&&new RegExp("\\b"+escapedName(p)+"\\b","i").test(body));
}
export const vagueOpening=text=>vagueStart.test(normalize(text));
export const sweepingImpact=text=>unsupportedEffects.test(normalize(text));
export const unverifiedGeojitOpinion=text=>unverifiedInHouse.test(normalize(text));

// Prefer a complete first sentence to a cut-off tweet. Arbitrary .slice()
// limits previously produced drafts ending mid-word, e.g. 'aid inves'.
export function completePost(text,max=165){
 const src=normalize(text);
 if(!src)return "";
 if(src.length<=max&&/[.!?]$/.test(src))return src;
 const ends=[...src.matchAll(/[.!?](?=\s|$)/g)].map(m=>m.index+1).filter(n=>n<=max);
 if(ends.length)return src.slice(0,ends[ends.length-1]).trim();
 return "";
}
function safeHeadline(text){
 const result=normalize(text).replace(/[.!?]$/,"").trim();
 return result.length&&result.length<=164?result+".":"";
}
function neutralTitle(evidence){
 let title=normalize(evidence?.title);
 const p=newsPublisher(evidence);
 if(!title)return "";
 if(p){
  const escaped=escapedName(p);
  const patterns=[
   new RegExp("^according to\\s+"+escaped+"[,\\s:]+","i"),
   new RegExp("^"+escaped+"(?:['’]s)?\\s+(?:report|analysis|observation|coverage|assessment|view)\\s+(?:of|on|about|that)\\s+","i"),
   new RegExp("^"+escaped+"\\s+(?:reports?|notes?|highlights?|observes?|says?|finds?)\\s+(?:that\\s+)?","i")
  ];
  for(const pattern of patterns)title=title.replace(pattern,"");
  if(providerFraming(title,evidence))return "";
 }
 if(vagueOpening(title)||sweepingImpact(title)||unverifiedGeojitOpinion(title))return "";
 title=title.charAt(0).toUpperCase()+title.slice(1);
 return safeHeadline(title);
}
function factualFallback(evidence){
 const neutral=neutralTitle(evidence);
 if(!neutral)return "";
 // RBI/SEBI are actual regulators and news actors, unlike news publishers.
 const publisher=normalize(evidence?.publisher);
 if(!newsPublisher(evidence)&&publisher&&!/^(?:user-provided|unknown)/i.test(publisher)){
  const prefix=publisher+": ";
  if(neutral.toLowerCase().startsWith(publisher.toLowerCase()+" "))return neutral;
  const text=prefix+neutral;
  return text.length<=165?text:neutral;
 }
 return neutral;
}
export function prepareDraftResult(raw,evidence){
 if(!raw||typeof raw.news!=="string"||typeof raw.insight!=="string")throw Error("Incomplete AI response");
 const risks=Array.isArray(raw.risks)?raw.risks.filter(x=>typeof x==="string").slice(0,7).map(short):[];
 const needsReplacement=s=>vagueOpening(s)||sweepingImpact(s)||unverifiedGeojitOpinion(s)||providerFraming(s,evidence);
 let news=completePost(raw.news),insight=completePost(raw.insight);
 let contextStatus=raw.contextStatus==="supported"?"supported":"needs_source";
 let contextNote=normalize(raw.contextNote).slice(0,300);
 if(!news||needsReplacement(news)){
  news=factualFallback(evidence);
  risks.unshift("AI news text was incomplete, publisher-framed or not in Geojit's factual voice. A headline-based fallback was used; verify it.");
 }
 if(!news)throw Error("No complete, publisher-neutral factual sentence could be prepared. Supply a shorter verified headline.");
 if(!insight||needsReplacement(insight)){
  insight="";
  contextStatus="needs_source";
  contextNote="The supplied evidence does not support a complete, neutral explanation. Check the original and add specific verified context.";
  risks.unshift("Why It Matters was withheld because it lacked a complete factual sentence or independent editorial voice.");
 }
 if(contextStatus==="needs_source"){
  insight="";
  contextNote=contextNote||"The supplied headline or excerpt does not establish a distinct explanation. Check the source and add verified detail.";
 }
 if(!normalize(evidence?.excerpt))risks.unshift("Only the headline was supplied; check the original before publishing.");
 if(evidence?.userPasted)risks.unshift("User-supplied text has not been independently verified.");
 risks.unshift("Verify the original document, names, figures and context before using either draft.");
 const tags=Array.isArray(raw.hashtags)?[...new Set(raw.hashtags.filter(x=>typeof x==="string"&&/^#[A-Za-z][A-Za-z0-9_]{1,29}$/.test(x)))].slice(0,2):[];
 return {news,insight,hashtags:tags,risks:[...new Set(risks)].slice(0,9),contextStatus,contextNote};
}
