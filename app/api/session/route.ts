import {cookies} from 'next/headers';
import {db} from '@/lib/db';
import {session,setSession} from '@/lib/auth';
import {z} from 'zod';
export async function GET() {
  const current = await session();
  if (!current) return Response.json({error:'Sign in to continue.'},{status:401});
  const memberships = await db.membership.findMany({where:{userId:current.userId},include:{business:true}});
  return Response.json({business:current.business,userId:current.userId,role:current.role,name:current.user.name,firms:memberships.map(x=>x.business)});
}
export async function POST(request: Request) {
  const parsed = z.object({phone:z.string().regex(/^\d{10}$/),otp:z.literal('123456')}).safeParse(await request.json().catch(()=>null));
  if (!parsed.success || process.env.DEMO_OTP_ENABLED !== 'true') return Response.json({error:'Invalid credentials or local demo sign-in is disabled.'},{status:401});
  const user = await db.user.findUnique({where:{phone:parsed.data.phone},include:{memberships:true}});
  const membership = user?.memberships[0];
  if (!membership) return Response.json({error:'Invalid credentials.'},{status:401});
  await setSession(membership.userId,membership.businessId);
  return Response.json({ok:true});
}
export async function PATCH(request: Request) {
  const current = await session();
  if (!current) return Response.json({error:'Sign in first.'},{status:401});
  const {businessId} = await request.json();
  const member = typeof businessId === 'string' && await db.membership.findUnique({where:{businessId_userId:{businessId,userId:current.userId}}});
  if (!member) return Response.json({error:'Firm unavailable.'},{status:404});
  await setSession(member.userId,member.businessId);
  return Response.json({ok:true});
}
export async function DELETE() {
  (await cookies()).delete('tilebook');
  return Response.json({ok:true});
}
