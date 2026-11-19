// Minimal stateless MCP 2026-07-28 read-only tool subset.
// Not a complete SDK replacement (subscriptions, resources and other extensions are absent).
export const MCP_VERSION="2026-07-28";
export const MCP_TOOLS=Object.freeze([
 {name:"orbit_list_workflows",description:"List workflow metadata for an authorized tenant.",inputSchema:{type:"object",properties:{tenant_id:{type:"string",format:"uuid"}},required:["tenant_id"],additionalProperties:false}},
 {name:"orbit_list_agents",description:"List agent metadata for an authorized tenant.",inputSchema:{type:"object",properties:{tenant_id:{type:"string",format:"uuid"}},required:["tenant_id"],additionalProperties:false}},
 {name:"orbit_list_runs",description:"List recent execution runs for an authorized tenant.",inputSchema:{type:"object",properties:{tenant_id:{type:"string",format:"uuid"}},required:["tenant_id"],additionalProperties:false}}
]);
export class McpProtocolError extends Error {constructor(code,message,status=400){super(message);this.code=code;this.status=status}}
export function validateMcpTransport(request,body){
 const headers=request.headers;
 if(body?.jsonrpc!=="2.0"||!["string","number"].includes(typeof body?.id)||typeof body?.method!=="string")
  throw new McpProtocolError(-32600,"Invalid JSON-RPC request");
 if(headers.get("mcp-protocol-version")!==MCP_VERSION)
  throw new McpProtocolError(-32001,"Unsupported protocol version; supported: "+MCP_VERSION);
 if(body?.params?._meta?.["io.modelcontextprotocol/protocolVersion"]!==MCP_VERSION)
  throw new McpProtocolError(-32020,"Header mismatch: protocol version");
 if(headers.get("mcp-method")!==body.method)
  throw new McpProtocolError(-32020,"Header mismatch: Mcp-Method");
 if(body.method==="tools/call" && (typeof body.params?.name!=="string"||headers.get("mcp-name")!==body.params.name))
  throw new McpProtocolError(-32020,"Header mismatch: Mcp-Name");
 const origin=headers.get("origin");
 if(origin && origin!==new URL(request.url).origin)
  throw new McpProtocolError(-32003,"Untrusted Origin",403);
 return true;
}
export function rpcResult(id,result){return {jsonrpc:"2.0",id,result}}
export function rpcError(id,error){return {jsonrpc:"2.0",id:id??null,error:{code:error?.code??-32603,message:error?.message||"Internal error"}}}
