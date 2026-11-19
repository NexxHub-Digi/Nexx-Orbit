import {authenticate} from "../../../../lib/server/auth.js";
export const runtime="nodejs";
export async function GET(request){
 try{
  const user=await authenticate(request);
  return Response.json({authenticated:true,user},{headers:{"Cache-Control":"no-store"}});
 }catch{
  return Response.json({authenticated:false,user:null},{headers:{"Cache-Control":"no-store"}});
 }
}
