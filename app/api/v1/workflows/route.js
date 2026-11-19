import {authenticate} from "../../../../lib/server/auth.js";
import {inContext,requireMembership} from "../../../../lib/server/db.js";
import {ApiError,failResponse,requestBody} from "../../../../lib/server/errors.js";
import {can,validUUID,validateGraph} from "../../../../lib/policy.js";
export const runtime="nodejs";
async function handler(request,write){
 try{
   const {subject}=await authenticate(request);
   const body=write?await requestBody(request):null;
   const tenantId=write?body?.tenant_id:new URL(request.url).searchParams.get("tenant_id");
   if(!validUUID(tenantId))throw new ApiError(400,"Valid tenant_id required");
   const result=await inContext(subject,tenantId,async tx=>{
     const role=await requireMembership(tx,subject,tenantId);
     if(!write)return tx.unsafe("SELECT id,tenant_id,name,description,status,version,graph,created_at,updated_at FROM workflows WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 100",[tenantId]);
     if(!can(role,"workflows:create"))throw new ApiError(403,"Your role cannot create workflows");
     const name=typeof body?.name==="string"?body.name.trim():"";
     const description=typeof body?.description==="string"?body.description.trim():"";
     const graph=body?.graph??{nodes:[],edges:[]};
     if(!name||name.length>120||description.length>2000||!validateGraph(graph)||JSON.stringify(graph).length>100000)
       throw new ApiError(400,"Invalid workflow definition");
     const rows=await tx.unsafe(
       "INSERT INTO workflows(tenant_id,name,description,graph,created_by) VALUES($1,$2,$3,$4::jsonb,$5) RETURNING id,tenant_id,name,status,version,created_at",
       [tenantId,name,description,JSON.stringify(graph),subject]);
     return rows[0];
   });
   return Response.json(write?{workflow:result}:{workflows:result},{status:write?201:200,headers:{"Cache-Control":"no-store"}});
 }catch(e){return failResponse(e)}
}
export async function GET(request){return handler(request,false)}
export async function POST(request){return handler(request,true)}
