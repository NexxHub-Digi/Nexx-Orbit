import test from "node:test";
import assert from "node:assert/strict";
import {stepBehavior} from "../lib/orchestrator/worker.js";
test("only deterministic operations are auto-completed",()=>{
 assert.equal(stepBehavior("start"),"complete");
 assert.equal(stepBehavior("noop"),"complete");
 assert.equal(stepBehavior("end"),"complete");
});
test("human gates are never auto-approved",()=>{
 assert.equal(stepBehavior("approval"),"approval");
 assert.equal(stepBehavior("manual"),"approval");
});
test("external agent/MCP calls fail closed without approved adapters",()=>{
 for(const type of ["agent","tool","condition","delay","parallel","unknown"])assert.equal(stepBehavior(type),"unavailable");
});
