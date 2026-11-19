import {processNextRun,openWorker} from "../lib/orchestrator/worker.js";
import {validUUID} from "../lib/policy.js";
const tenantId=process.env.ORBIT_WORKER_TENANT_ID;
const subject=process.env.ORBIT_WORKER_SUBJECT;
if(!validUUID(tenantId)||!subject||!subject.startsWith("worker:")){
 console.error("Configure explicit ORBIT_WORKER_TENANT_ID and worker:... ORBIT_WORKER_SUBJECT");
 process.exitCode=1;
}else{
 let sql;
 try{
  sql=await openWorker();
  const result=await processNextRun({sql,tenantId,subject});
  console.log(JSON.stringify(result));
 }catch(e){console.error("Worker failed:",e.message);process.exitCode=1}
 finally{if(sql)await sql.end()}
}
