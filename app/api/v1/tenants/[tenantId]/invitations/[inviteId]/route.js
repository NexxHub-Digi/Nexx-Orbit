import {authenticate} from "../../../../../../../lib/server/auth.js";
import {inContext,requireMembership} from "../../../../../../../lib/server/db.js";
import {ApiError,failResponse} from "../../../../../../../lib/server/errors.js";
import {validUUID} from "../../../../../../../lib/policy.js";
export const runtime="nodejs";
export async function DELETE(request,{params}){
 try{
  const {subject}=await authenticate(request),{tenantId,inviteId}=await params;
  if(!validUUID(tenantId)||!validUUID(inviteId))throw new ApiError(400,"Invalid tenant or invitation ID");
  const revoked=await inContext(subject,tenantId,async tx=>{
   const role=await requireMembership(tx,subject,tenantId);
   if(!["owner","admin"].includes(role))throw new ApiError(403,"Administrator role required");
   const result=await tx.unsafe("SELECT public.orbit_revoke_invite($1,$2) AS revoked",[tenantId,inviteId]);
   return result[0]?.revoked;
  });
  if(!revoked)throw new ApiError(404,"Pending invitation not found");
  return Response.json({revoked:true},{headers:{"Cache-Control":"no-store"}});
 }catch(e){return failResponse(e)}
}
