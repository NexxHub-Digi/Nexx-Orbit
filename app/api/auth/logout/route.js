import {NextResponse} from "next/server";
import {ApiError,failResponse} from "../../../../lib/server/errors.js";
import {cookieOptions,requireSameOrigin,sessionCookieName,stateCookieName} from "../../../../lib/server/session.js";
export const runtime="nodejs";
export async function POST(request){
 try{
  requireSameOrigin(request);
  const response=NextResponse.json({signedOut:true},{headers:{"Cache-Control":"no-store"}});
  response.cookies.set(sessionCookieName(),"",cookieOptions(0));
  response.cookies.set(stateCookieName(),"",cookieOptions(0));
  return response;
 }catch(e){return failResponse(e)}
}
