import {SignJWT,jwtVerify} from "jose";
import {ApiError} from "./errors.js";
const issuer="nexx-orbit";
const audience="nexx-orbit-web";
const stateAudience="nexx-orbit-oauth-state";
export function authOrigin(){
 const raw=process.env.AUTH_APP_ORIGIN;
 if(!raw)throw new ApiError(503,"Application origin not configured");
 let u;try{u=new URL(raw)}catch{throw new ApiError(503,"Invalid application origin")}
 if(!["https:","http:"].includes(u.protocol)||u.username||u.password||u.search||u.hash||u.pathname!=="/"||
 (u.protocol==="http:"&&!["localhost","127.0.0.1"].includes(u.hostname)))
 throw new ApiError(503,"Application origin must be an HTTPS origin (HTTP localhost allowed)");
 return u.origin;
}
export function secureCookies(){return new URL(authOrigin()).protocol==="https:"}
export function sessionCookieName(){return secureCookies()?"__Host-orbit-session":"orbit-session"}
export function stateCookieName(){return secureCookies()?"__Host-orbit-oauth":"orbit-oauth"}
function key(){
 const v=process.env.AUTH_SESSION_SECRET;
 if(!v||new TextEncoder().encode(v).length<32)throw new ApiError(503,"Session secret not configured");
 return new TextEncoder().encode(v);
}
export async function signSession({subject,email,name}){
 if(typeof subject!=="string"||!subject.startsWith("google:"))throw new ApiError(400,"Invalid session subject");
 return new SignJWT({email:email||"",name:name||""}).setProtectedHeader({alg:"HS256"})
  .setIssuer(issuer).setAudience(audience).setSubject(subject).setIssuedAt().setExpirationTime("8h").sign(key());
}
export async function verifySession(token){
 if(!token)throw new ApiError(401,"Authentication required");
 try{
  const {payload}=await jwtVerify(token,key(),{issuer,audience,algorithms:["HS256"]});
  if(!payload.sub?.startsWith("google:"))throw new Error("Invalid subject");
  return {subject:payload.sub,email:payload.email||"",name:payload.name||"",provider:"google"};
 }catch(e){if(e instanceof ApiError)throw e;throw new ApiError(401,"Session expired or invalid")}
}
export async function signOAuthState({state,nonce,verifier}){
 return new SignJWT({state,nonce,verifier}).setProtectedHeader({alg:"HS256"})
  .setIssuer(issuer).setAudience(stateAudience).setIssuedAt().setExpirationTime("10m").sign(key());
}
export async function verifyOAuthState(token){
 try{
  const {payload}=await jwtVerify(token,key(),{issuer,audience:stateAudience,algorithms:["HS256"]});
  if(!payload.state||!payload.nonce||!payload.verifier)throw new Error("Missing OAuth parameters");
  return payload;
 }catch{throw new ApiError(400,"Invalid or expired OAuth state")}
}
export function readCookie(request,name){
 const raw=request.headers.get("cookie")||"";
 const pair=raw.split(";").map(p=>p.trim()).find(p=>p.startsWith(name+"="));
 if(!pair)return null;
 try{return decodeURIComponent(pair.substring(name.length+1))}catch{return null}
}
export function cookieOptions(maxAge){return {httpOnly:true,secure:secureCookies(),sameSite:"lax",path:"/",maxAge}}
export function requireSameOrigin(request){
 const expected=authOrigin(),actual=request.headers.get("origin");
 if(actual!==expected)throw new ApiError(403,"Cross-origin write denied");
}
