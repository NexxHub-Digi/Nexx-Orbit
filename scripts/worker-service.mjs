import {openWorker} from "../lib/orchestrator/worker.js";
import {DISPATCHER_ID,runDispatchCycle,validatePollingInterval} from "../lib/orchestrator/dispatcher.js";
const subject=process.env.ORBIT_WORKER_SUBJECT;
const ms=validatePollingInterval(process.env.ORBIT_WORKER_POLL_MS);
if(subject!==DISPATCHER_ID){
 console.error("Set ORBIT_WORKER_SUBJECT to the provisioned dispatcher identity");
 process.exitCode=1;
}else{
 let stopping=false,client;
 process.on("SIGTERM",()=>{stopping=true});
 process.on("SIGINT",()=>{stopping=true});
 try{
  client=await openWorker();
  console.log(JSON.stringify({event:"worker_started",poll_interval_ms:ms}));
  let cycle=0;
  while(!stopping){
   cycle++;
   try{
    const result=await runDispatchCycle({sql:client,subject,logger:record=>console.log(JSON.stringify({event:"tenant_run",...record}))});
    if(result.processed||result.waiting||result.failures||cycle%100===0)
     console.log(JSON.stringify({event:"dispatch_cycle",cycle,...result}));
   }catch(e){
    console.error(JSON.stringify({event:"dispatch_error",error:e.message}));
   }
   if(!stopping)await new Promise(resolve=>setTimeout(resolve,ms));
  }
 }catch(e){
  console.error(JSON.stringify({event:"worker_fatal",error:e.message}));
  process.exitCode=1;
 }finally{
  if(client)await client.end();
  console.log(JSON.stringify({event:"worker_stopped"}));
 }
}
