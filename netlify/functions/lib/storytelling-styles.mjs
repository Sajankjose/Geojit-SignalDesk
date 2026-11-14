// Shared editorial storytelling controls. User selection affects voice and structure,
// never evidence standards or rights restrictions.
export const STORY_STYLES=Object.freeze({
 auto:{name:"AI Recommended",guide:"Choose the most useful style supported by the evidence. Prefer straight news when the source is thin. Do not create suspense without a supported payoff."},
 curiosity:{name:"Curiosity & Intrigue",guide:"Open with a concrete, verified contrast, tension or specific question that the source can actually answer. Resolve the hook with facts, not speculation. Never pose an ungrounded stock-return or investor-confidence question."},
 insight:{name:"Investor Insight",guide:"Identify one specific investor-interest angle: a disclosed business metric, cost, scope, rule, risk factor or operational fact. Explain precisely what to examine without giving a buy/sell/hold view or implying market performance."},
 learn:{name:"Learn Something Useful",guide:"Explain a real financial mechanism, definition or rule using only source-provided details and common stable definitions. Make the reader smarter, not overwhelmed. Do not invent worked numbers or outcomes."},
 bigger:{name:"The Bigger Picture",guide:"Connect the concrete event to broader economic, regulatory or sector context ONLY when the supplied evidence explicitly establishes that context. Otherwise stay close to the event."},
 balance:{name:"Two Sides of the Story",guide:"Present a genuine evidenced contrast or trade-off (e.g., announced order value versus stated execution status) without false balance, fabricated counterarguments or investment recommendations."},
 straight:{name:"Straight News",guide:"Write an accessible, specific, compelling factual update. Lead with what changed and who is affected; no forced hook, generic opinion or exaggerated importance."}
});
export function selectStoryStyle(raw){
 return typeof raw==="string"&&Object.prototype.hasOwnProperty.call(STORY_STYLES,raw)?raw:"auto";
}
export function storytellingInstructions(raw){
 const key=selectStoryStyle(raw),chosen=STORY_STYLES[key];
 return "\n\nEDITORIAL STORYTELLING STYLE — USER SELECTION (not source text): "+chosen.name+
  "\n"+chosen.guide+
  "\nThe editorial style must never override factual precision, source limitations, licensing restrictions, neutrality or human review. Hooks must be repaid with evidence. In a thread, use a connected arc without repetition. If this style is unsupported by the evidence, use a clear fact-first narrative and flag the missing context instead.";
}
