import {health} from '@/server/store';
export const dynamic='force-dynamic';
export async function GET(){try{await health();return Response.json({status:'ok',database:'connected'});}catch{return Response.json({status:'unavailable',database:'unavailable'},{status:503});}}