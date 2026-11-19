import {authenticate} from "../../../../lib/server/auth.js";
import {inContext} from "../../../../lib/server/db.js";
import {ApiError,failResponse,requestBody} from "../../../../lib/server/errors.js";
export const runtime="nodejs";
export async function GET(request){
 try{
  const {subject}=await authenticate(request);
  const tenants=await inContext(subject,null,tx=>tx.unsafe(
   "SELECT t.id,t.name,t.slug,t.plan,m.role FROM tenant_memberships m JOIN tenants t ON t.id=m.tenant_id WHERE m.subject_id=$1 AND m.status='active' AND t.status='active' ORDER BY t.name",[subject]));
  return Response.json({tenants},{headers:{"Cache-Control":"no-store"}});
 }catch(e){return failResponse(e)}
}
export async function POST(request){
 try{
  const {subject}=await authenticate(request);
  const body=await requestBody(request);
  const name=typeof body?.name==="string"?body.name.trim():"";
  const slug=typeof body?.slug==="string"?body.slug.trim():"";
  if(name.length<2||name.length>120||slug.length>70||!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug))
   throw new ApiError(400,"Invalid organization name or slug");
  const rows=await inContext(subject,null,tx=>tx.unsafe(
   "SELECT * FROM public.provision_orbit_tenant($1,$2)",[name,slug]));
  return Response.json({tenant:rows[0]},{status:201,headers:{"Cache-Control":"no-store"}});
 }catch(e){
  if(e.code==="23505")return failResponse(new ApiError(409,"Organization slug already exists"));
  if(e.code==="P0001")return failResponse(new ApiError(409,"Organization limit reached"));
  return failResponse(e);
 }
}
