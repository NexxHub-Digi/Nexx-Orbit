import {authenticate} from "../../../../../../lib/server/auth.js";
import {inContext,requireMembership} from "../../../../../../lib/server/db.js";
import {ApiError,failResponse,requestBody} from "../../../../../../lib/server/errors.js";
import {authOrigin} from "../../../../../../lib/server/session.js";
import {newInvitationToken,normalizedEmail,validRole,joinUrl} from "../../../../../../lib/invitations.js";
import {validUUID} from "../../../../../../lib/policy.js";
export const runtime="nodejs";
async function checkAdmin(tx,subject,id){
 const role=await requireMembership(tx,subject,id);
 if(!["owner","admin"].includes(role))throw new ApiError(403,"Administrator role required");
}
export async function GET(request,{params}){
 try{
  const {subject}=await authenticate(request),{tenantId}=await params;
  if(!validUUID(tenantId))throw new ApiError(400,"Invalid tenant");
  const invitations=await inContext(subject,tenantId,async tx=>{
   await checkAdmin(tx,subject,tenantId);
   return tx.unsafe("SELECT * FROM public.orbit_list_invites($1)",[tenantId]);
  });
  return Response.json({invitations},{headers:{"Cache-Control":"no-store"}});
 }catch(e){return failResponse(e)}
}
export async function POST(request,{params}){
 try{
  const {subject}=await authenticate(request),{tenantId}=await params;
  if(!validUUID(tenantId))throw new ApiError(400,"Invalid tenant");
  const origin=authOrigin(); // Verify configuration before issuing an irreversible single-use token.
  const body=await requestBody(request);
  const email=normalizedEmail(body?.email),role=body?.role;
  if(!email||!validRole(role))throw new ApiError(400,"Valid email and non-owner role required");
  const {token,hash}=newInvitationToken();
  const invitation=await inContext(subject,tenantId,async tx=>{
   await checkAdmin(tx,subject,tenantId);
   const result=await tx.unsafe("SELECT * FROM public.orbit_issue_invite($1,$2,$3,$4)",[tenantId,email,role,hash]);
   return result[0];
  });
  return Response.json({invitation,join_url:joinUrl(origin,token)},
   {status:201,headers:{"Cache-Control":"no-store","Referrer-Policy":"no-referrer"}});
 }catch(e){
  if(e.code==="23505")return failResponse(new ApiError(409,"An active invitation already exists for this email"));
  if(e.code==="42501")return failResponse(new ApiError(403,"Administrator role required"));
  if(e.code==="P0001")return failResponse(new ApiError(409,"Invitation limit reached"));
  return failResponse(e);
 }
}
