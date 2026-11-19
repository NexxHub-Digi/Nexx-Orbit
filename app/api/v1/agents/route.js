import {authenticate} from "../../../../lib/server/auth.js";
import {inContext,requireMembership} from "../../../../lib/server/db.js";
import {ApiError,failResponse,requestBody} from "../../../../lib/server/errors.js";
import {bounded,optionalText} from "../../../../lib/server/inputs.js";
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
   if(!write)return tx.unsafe("SELECT id,tenant_id,name,description,model_route,status,config,created_at FROM agent_definitions WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 100",[tenantId]);
   if(!can(role,"workflows:create"))throw new ApiError(403,"Your role cannot create agents");
   const name=bounded(body.name,"name");
   const description=optionalText(body.description);
   const instructions=optionalText(body.instructions,20000);
   const modelRoute=body.model_route==null?"default":bounded(body.model_route,"model_route",64);
   const rows=await tx.unsafe("INSERT INTO agent_definitions(tenant_id,name,description,instructions,model_route,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,tenant_id,name,description,model_route,status,created_at",[tenantId,name,description,instructions,modelRoute,subject]);
   return rows[0];
  });
  return Response.json(write?{agent:result}:{agents:result},{status:write?201:200,headers:{"Cache-Control":"no-store"}});
 }catch(e){return failResponse(e)}
}
export async function GET(request){return handler(request,false)}
export async function POST(request){return handler(request,true)}
