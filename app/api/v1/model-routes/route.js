import {authenticate} from "../../../../lib/server/auth.js";
import {inContext,requireMembership} from "../../../../lib/server/db.js";
import {ApiError,failResponse,requestBody} from "../../../../lib/server/errors.js";
import {bounded,routeKey} from "../../../../lib/server/inputs.js";
import {can,validUUID} from "../../../../lib/policy.js";
export const runtime="nodejs";
const providers=new Set(["openai","anthropic","gemini","groq","deepseek","qwen","huggingface","custom"]);
async function handler(request,write){
 try{
  const {subject}=await authenticate(request);
  const body=write?await requestBody(request):null;
  const tenantId=write?body?.tenant_id:new URL(request.url).searchParams.get("tenant_id");
  if(!validUUID(tenantId))throw new ApiError(400,"Valid tenant_id required");
  const result=await inContext(subject,tenantId,async tx=>{
   const role=await requireMembership(tx,subject,tenantId);
   if(!write)return tx.unsafe("SELECT id,tenant_id,route_key,provider,model_id,status,created_at FROM model_routes WHERE tenant_id=$1 ORDER BY route_key LIMIT 100",[tenantId]);
   if(!can(role,"members:manage"))throw new ApiError(403,"Only tenant admins may register model routes");
   const key=routeKey(body.route_key),provider=bounded(body.provider,"provider",40),modelId=bounded(body.model_id,"model_id",160);
   if(!providers.has(provider))throw new ApiError(400,"Unsupported model provider");
   const rows=await tx.unsafe("INSERT INTO model_routes(tenant_id,route_key,provider,model_id,created_by) VALUES($1,$2,$3,$4,$5) RETURNING id,tenant_id,route_key,provider,model_id,status,created_at",[tenantId,key,provider,modelId,subject]);
   return rows[0];
  });
  return Response.json(write?{route:result}:{routes:result},{status:write?201:200,headers:{"Cache-Control":"no-store"}});
 }catch(e){return failResponse(e)}
}
export async function GET(request){return handler(request,false)}
export async function POST(request){return handler(request,true)}
