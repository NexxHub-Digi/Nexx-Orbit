import test from "node:test";
import assert from "node:assert/strict";
import {authOrigin,cookieOptions,signOAuthState,signSession,verifySession,verifyOAuthState,requireSameOrigin} from "../lib/server/session.js";
import {authenticate} from "../lib/server/auth.js";
const previous={secret:process.env.AUTH_SESSION_SECRET,origin:process.env.AUTH_APP_ORIGIN};
process.env.AUTH_SESSION_SECRET="integration-testing-secret-of-64-characters-test-only-do-not-deploy";
process.env.AUTH_APP_ORIGIN="http://localhost:3000";
test("signed session validates and expired/malformed session rejected",async()=>{
 const token=await signSession({subject:"google:abc123",email:"qa@example.com",name:"QA User"});
 const identity=await verifySession(token);
 assert.equal(identity.subject,"google:abc123");
 await assert.rejects(()=>verifySession(token+"tampered"),{status:401});
});
test("signed OAuth state round-trips",async()=>{
 const encoded=await signOAuthState({state:"state-123",nonce:"nonce",verifier:"verifier"});
 const decoded=await verifyOAuthState(encoded);
 assert.equal(decoded.state,"state-123");
 assert.equal(decoded.verifier,"verifier");
});
test("cookie authentication rejects cross-site POST",async()=>{
 const token=await signSession({subject:"google:abc123"});
 const headers={"cookie":"orbit-session="+token,"origin":"http://localhost:3000"};
 const valid=await authenticate(new Request("http://localhost:3000/api/v1/tenants",{method:"POST",headers}));
 assert.equal(valid.subject,"google:abc123");
 await assert.rejects(()=>authenticate(new Request("http://localhost:3000/api/v1/tenants",{method:"POST",headers:{...headers,origin:"https://evil.example"}})),{status:403});
});
test("only local HTTP or real HTTPS allowed for callback origins",()=>{
 assert.equal(authOrigin(),"http://localhost:3000");
 assert.equal(cookieOptions(300).secure,false);
 process.env.AUTH_APP_ORIGIN="http://evil.example";
 assert.throws(()=>authOrigin(),{status:503});
 process.env.AUTH_APP_ORIGIN="http://localhost:3000";
});
process.on("exit",()=>{if(previous.secret===undefined)delete process.env.AUTH_SESSION_SECRET;else process.env.AUTH_SESSION_SECRET=previous.secret;if(previous.origin===undefined)delete process.env.AUTH_APP_ORIGIN;else process.env.AUTH_APP_ORIGIN=previous.origin});
