import test from "node:test";
import assert from "node:assert/strict";
import {newInvitationToken,digestToken,validToken,joinUrl,normalizedEmail,validRole} from "../lib/invitations.js";
test("tokens are random, 256-bit and hashed",()=>{
 const a=newInvitationToken(),b=newInvitationToken();
 assert.ok(validToken(a.token));assert.notEqual(a.token,b.token);
 assert.equal(digestToken(a.token),a.hash);assert.match(a.hash,/^[a-f0-9]{64}$/);
 assert.throws(()=>digestToken("invalid"));
});
test("join links store token in URL fragment, never query",()=>{
 const {token}=newInvitationToken(),url=new URL(joinUrl("https://nexx-orbit.vercel.app",token));
 assert.equal(url.pathname,"/join");assert.equal(url.search,"");assert.equal(url.hash,"#invite="+token);
});
test("roles and normalized emails are validated",()=>{
 assert.equal(normalizedEmail(" HELLO+one@Example.com "),"hello+one@example.com");
 assert.equal(normalizedEmail("not an email"),null);
 assert.equal(validRole("owner"),false);assert.equal(validRole("builder"),true);
});
