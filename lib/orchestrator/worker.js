import postgres from "postgres";
import {compilePlan} from "./plan.js";
import {validUUID} from "../policy.js";
const autodone=new Set(["start","end","noop"]);
const approvals=new Set(["approval","manual"]);
export function stepBehavior(type){
 if(autodone.has(type))return "complete";
 if(approvals.has(type))return "approval";
 return "unavailable";
}
async function event(tx,tenantId,runId,eventType,subject,stepId=null,payload={}){
 await tx.unsafe("INSERT INTO run_events(tenant_id,run_id,event_type,actor,step_id,payload) VALUES($1,$2,$3,$4,$5,$6::jsonb)",[tenantId,runId,eventType,subject,stepId,JSON.stringify(payload)]);
}
async function setRun(tx,tenantId,runId,status){
 await tx.unsafe("UPDATE runs SET status=$3,updated_at=now() WHERE tenant_id=$1 AND id=$2",[tenantId,runId,status]);
}
async function markStep(tx,tenantId,runId,step,status,output={}){
 await tx.unsafe(`INSERT INTO run_step_states(tenant_id,run_id,step_id,node_type,status,output)
  VALUES($1,$2,$3,$4,$5,$6::jsonb) ON CONFLICT(tenant_id,run_id,step_id)
  DO UPDATE SET status=excluded.status,output=excluded.output,updated_at=now()`,[tenantId,runId,step.id,step.type,status,JSON.stringify(output)]);
}
export async function processNextRun({sql,tenantId,subject}){
 if(!validUUID(tenantId)||!subject||typeof subject!=="string")throw new Error("Explicit tenant and worker identity required");
 return sql.begin(async tx=>{
  await tx.unsafe("SELECT set_config('app.subject',$1,true)",[subject]);
  await tx.unsafe("SELECT set_config('app.tenant_id',$1,true)",[tenantId]);
  const m=await tx.unsafe("SELECT m.role FROM tenant_memberships m JOIN tenants t ON t.id=m.tenant_id WHERE m.tenant_id=$1 AND m.subject_id=$2 AND m.status='active' AND t.status='active'",[tenantId,subject]);
  if(m[0]?.role!=="operator")throw new Error("Worker is not explicitly assigned as tenant operator");
  const runs=await tx.unsafe("SELECT r.id,r.workflow_id,r.status FROM runs r WHERE r.tenant_id=$1 AND (r.status='queued' OR (r.status='waiting_approval' AND EXISTS (SELECT 1 FROM run_approvals a JOIN run_step_states s ON s.tenant_id=a.tenant_id AND s.run_id=a.run_id AND s.step_id=a.step_id WHERE a.tenant_id=r.tenant_id AND a.run_id=r.id AND s.status='pending_approval'))) ORDER BY r.created_at FOR UPDATE OF r SKIP LOCKED LIMIT 1",[tenantId]);
  if(!runs.length)return {status:"idle"};
  const run=runs[0];
  const rows=await tx.unsafe("SELECT graph FROM workflows WHERE id=$1 AND tenant_id=$2 AND status='published'",[run.workflow_id,tenantId]);
  if(!rows.length){
   await setRun(tx,tenantId,run.id,"failed");
   await event(tx,tenantId,run.id,"failed",subject,null,{reason:"Published workflow version not found"});
   return {status:"failed",run_id:run.id};
  }
  let plan;
  try{plan=compilePlan(rows[0].graph)}catch(e){
   await setRun(tx,tenantId,run.id,"failed");
   await event(tx,tenantId,run.id,"failed",subject,null,{reason:"Invalid workflow graph"});
   return {status:"failed",run_id:run.id};
  }
  if(run.status==="queued"){
   await setRun(tx,tenantId,run.id,"running");
   await event(tx,tenantId,run.id,"started",subject);
  }
  let completed=0;
  for(const step of plan.steps){
   const old=await tx.unsafe("SELECT status FROM run_step_states WHERE tenant_id=$1 AND run_id=$2 AND step_id=$3",[tenantId,run.id,step.id]);
   if(old[0]?.status==="completed"){completed++;continue}
   if(old[0]?.status==="failed"){await setRun(tx,tenantId,run.id,"failed");return {status:"failed",run_id:run.id,completed}}
   if(old[0]?.status==="pending_approval"){
    const decision=await tx.unsafe("SELECT decision FROM run_approvals WHERE tenant_id=$1 AND run_id=$2 AND step_id=$3",[tenantId,run.id,step.id]);
    if(!decision.length){await setRun(tx,tenantId,run.id,"waiting_approval");return {status:"waiting_approval",run_id:run.id,step_id:step.id,completed}}
    if(decision[0].decision==="rejected"){
     await markStep(tx,tenantId,run.id,step,"failed",{reason:"Human approval rejected"});
     await setRun(tx,tenantId,run.id,"failed");
     await event(tx,tenantId,run.id,"failed",subject,step.id,{reason:"Approval rejected"});
     return {status:"failed",run_id:run.id,step_id:step.id,completed};
    }
    await markStep(tx,tenantId,run.id,step,"completed",{decision:"approved"});
    await event(tx,tenantId,run.id,"step_completed",subject,step.id,{decision:"approved"});
    completed++;continue;
   }
   const kind=stepBehavior(step.type);
   if(kind==="approval"){
    await markStep(tx,tenantId,run.id,step,"pending_approval");
    await event(tx,tenantId,run.id,"approval_requested",subject,step.id);
    await setRun(tx,tenantId,run.id,"waiting_approval");
    return {status:"waiting_approval",run_id:run.id,step_id:step.id,completed};
   }
   if(kind==="unavailable"){
    const reason="Adapter for node type '"+step.type+"' is not enabled";
    await markStep(tx,tenantId,run.id,step,"failed",{reason});
    await event(tx,tenantId,run.id,"step_failed",subject,step.id,{reason});
    await setRun(tx,tenantId,run.id,"failed");
    return {status:"failed",run_id:run.id,step_id:step.id,completed,reason};
   }
   await markStep(tx,tenantId,run.id,step,"completed");
   await event(tx,tenantId,run.id,"step_completed",subject,step.id);
   completed++;
  }
  await setRun(tx,tenantId,run.id,"completed");
  await event(tx,tenantId,run.id,"completed",subject,null,{completed_steps:completed});
  return {status:"completed",run_id:run.id,completed};
 });
}
export async function openWorker(){
 const url=process.env.WORKER_DATABASE_URL;
 if(!url)throw new Error("WORKER_DATABASE_URL must use the restricted orbit_worker role");
 const parsed=new URL(url);
 if(parsed.username!=="orbit_worker")throw new Error("Refusing worker connection with non-worker database role");
 return postgres(url,{max:1,ssl:"require",connect_timeout:10});
}
