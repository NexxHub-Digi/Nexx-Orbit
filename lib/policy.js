export const roles=Object.freeze(["owner","admin","builder","operator","viewer"]);
const permissions=Object.freeze({
  "workflows:read":roles,
  "workflows:create":["owner","admin","builder"],
  "runs:read":roles,
  "runs:create":["owner","admin","builder","operator"],
  "members:manage":["owner","admin"]
});
export function can(role,action){return (permissions[action]||[]).includes(role)}
export function validUUID(input){return typeof input==="string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input)}
export function validateGraph(graph){
  if(!graph||typeof graph!=="object"||Array.isArray(graph)||!Array.isArray(graph.nodes)||!Array.isArray(graph.edges))return false;
  if(graph.nodes.length>200||graph.edges.length>1000)return false;
  const ids=graph.nodes.map(n=>n&&typeof n.id==="string"?n.id:null);
  if(ids.some(x=>!x)||new Set(ids).size!==ids.length)return false;
  const set=new Set(ids);
  return graph.edges.every(e=>e&&set.has(e.source)&&set.has(e.target));
}
export function assertSameTenant(left,right){if(!left||left!==right){const e=new Error("Tenant access denied");e.status=403;throw e}}
