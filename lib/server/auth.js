import {createRemoteJWKSet,jwtVerify} from "jose";
import {ApiError} from "./errors.js";
import {readCookie,requireSameOrigin,sessionCookieName,verifySession} from "./session.js";
let jwks,configuredUrl;
export async function authenticate(request){
 const raw=request.headers.get("authorization")||"";
 if(raw.startsWith("Bearer ")&&raw.slice(7).trim()){
  const {OIDC_ISSUER:issuer,OIDC_AUDIENCE:audience,OIDC_JWKS_URL:url}=process.env;
  if(!issuer||!audience||!url||!url.startsWith("https://"))throw new ApiError(503,"OIDC bearer verifier not configured");
  if(!jwks||configuredUrl!==url){jwks=createRemoteJWKSet(new URL(url));configuredUrl=url}
  try{
   const {payload}=await jwtVerify(raw.slice(7).trim(),jwks,{issuer,audience,algorithms:["RS256","ES256"]});
   if(typeof payload.sub!=="string"||!payload.sub)throw new Error("Missing subject");
   return {subject:payload.sub,provider:"oidc"};
  }catch{throw new ApiError(401,"Invalid or expired access token")}
 }
 if(raw)throw new ApiError(401,"Unsupported Authorization header");
 const token=readCookie(request,sessionCookieName());
 const user=await verifySession(token);
 if(!["GET","HEAD","OPTIONS"].includes(request.method))requireSameOrigin(request);
 return user;
}
