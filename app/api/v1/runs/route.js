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
     const rows=await tx.unsafe(
       "INSERT INTO runs(tenant_id,workflow_id,workflow_version,status,created_by) SELECT $1,w.id,w.version,'queued',$3 FROM workflows w WHERE w.tenant_id=$1 AND w.id=$2 AND w.status='published' RETURNING id,tenant_id,workflow_id,workflow_version,status,created_at",
       [tenantId,body.workflow_id,subject]);
     if(!rows.length)throw new ApiError(409,"Workflow must exist and be published");
     return rows[0];
   });
   return Response.json(write?{run:result,note:"Execution engine not yet connected"}:{runs:result},{status:write?202:200,headers:{"Cache-Control":"no-store"}});
 }catch(e){return failResponse(e)}
}
export async function GET(request){return handler(request,false)}
export async function POST(request){return handler(request,true)}
