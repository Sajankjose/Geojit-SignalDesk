import { timingSafeEqual } from "node:crypto";
export function allowed(request) {
  const expected=process.env.MANAGER_ACCESS_KEY;
  const supplied=request.headers.get("x-manager-key");
  if(!expected||expected.length<24||!supplied)return false;
  const x=Buffer.from(expected),y=Buffer.from(supplied);
  return x.length===y.length&&timingSafeEqual(x,y);
}
export const istDay=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
export function response(body,status=200){return new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}})}
export function originOK(request){
  const origin=request.headers.get("origin");
  if(!origin)return true;
  try { return new URL(origin).origin===new URL(request.url).origin; } catch { return false; }
}
