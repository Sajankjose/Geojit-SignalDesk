import {createHmac,randomBytes,timingSafeEqual} from "node:crypto";

// An HttpOnly cookie avoids storing the manager key in localStorage.
// Limited to the Marketaux metadata feed, not a general SSO solution.
export const COOKIE_NAME="__Secure-signaldesk_marketaux_session";
export const SESSION_SECONDS=7*24*60*60;
const scope="signaldesk:marketaux:session:v1";
export function managerKeyMatches(provided){
 const expected=process.env.MANAGER_ACCESS_KEY||"";
 if(!expected||!provided)return false;
 const a=Buffer.from(expected),b=Buffer.from(String(provided));
 return a.length===b.length&&timingSafeEqual(a,b);
}
const sign=data=>createHmac("sha256",process.env.MANAGER_ACCESS_KEY||"").update(scope+"|"+data).digest("hex");
const cookieBase=COOKIE_NAME+"=";
export function makeSessionCookie(now=Date.now()){
 if(!process.env.MANAGER_ACCESS_KEY)throw Error("Manager access not configured");
 const expiry=Math.floor(now/1000)+SESSION_SECONDS;
 const nonce=randomBytes(16).toString("hex");
 const data="v1."+expiry+"."+nonce;
 return cookieBase+data+"."+sign(data)+"; Path=/.netlify/functions/; Max-Age="+SESSION_SECONDS+"; HttpOnly; Secure; SameSite=Strict";
}
export const clearSessionCookie=()=>cookieBase+"; Path=/.netlify/functions/; Max-Age=0; HttpOnly; Secure; SameSite=Strict";
export function sessionValid(request,now=Date.now()){
 if(!process.env.MANAGER_ACCESS_KEY)return false;
 const cookieHeader=request.headers.get("cookie")||"";
 if(cookieHeader.length>8192)return false;
 const encoded=cookieHeader.split(";").map(x=>x.trim()).find(x=>x.startsWith(cookieBase));
 if(!encoded)return false;
 const value=encoded.slice(cookieBase.length);
 const match=/^v1\.(\d{10})\.([a-f0-9]{32})\.([a-f0-9]{64})$/.exec(value);
 if(!match)return false;
 const expiry=Number(match[1]),at=Math.floor(now/1000);
 if(!Number.isSafeInteger(expiry)||expiry<=at||expiry>at+SESSION_SECONDS)return false;
 const data="v1."+match[1]+"."+match[2];
 const expected=Buffer.from(sign(data),"hex"),given=Buffer.from(match[3],"hex");
 return expected.length===given.length&&timingSafeEqual(expected,given);
}
export const marketauxAuthenticated=request=>sessionValid(request)||managerKeyMatches(request.headers.get("x-manager-key")||"");
export function sameOrigin(request){
 const origin=request.headers.get("origin");
 if(!origin)return true;
 try{return new URL(origin).origin===new URL(request.url).origin}catch{return false}
}
