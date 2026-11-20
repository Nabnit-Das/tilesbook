import {createHmac,timingSafeEqual} from 'node:crypto';
import {cookies} from 'next/headers';
import {db} from './db';

function sign(value: string) {
  const key = process.env.SESSION_SECRET;
  if (!key || key.length < 32) throw new Error('Configure SESSION_SECRET with at least 32 characters.');
  return createHmac('sha256',key).update(value).digest('hex');
}
export async function setSession(userId: string,businessId: string) {
  const payload = [userId,businessId,Date.now()+43200000].join('.');
  (await cookies()).set('tilebook',payload+'.'+sign(payload),{httpOnly:true,sameSite:'lax',secure:process.env.SESSION_COOKIE_SECURE === 'true',path:'/',maxAge:43200});
}
export async function session() {
  const value = (await cookies()).get('tilebook')?.value;
  if (!value) return null;
  const [userId,businessId,expiry,signature,...extra] = value.split('.');
  if (!signature || extra.length || Number(expiry) <= Date.now() || !Number.isFinite(Number(expiry))) return null;
  const expected = sign([userId,businessId,expiry].join('.'));
  if (!/^[a-f0-9]{64}$/.test(signature) || !timingSafeEqual(Buffer.from(signature),Buffer.from(expected))) return null;
  return db.membership.findUnique({where:{businessId_userId:{businessId,userId}},include:{business:true,user:true}});
}