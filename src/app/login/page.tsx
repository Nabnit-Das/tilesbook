import {localRequest,identity} from '@/server/identity';
import {smsAvailable} from '@/server/auth-policy';
import {redirect} from 'next/navigation';
import Login from '@/components/Login';
export const dynamic='force-dynamic';
export default async function Page(){if(await identity().catch(()=>null))redirect('/access');return <Login demo={await localRequest()} sms={smsAvailable()} phoneFirst={process.env.TILEBOOK_TEST_SMS==='1'}/>;}
