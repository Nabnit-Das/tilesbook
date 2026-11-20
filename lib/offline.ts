import Dexie,{type Table} from 'dexie';
import type {Data,Row} from './records';
type QueueItem={key:string;businessId:string;userId:string;kind:string;data:Data};
export type Viewer={business:{id:string;name:string;state:string};role:string;name:string;firms:{id:string;name:string;state:string}[];userId:string};
type Snapshot={id:string;viewer:Viewer;rows:Row[]};
class TileBookOffline extends Dexie {
  queue!:Table<QueueItem,string>;
  snapshots!:Table<Snapshot,string>;
  constructor(){
    super('tilebook-offline');
    this.version(1).stores({queue:'key,businessId',snapshots:'id'});
  }
}
export const offline=new TileBookOffline();
export async function syncQueue(viewer:Viewer) {
  const pending=await offline.queue.where('businessId').equals(viewer.business.id).toArray();
  for(const item of pending){
    if(item.userId!==viewer.userId)continue;
    const response=await fetch('/api/records',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(item)});
    if(!response.ok)throw new Error((await response.json().catch(()=>null))?.error??'Offline entry could not sync.');
    await offline.queue.delete(item.key);
  }
}