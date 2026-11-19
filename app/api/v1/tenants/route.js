import {authenticate} from "../../../../lib/server/auth.js";
import {inContext} from "../../../../lib/server/db.js";
import {failResponse} from "../../../../lib/server/errors.js";
export const runtime="nodejs";
export async function GET(request){
 try{
   const {subject}=await authenticate(request);
   const tenants=await inContext(subject,null,tx=>tx.unsafe(
     "SELECT t.id,t.name,t.slug,t.plan,m.role FROM tenant_memberships m JOIN tenants t ON t.id=m.tenant_id WHERE m.subject_id=$1 AND m.status='active' ORDER BY t.name",
     [subject]));
   return Response.json({tenants},{headers:{"Cache-Control":"no-store"}});
 }catch(e){return failResponse(e)}
}
