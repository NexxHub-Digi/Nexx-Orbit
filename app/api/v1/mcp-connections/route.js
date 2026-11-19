import {authenticate} from "../../../../lib/server/auth.js";
import {inContext,requireMembership} from "../../../../lib/server/db.js";
import {ApiError,failResponse,requestBody} from "../../../../lib/server/errors.js";
import {bounded,safeRegistryURL} from "../../../../lib/server/inputs.js";
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
   if(!write)return tx.unsafe("SELECT id,tenant_id,name,endpoint_url,transport,status,allowed_tools,created_at FROM mcp_connections WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 100",[tenantId]);
   if(!can(role,"workflows:create"))throw new ApiError(403,"Your role cannot register tools");
   const name=bounded(body.name,"name"),url=safeRegistryURL(body.endpoint_url);
   const tools=body.allowed_tools??[];
   if(!Array.isArray(tools)||tools.length>100||tools.some(t=>typeof t!=="string"||!/^[a-zA-Z0-9_.-]{1,128}$/.test(t)))throw new ApiError(400,"Invalid tool allowlist");
   // Registration only: deliberately disabled until tenant-owner review and controlled egress exist.
   const rows=await tx.unsafe("INSERT INTO mcp_connections(tenant_id,name,endpoint_url,allowed_tools,created_by) VALUES($1,$2,$3,$4,$5) RETURNING id,tenant_id,name,endpoint_url,transport,status,allowed_tools,created_at",[tenantId,name,url,[...new Set(tools)],subject]);
   return rows[0];
  });
  return Response.json(write?{connection:result}:{connections:result},{status:write?201:200,headers:{"Cache-Control":"no-store"}});
 }catch(e){return failResponse(e)}
}
export async function GET(request){return handler(request,false)}
export async function POST(request){return handler(request,true)}
