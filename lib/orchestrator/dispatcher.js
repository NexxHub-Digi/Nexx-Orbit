import {processNextRun} from "./worker.js";
export const DISPATCHER_ID="worker:orbit-dispatcher";
export function validatePollingInterval(raw){
 const n=raw==null?3000:Number(raw);
 if(!Number.isInteger(n)||n<1000||n>60000)throw new Error("ORBIT_WORKER_POLL_MS must be 1000-60000");
 return n;
}
export async function listWorkerTenants(sql,subject=DISPATCHER_ID){
 if(subject!==DISPATCHER_ID)throw new Error("Only the globally assigned dispatcher may enumerate tenant work");
 return sql.begin(async tx=>{
  await tx.unsafe("SELECT set_config('app.subject',$1,true)",[subject]);
  const rows=await tx.unsafe(
   "SELECT m.tenant_id FROM tenant_memberships m JOIN tenants t ON t.id=m.tenant_id WHERE m.subject_id=$1 AND m.status='active' AND m.role='operator' AND t.status='active' ORDER BY m.tenant_id LIMIT 500",
   [subject]);
  return rows.map(x=>x.tenant_id);
 });
}
export async function runDispatchCycle({sql,subject=DISPATCHER_ID,maxRuns=100,logger=()=>{}}){
 if(subject!==DISPATCHER_ID)throw new Error("Invalid worker identity");
 const tenants=await listWorkerTenants(sql,subject);
 let processed=0,failures=0,waiting=0;
 for(const tenantId of tenants){
  if(processed>=maxRuns)break;
  try{
   const result=await processNextRun({sql,tenantId,subject});
   if(result.status==="idle")continue;
   if(result.status==="waiting_approval")waiting++;
   else processed++;
   logger({tenant_id:tenantId,result});
  }catch(error){
   failures++;
   logger({tenant_id:tenantId,error:error.message||"Run processing failed"});
  }
 }
 return {tenant_count:tenants.length,processed,waiting,failures};
}
