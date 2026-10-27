// Explainable editorial heuristic — NOT impact analysis, advice, fact-checking or personalisation.
// Source reliability is treated separately: this endpoint accepts only official regulator URLs.
const rules=[
  {regex:/monetary policy committee|monetary policy statement|policy repo rate|change in repo rate|mpc resolution|interest rate decision|policy rate decision/i,category:"Monetary policy",impact:33,reason:"Policy-rate decisions can be relevant to borrowing costs and financial markets."},
  {regex:/inflation|consumer price index|financial stability report|GDP|gross domestic product/i,category:"Economy",impact:27,reason:"Macro indicators can be relevant to the economy and investment environment."},
  {regex:/mutual funds?|asset management companies|investor protection|investor grievance|investor rights/i,category:"Investor & funds",impact:29,reason:"Changes involving funds or investor protections may affect retail investors."},
  {regex:/cyber security|cybersecurity|fraud|scam|market manipulation|mis-selling|unregistered investment advis/i,category:"Investor protection",impact:25,reason:"Investor-safety developments may warrant an awareness update."},
  {regex:/margin requirements?|derivatives?|futures and options|F&O|capital market|market infrastructure|stock brokers?|securities markets?|exchange traded/i,category:"Markets",impact:27,reason:"Market structure and trading rules may matter to market participants."},
  {regex:/master direction|regulatory framework|regulations?|circular|compliance requirement|disclosure requirement|guideline/i,category:"Regulation",impact:19,reason:"A regulatory change may require closer review before investor communication."},
  {regex:/liquidity|standing deposit|bank rate|monetary|repo/i,category:"Banking",impact:14,reason:"Banking-system developments may provide useful market context."},
  {regex:/banking|non-banking financial|nbfc|deposit|credit growth|forex|foreign exchange|rupee/i,category:"Banking",impact:13,reason:"The update may provide context on banking or financial conditions."}
];
const routine=/variable rate repo|variable rate reverse repo|vrr auction|liquidity adjustment facility|daily liquidity|press note|auction result|list of|appointment|tender|invitation for|vacanc|office order|release order|attachment order|recovery proceedings|adjudication order|settlement order|order in the matter/i;
const awareness=/unregistered investment adviser|investor alert|warning to investors|public caution|investor protection|cyber fraud/i;
export function rankOfficialStory(story,now=Date.now()){
 const title=String(story.title||""),summary=String(story.snippet||"");
 const haystack=(title+" "+summary).slice(0,1100);
 const match=rules.find(r=>r.regex.test(haystack));
 const days=(now-Date.parse(story.publishedAt))/86400000;
 const freshness=Number.isFinite(days)&&days>=-0.5?(days<=1?14:days<=3?9:days<=7?5:days<=14?2:0):0;
 const adjustment=routine.test(title)?-18:0;
 const alertBonus=awareness.test(title)?9:0;
 // A provisional editorial signal, not a predictive certainty.
 const score=Math.max(10,Math.min(95,42+(match?.impact||2)+freshness+adjustment+alertBonus));
 const reason=match?.reason||"General regulator information; check whether it matters to the intended audience.";
 const why=adjustment<0?"Procedural or routine release. Review before treating it as major market news.":reason;
 return {priority:score,impact:score>=77?"high":score>=60?"medium":"low",reason:why,category:match?.category||story.category||"Official update",rankBasis:"Topic + release recency + routine-announcement adjustment. Editorial estimate only."};
}
export function suggestedHashtags(story){
 const text=(String(story.title||"")+" "+String(story.category||"")).toLowerCase();
 const tags=[];
 if(/monetary policy|mpc|repo rate|interest rate|liquidity/.test(text))tags.push("#MonetaryPolicy");
 else if(/mutual fund|sip|amc/.test(text))tags.push("#MutualFunds");
 else if(/investor protection|fraud|scam|cyber|unregistered investment/.test(text))tags.push("#InvestorAwareness");
 else if(/derivative|futures|options|exchange|capital market/.test(text))tags.push("#CapitalMarkets");
 else if(/inflation|consumer price|gdp|growth/.test(text))tags.push("#IndianEconomy");
 else if(/bank|credit|nbfc/.test(text))tags.push("#Banking");
 if(story.publisher==="RBI")tags.push("#RBI");
 else if(story.publisher==="SEBI")tags.push("#SEBI");
 return [...new Set(tags)].slice(0,2);
}
