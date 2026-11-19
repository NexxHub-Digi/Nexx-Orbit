export class ApiError extends Error {
  constructor(status,message){super(message);this.status=status}
}
export function failResponse(error){
  const status=Number.isInteger(error?.status)&&error.status>=400&&error.status<=599?error.status:500;
  if(status===500) console.error("Nexx Orbit API error:",error);
  return Response.json({error:status===500?"Internal server error":error.message},{status,headers:{"Cache-Control":"no-store"}});
}
export async function requestBody(request){
  const length=Number(request.headers.get("content-length")||0);
  if(length>150000)throw new ApiError(413,"Request body too large");
  const raw=await request.text();
  if(raw.length>150000)throw new ApiError(413,"Request body too large");
  try{return JSON.parse(raw)}catch{throw new ApiError(400,"Invalid JSON body")}
}
