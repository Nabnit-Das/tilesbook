'use client';
import Dexie,{type Table} from 'dexie';
import type {Snapshot} from '@/types/database';
export interface Pending {requestId:string;userId:string;businessId:string;resource:string;data:Record<string,unknown>;action:string;time:number}
class LocalBook extends Dexie{
 snapshots!:Table<{key:string;book:Snapshot},string>;
 queue!:Table<Pending,string>;
 constructor(){super('tilebook-v1');this.version(1).stores({snapshots:'key',queue:'requestId,[userId+businessId],time'});}
}
export const localBook=new LocalBook();
export async function clearLocalBooks(){await localBook.snapshots.clear();localStorage.removeItem('tb-active');localStorage.removeItem('tb-firm');}
