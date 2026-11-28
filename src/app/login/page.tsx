import {localRequest,identity} from '@/server/identity';
import {redirect} from 'next/navigation';
import Login from '@/components/Login';
export const dynamic='force-dynamic';
export default async function Page(){if(await identity().catch(()=>null))redirect('/access');const demo=await localRequest(); return <Login customerStep={demo?undefined:'login'} demo={demo}/>;}