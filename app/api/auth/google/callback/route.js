import {NextResponse} from "next/server";
import {createRemoteJWKSet,jwtVerify} from "jose";
import {timingSafeEqual} from "node:crypto";
import {ApiError} from "../../../../../lib/server/errors.js";
import {authOrigin,cookieOptions,readCookie,sessionCookieName,signSession,stateCookieName,verifyOAuthState} from "../../../../../lib/server/session.js";
export const runtime="nodejs";
const GOOGLE_JWKS=createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
function safeMatch(a,b){
 if(typeof a!=="string"||typeof b!=="string")return false;
 const x=Buffer.from(a),y=Buffer.from(b);
 return x.length===y.length&&timingSafeEqual(x,y);
}
export async function GET(request){
 let origin;
 try{origin=authOrigin()}catch(e){return Response.json({error:"Application origin not configured"},{status:503})}
 const query=new URL(request.url).searchParams;
 const redirect=(code)=>NextResponse.redirect(new URL("/login?error="+encodeURIComponent(code),origin));
 try{
  if(query.get("error"))throw new ApiError(400,"oauth_denied");
  const state=query.get("state"),code=query.get("code");
  if(!state||!code)throw new ApiError(400,"oauth_missing_response");
  const saved=await verifyOAuthState(readCookie(request,stateCookieName()));
  if(!safeMatch(state,saved.state))throw new ApiError(400,"oauth_state_mismatch");
  const {GOOGLE_CLIENT_ID:clientId,GOOGLE_CLIENT_SECRET:clientSecret}=process.env;
  if(!clientId||!clientSecret)throw new ApiError(503,"oauth_not_configured");
  const exchange=await fetch("https://oauth2.googleapis.com/token",{
   method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},
   body:new URLSearchParams({
    client_id:clientId,client_secret:clientSecret,code,grant_type:"authorization_code",
    redirect_uri:origin+"/api/auth/google/callback",code_verifier:saved.verifier
   }),signal:AbortSignal.timeout(10000),cache:"no-store"
  });
  if(!exchange.ok)throw new ApiError(401,"oauth_exchange_failed");
  const result=await exchange.json();
  if(typeof result.id_token!=="string")throw new ApiError(401,"oauth_token_missing");
  const verified=await jwtVerify(result.id_token,GOOGLE_JWKS,{
   issuer:["https://accounts.google.com","accounts.google.com"],audience:clientId,algorithms:["RS256"],clockTolerance:30
  });
  const claims=verified.payload;
  if(!safeMatch(claims.nonce,saved.nonce)||claims.email_verified!==true||
    typeof claims.sub!=="string"||!claims.sub)
    throw new ApiError(401,"oauth_claims_invalid");
  const session=await signSession({subject:"google:"+claims.sub,email:claims.email,name:claims.name});
  const response=NextResponse.redirect(new URL("/workspace",origin));
  response.headers.set("Cache-Control","no-store");
  response.cookies.set(sessionCookieName(),session,cookieOptions(8*60*60));
  response.cookies.set(stateCookieName(),"",cookieOptions(0));
  return response;
 }catch(e){
  const response=redirect(e instanceof ApiError?e.message:"oauth_failed");
  response.headers.set("Cache-Control","no-store");
  response.cookies.set(stateCookieName(),"",cookieOptions(0));
  return response;
 }
}
