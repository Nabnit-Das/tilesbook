import type {Pending} from './offline';
/** When reconnecting, attach previously deferred images before replaying the accounting operation. */
export async function prepareQueuedMedia(item:Pending){const photo=item.data.photo;
 if(typeof photo!=='string'||!photo.startsWith('data:image/jpeg;base64,'))return item;
 const {saveShopPhoto}=await import('./photo');const url=await saveShopPhoto(item.businessId,item.resource,photo);
 return {...item,data:{...item.data,photo:url}};
}