import {authenticate} from "../../../../../../../lib/server/auth.js";
import {inContext,requireMembership} from "../../../../../../../lib/server/db.js";
import {ApiError,failResponse,requestBody} from "../../../../../../../lib/server/errors.js";
import {can,validUUID} from "../../../../../../../lib/policy.js";
export const runtime="nodejs";
export async function POST(request,{params}){
 try{
  const {subject}=await authenticate(request);
  const {runId,stepId}=await params;
  const body=await requestBody(request),tenantId=body?.tenant_id,decision=body?.decision;
  if(!validUUID(tenantId)||!validUUID(runId)||!/^[A-Za-z0-9_-]{1,128}$/.test(stepId||""))throw new ApiError(400,"Valid tenant, run and step required");
  if(!["approved","rejected"].includes(decision))throw new ApiError(400,"Invalid approval decision");
  const result=await inContext(subject,tenantId,async tx=>{
   const role=await requireMembership(tx,subject,tenantId);
   if(!can(role,"members:manage"))throw new ApiError(403,"Only tenant admins can decide approvals");
   const rows=await tx.unsafe("SELECT r.status AS run_status,s.status AS step_status FROM runs r JOIN run_step_states s ON s.run_id=r.id AND s.tenant_id=r.tenant_id WHERE r.tenant_id=$1 AND r.id=$2 AND s.step_id=$3",[tenantId,runId,stepId]);
   if(rows[0]?.run_status!=="waiting_approval"||rows[0]?.step_status!=="pending_approval")throw new ApiError(409,"No pending approval for this run step");
   const fresh=await tx.unsafe("INSERT INTO run_approvals(tenant_id,run_id,step_id,decision,decided_by) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING tenant_id,run_id,step_id,decision,decided_at",[tenantId,runId,stepId,decision,subject]);
   if(fresh.length){
    await tx.unsafe("INSERT INTO run_events(tenant_id,run_id,event_type,step_id,actor) VALUES($1,$2,$3,$4,$5)",[tenantId,runId,decision,stepId,subject]);
    return {approval:fresh[0],replayed:false};
   }
   const prior=await tx.unsafe("SELECT tenant_id,run_id,step_id,decision,decided_at FROM run_approvals WHERE tenant_id=$1 AND run_id=$2 AND step_id=$3",[tenantId,runId,stepId]);
   if(prior[0]?.decision!==decision)throw new ApiError(409,"This approval has already been decided differently");
   return {approval:prior[0],replayed:true};
  });
  return Response.json(result,{status:result.replayed?200:201,headers:{"Cache-Control":"no-store"}});
 }catch(e){return failResponse(e)}
}
