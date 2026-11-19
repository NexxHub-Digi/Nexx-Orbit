import {authenticate} from "../../../../../../lib/server/auth.js";
import {inContext,requireMembership} from "../../../../../../lib/server/db.js";
import {ApiError,failResponse} from "../../../../../../lib/server/errors.js";
import {can,validUUID} from "../../../../../../lib/policy.js";
import {compilePlan} from "../../../../../../lib/orchestrator/plan.js";
export const runtime="nodejs";
export async function POST(request,{params}){
 try{
  const {subject}=await authenticate(request);
  const {workflowId}=await params,tenantId=new URL(request.url).searchParams.get("tenant_id");
  if(!validUUID(tenantId)||!validUUID(workflowId))throw new ApiError(400,"Valid tenant_id and workflowId required");
  const workflow=await inContext(subject,tenantId,async tx=>{
   const role=await requireMembership(tx,subject,tenantId);
   if(!can(role,"workflows:create"))throw new ApiError(403,"Your role cannot publish workflows");
   const rows=await tx.unsafe("SELECT id,status,graph FROM workflows WHERE tenant_id=$1 AND id=$2 FOR UPDATE",[tenantId,workflowId]);
   if(!rows.length)throw new ApiError(404,"Workflow not found");
   if(rows[0].status!=="draft")throw new ApiError(409,"Only draft workflows can be published");
   const plan=compilePlan(rows[0].graph);
   const updated=await tx.unsafe("UPDATE workflows SET status='published',updated_at=now() WHERE tenant_id=$1 AND id=$2 RETURNING id,tenant_id,name,status,version,updated_at",[tenantId,workflowId]);
   return {...updated[0],plan_summary:{step_count:plan.steps.length}};
  });
  return Response.json({workflow},{headers:{"Cache-Control":"no-store"}});
 }catch(e){return failResponse(e)}
}
