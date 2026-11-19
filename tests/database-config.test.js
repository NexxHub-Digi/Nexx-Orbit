import test from "node:test";
import assert from "node:assert/strict";
import {validRuntimeConnection} from "../lib/server/db.js";
test("database only accepts the designated runtime account",()=>{
 assert.equal(validRuntimeConnection("postgresql://orbit_api:password@db.example.com/orbit"),true);
 assert.equal(validRuntimeConnection("postgresql://orbit_owner:password@db.example.com/orbit"),false);
 assert.equal(validRuntimeConnection("postgresql://orbit_worker:password@db.example.com/orbit"),false);
 assert.equal(validRuntimeConnection("http://orbit_api:password@db.example.com/orbit"),false);
 assert.equal(validRuntimeConnection("not-a-url"),false);
});
