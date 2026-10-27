// Defensive quality checks applied AFTER the model returns a draft.
// These checks cannot verify facts: they prevent a few common vague or
// ungrounded editorial patterns and force the manager to check the source.
const vagueStart=/^(?:this|these|it|the move|the development|the announcement|the initiative|such a move|such an initiative|the decision)\b/i;
const unsupportedEffects=/\b(?:boost(?:ing|s)? investor confidence|improv(?:e|es|ing) the (?:security and )?efficiency of (?:india'?s )?financial system|boost(?:ing|s)? operational resilience|will benefit investors|will drive market growth|will lift markets|will boost stock prices|is set to transform)\b/i;
export const vagueOpening=(text)=>vagueStart.test(String(text||"").trim());
export const sweepingImpact=(text)=>unsupportedEffects.test(String(text||""));
const safeLength=(s,n)=>String(s||"").trim().slice(0,n);
function factualFallback(evidence){
 const title=safeLength(evidence.title,155);
 if(!title)return"";
 // The source TITLE is the actual evidence. Don't claim it is an announcement by
 // an organisation if the relationship is uncertain.
 const publisher=safeLength(evidence.publisher,50);
 const prefix=publisher&&!/^(?:user-provided|unknown)/i.test(publisher)?publisher+": ":"";
 return safeLength(prefix+title,165);
}
export function prepareDraftResult(raw,evidence){
 if(!raw||typeof raw.news!=="string"||typeof raw.insight!=="string")throw Error("Incomplete AI response");
 const risks=Array.isArray(raw.risks)?raw.risks.filter(x=>typeof x==="string").slice(0,7).map(x=>safeLength(x,220)):[];
 let news=safeLength(raw.news,250),insight=safeLength(raw.insight,250);
 let contextStatus=raw.contextStatus==="supported"?"supported":"needs_source";
 let contextNote=safeLength(raw.contextNote,300);
 if(vagueOpening(news)||sweepingImpact(news)){
  news=factualFallback(evidence);
  risks.unshift("The original AI news opening was vague or overstated; a headline-grounded fallback was used. Verify and edit it.");
 }
 if(!news)news=factualFallback(evidence);
 if(vagueOpening(insight)||sweepingImpact(insight)){
  insight="";
  contextStatus="needs_source";
  contextNote="The proposed explanation was too vague or speculative. Check the original source and add verified context before drafting this version.";
  risks.unshift("The AI explanation was withheld because it lacked a clear supported subject or made a sweeping claim.");
 }
 if(contextStatus==="needs_source"){
  insight="";
  contextNote=contextNote||"The supplied headline or excerpt does not support a meaningful explanation. Open the original source and add verified detail.";
 }
 // Model-level grounding is fallible. These notes are useful checks, not an
 // assertion that the model has actually verified the facts.
 if(!String(evidence.excerpt||"").trim()){
  risks.unshift("Only the headline was supplied; check the original before publishing.");
 }
 if(evidence.userPasted)risks.unshift("User-supplied text has not been independently verified.");
 risks.unshift("Verify the original document, names, figures and context before using either draft.");
 const tags=Array.isArray(raw.hashtags)?[...new Set(raw.hashtags.filter(x=>typeof x==="string"&&/^#[A-Za-z][A-Za-z0-9_]{1,29}$/.test(x)))].slice(0,2):[];
 return {news,insight,hashtags:tags,risks:[...new Set(risks)].slice(0,9),contextStatus,contextNote};
}
