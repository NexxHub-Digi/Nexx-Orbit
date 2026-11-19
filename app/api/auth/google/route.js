import {NextResponse} from "next/server";
import {createHash,randomBytes} from "node:crypto";
import {ApiError,failResponse} from "../../../../lib/server/errors.js";
import {authOrigin,cookieOptions,signOAuthState,stateCookieName} from "../../../../lib/server/session.js";
export const runtime="nodejs";
export async function GET(){
 try{
  const origin=authOrigin(),clientId=process.env.GOOGLE_CLIENT_ID;
  if(!clientId)throw new ApiError(503,"Google OAuth client not configured");
  const state=randomBytes(24).toString("base64url");
  const nonce=randomBytes(24).toString("base64url");
  const verifier=randomBytes(40).toString("base64url");
  const challenge=createHash("sha256").update(verifier).digest("base64url");
  const signedState=await signOAuthState({state,nonce,verifier});
  const url=new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search=new URLSearchParams({
   client_id:clientId,redirect_uri:origin+"/api/auth/google/callback",
   response_type:"code",scope:"openid email profile",state,nonce,
   code_challenge:challenge,code_challenge_method:"S256",access_type:"online",prompt:"select_account"
  }).toString();
  const response=NextResponse.redirect(url);
  response.headers.set("Cache-Control","no-store");
  response.cookies.set(stateCookieName(),signedState,cookieOptions(600));
  return response;
 }catch(e){return failResponse(e)}
}
