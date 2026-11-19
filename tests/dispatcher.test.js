import test from "node:test";
import assert from "node:assert/strict";
import {DISPATCHER_ID,validatePollingInterval,listWorkerTenants} from "../lib/orchestrator/dispatcher.js";
test("polling interval bounded",()=>{
 assert.equal(validatePollingInterval(),3000);
 assert.equal(validatePollingInterval("1500"),1500);
 for(const invalid of ["0","500","100000","abc","-200"])assert.throws(()=>validatePollingInterval(invalid));
});
test("only designated dispatcher enumerates tenant memberships",async()=>{
 await assert.rejects(()=>listWorkerTenants(null,"worker:unknown"),/Only the globally assigned/);
 assert.equal(DISPATCHER_ID,"worker:orbit-dispatcher");
});
