import {authenticate} from "../../../../../../lib/server/auth.js";
import {inContext,requireMembership} from "../../../../../../lib/server/db.js";
import {ApiError,failResponse} from "../../../../../../lib/server/errors.js";
import {validUUID} from "../../../../../../lib/policy.js";
export const runtime="nodejs";
export async function GET(request,{params}){
 try{
  const {subject}=await authenticate(request);
  const {runId}=await params,tenantId=new URL(request.url).searchParams.get("tenant_id");
  if(!validUUID(tenantId)||!validUUID(runId))throw new ApiError(400,"Valid tenant_id and runId required");
  const steps=await inContext(subject,tenantId,async tx=>{
   await requireMembership(tx,subject,tenantId);
   return tx.unsafe("SELECT step_id,node_type,status,output,updated_at FROM run_step_states WHERE tenant_id=$1 AND run_id=$2 ORDER BY updated_at,step_id",[tenantId,runId]);
  });
  return Response.json({steps},{headers:{"Cache-Control":"no-store"}});
 }catch(e){return failResponse(e)}
}
