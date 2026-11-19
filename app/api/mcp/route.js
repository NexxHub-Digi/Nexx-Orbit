import {authenticate} from "../../../lib/server/auth.js";
import {inContext,requireMembership} from "../../../lib/server/db.js";
import {ApiError,requestBody,failResponse} from "../../../lib/server/errors.js";
import {validUUID} from "../../../lib/policy.js";
import {MCP_VERSION,MCP_TOOLS,McpProtocolError,validateMcpTransport,rpcResult,rpcError} from "../../../lib/mcp/protocol.js";
export const runtime="nodejs";
export async function POST(request){
 let body;
 try{
  body=await requestBody(request);
  validateMcpTransport(request,body);
  const {subject}=await authenticate(request);
  if(body.method==="tools/list"){
    return Response.json(rpcResult(body.id,{tools:MCP_TOOLS,ttlMs:60000,cacheScope:"private"}),{headers:{"Cache-Control":"no-store","MCP-Protocol-Version":MCP_VERSION}});
  }
  if(body.method!=="tools/call")throw new McpProtocolError(-32601,"Method not found",404);
  const {name,arguments:args}=body.params||{};
  const tool=MCP_TOOLS.find(t=>t.name===name);
  if(!tool)throw new McpProtocolError(-32602,"Unknown tool");
  const tenantId=args?.tenant_id;
  if(!validUUID(tenantId)||Object.keys(args||{}).some(k=>k!=="tenant_id"))throw new McpProtocolError(-32602,"Valid tenant_id required");
  const data=await inContext(subject,tenantId,async tx=>{
    await requireMembership(tx,subject,tenantId);
    const sql=name==="orbit_list_workflows"
      ?"SELECT id,name,status,version,created_at FROM workflows WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 50"
      :name==="orbit_list_agents"
      ?"SELECT id,name,status,model_route,created_at FROM agent_definitions WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 50"
      :"SELECT id,workflow_id,status,created_at FROM runs WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 50";
    return tx.unsafe(sql,[tenantId]);
  });
  return Response.json(rpcResult(body.id,{content:[{type:"text",text:JSON.stringify({items:data})}],structuredContent:{items:data}}),{headers:{"Cache-Control":"no-store","MCP-Protocol-Version":MCP_VERSION}});
 }catch(e){
  if(e instanceof ApiError && e.status===401)return failResponse(e);
  const code=e instanceof ApiError && e.status===403?-32003:e.code??-32603;
  const message=e?.status===500||!e?.status?"MCP request failed":e.message;
  return Response.json(rpcError(body?.id,{code,message}),{status:e.status||500,headers:{"Cache-Control":"no-store","MCP-Protocol-Version":MCP_VERSION}});
 }
}
export function GET(){return new Response(null,{status:405,headers:{"Allow":"POST"}})}
export function DELETE(){return new Response(null,{status:405,headers:{"Allow":"POST"}})}
