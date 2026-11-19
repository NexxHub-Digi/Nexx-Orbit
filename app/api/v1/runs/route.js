import {authenticate} from "../../../../lib/server/auth.js";
import {inContext,requireMembership} from "../../../../lib/server/db.js";
import {ApiError,failResponse,requestBody} from "../../../../lib/server/errors.js";
import {can,validUUID} from "../../../../lib/policy.js";
export const runtime="nodejs";
async function handler(request,write){
 try{
  const {subject}=await authenticate(request);
  const body=write?await requestBody(request):null;
  const tenantId=write?body?.tenant_id:new URL(request.url).searchParams.get("tenant_id");
  if(!validUUID(tenantId))throw new ApiError(400,"Valid tenant_id required");
  const result=await inContext(subject,tenantId,async tx=>{
   const role=await requireMembership(tx,subject,tenantId);
   if(!write)return tx.unsafe("SELECT id,tenant_id,workflow_id,workflow_version,status,created_at,updated_at FROM runs WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 100",[tenantId]);
   if(!can(role,"runs:create"))throw new ApiError(403,"Your role cannot create executions");
   if(!validUUID(body?.workflow_id))throw new ApiError(400,"Valid workflow_id required");
   const requestKey=request.headers.get("idempotency-key");
   if(requestKey!==null && (!/^[A-Za-z0-9._:-]{8,128}$/.test(requestKey)))throw new ApiError(400,"Invalid Idempotency-Key header");
   const rows=await tx.unsafe(
    "INSERT INTO runs(tenant_id,workflow_id,workflow_version,status,created_by,request_key) SELECT $1,w.id,w.version,'queued',$3,$4 FROM workflows w WHERE w.tenant_id=$1 AND w.id=$2 AND w.status='published' ON CONFLICT DO NOTHING RETURNING id,tenant_id,workflow_id,workflow_version,status,created_at",
    [tenantId,body.workflow_id,subject,requestKey]);
   if(rows.length){
    await tx.unsafe("INSERT INTO run_events(tenant_id,run_id,event_type,actor) VALUES($1,$2,'queued',$3)",[tenantId,rows[0].id,subject]);
    return {run:rows[0],replayed:false};
   }
   if(requestKey){
    const prior=await tx.unsafe("SELECT id,tenant_id,workflow_id,workflow_version,status,created_at FROM runs WHERE tenant_id=$1 AND request_key=$2",[tenantId,requestKey]);
    if(prior.length){
      if(prior[0].workflow_id!==body.workflow_id)throw new ApiError(409,"Idempotency key belongs to a different workflow");
      return {run:prior[0],replayed:true};
    }
   }
   throw new ApiError(409,"Workflow must be published before execution");
  });
  return Response.json(write?{...result,execution:"queued; worker not yet connected"}:{runs:result},{status:write?result.replayed?200:202:200,headers:{"Cache-Control":"no-store"}});
 }catch(e){return failResponse(e)}
}
export async function GET(request){return handler(request,false)}
export async function POST(request){return handler(request,true)}
