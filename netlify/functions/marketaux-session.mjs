// Manager authentication for Indian Markets only. The Marketaux token never
// leaves Netlify Functions and remains blocked by its usage-approval flag.
import {managerKeyMatches,sessionValid,makeSessionCookie,clearSessionCookie,sameOrigin,SESSION_SECONDS} from "./lib/marketaux-auth.mjs";
const reply=(value,status=200,cookie=null)=>{
 const headers={"Content-Type":"application/json; charset=utf-8","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Vary":"Cookie"};
 if(cookie)headers["Set-Cookie"]=cookie;
 return new Response(JSON.stringify(value),{status,headers});
};
// The readiness state is non-secret. It is returned only after manager sign-in
// so the UI can avoid attempting third-party requests when approval is pending.
export function marketauxReadiness(){
 if(process.env.MARKETAUX_USAGE_APPROVED!=="true")return "approval_required";
 if(!process.env.MARKETAUX_API_TOKEN)return "token_missing";
 return "ready";
}
export default async function handler(request){
 if(!["GET","POST","DELETE"].includes(request.method))return reply({error:"Method not allowed"},405);
 if(!sameOrigin(request))return reply({error:"Cross-site request not permitted"},403);
 if(request.method==="GET"){
  const authenticated=sessionValid(request);
  return reply({authenticated,sessionDays:7,marketauxStatus:authenticated?marketauxReadiness():"sign_in_required"});
 }
 if(request.method==="DELETE")return reply({authenticated:false},200,clearSessionCookie());
 if(Number(request.headers.get("content-length")||0)>2000)return reply({error:"Request too large"},413);
 let data;
 try{data=await request.json()}catch{return reply({error:"Invalid sign-in request"},400)}
 if(!managerKeyMatches(typeof data?.key==="string"?data.key:""))
  return reply({error:"Incorrect manager access key. Try again."},401);
 return reply({authenticated:true,sessionDays:SESSION_SECONDS/86400,marketauxStatus:marketauxReadiness()},200,makeSessionCookie());
}
