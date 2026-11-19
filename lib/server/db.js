import postgres from "postgres";
import { ApiError } from "./errors.js";
let pool;
export function validRuntimeConnection(url,role="orbit_api"){
 try{
  const parsed=new URL(url);
  return (parsed.protocol==="postgresql:"||parsed.protocol==="postgres:") &&
   parsed.username===role && !!parsed.password && !!parsed.hostname;
 }catch{return false}
}
export function database(){
 const url=process.env.DATABASE_URL;
 if(!url||!validRuntimeConnection(url))throw new ApiError(503,"Restricted database runtime role not configured");
 if(!pool)pool=postgres(url,{max:2,ssl:"require",connect_timeout:10,idle_timeout:10});
 return pool;
}
export async function inContext(subject,tenantId,callback){
 return database().begin(async tx=>{
  await tx.unsafe("SELECT set_config('app.subject',$1,true)",[subject]);
  if(tenantId)await tx.unsafe("SELECT set_config('app.tenant_id',$1,true)",[tenantId]);
  return callback(tx);
 });
}
export async function requireMembership(tx,subject,tenantId){
 const rows=await tx.unsafe("SELECT m.role FROM tenant_memberships m JOIN tenants t ON t.id=m.tenant_id WHERE m.tenant_id=$1 AND m.subject_id=$2 AND m.status='active' AND t.status='active' LIMIT 1",[tenantId,subject]);
 if(!rows.length)throw new ApiError(403,"Tenant access denied");
 return rows[0].role;
}
