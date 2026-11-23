import {authenticate} from "../../../../../lib/server/auth.js";
import {inContext} from "../../../../../lib/server/db.js";
import {ApiError,failResponse,requestBody} from "../../../../../lib/server/errors.js";
import {digestToken,validToken} from "../../../../../lib/invitations.js";
export const runtime="nodejs";
export async function POST(request){
 try{
  const user=await authenticate(request);
  if(user.provider!=="google"||!user.email)throw new ApiError(403,"Verified Google login required");
  const body=await requestBody(request);
  if(!validToken(body?.token))throw new ApiError(400,"Invalid invitation token");
  const rows=await inContext(user.subject,null,tx=>tx.unsafe("SELECT * FROM public.orbit_accept_invite($1,$2)",[digestToken(body.token),user.email]));
  return Response.json({membership:rows[0]},{status:201,headers:{"Cache-Control":"no-store","Referrer-Policy":"no-referrer"}});
 }catch(e){
  if(e.code==="P0001")return failResponse(new ApiError(409,"Invitation expired, already used, or belongs to another Google account"));
  if(e.code==="28000")return failResponse(new ApiError(403,"Verified Google account required"));
  return failResponse(e);
 }
}
