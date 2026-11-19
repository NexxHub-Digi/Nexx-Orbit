export const runtime="nodejs";
export async function GET(){
  return Response.json({status:"ok",service:"nexx-orbit",foundation:"v0.2",database:"not_checked",execution_engine:"not_connected"},{headers:{"Cache-Control":"no-store"}});
}
