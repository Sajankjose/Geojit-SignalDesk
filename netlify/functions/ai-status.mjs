// AI readiness check: does not return credentials or make a paid AI request.
// The browser holds only a manager key for this tab; OpenAI key stays in Netlify.
import {timingSafeEqual} from "node:crypto";
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
export default async function handler(request){
 if(request.method!=="GET")return json({error:"GET required"},405);
 const configured=process.env.MANAGER_ACCESS_KEY;
 if(!configured)return json({error:"Set MANAGER_ACCESS_KEY in Netlify environment variables to enable AI drafting."},503);
 const provided=request.headers.get("x-manager-key")||"";
 const a=Buffer.from(configured),b=Buffer.from(provided);
 if(!provided||a.length!==b.length||!timingSafeEqual(a,b))return json({error:"Incorrect manager key. Check MANAGER_ACCESS_KEY in Netlify."},401);
 if(!process.env.OPENAI_API_KEY)return json({ready:false,error:"Set OPENAI_API_KEY in Netlify environment variables, then redeploy."});
 return json({ready:true,provider:"OpenAI",variants:["news","insight"]});
}
