export async function saveShopPhoto(firm:string,kind:string,jpeg:string){
 if(!navigator.onLine)return jpeg;
 const bucket=kind==='purchaseBills'?'purchase-bills':kind==='damage'?'damage-photos':kind==='slabs'?'vein-match-photos':'lot-photos';
 const url='/api/media/'+bucket+'/'+encodeURIComponent(firm)+'/'+crypto.randomUUID()+'.jpg';
 const data=await (await fetch(jpeg)).blob();const response=await fetch(url,{method:'POST',headers:{'Content-Type':'image/jpeg'},body:data});
 if(!response.ok)throw new Error('Photo upload failed');return url;
}
export async function captureEvidence(firm:string,kind:string,file:File){
 const image=await createImageBitmap(file);
 try{const scale=Math.min(1,(kind==="purchaseBills"?1500:700)/Math.max(image.width,image.height));const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));const context=canvas.getContext("2d");if(!context)throw Error("Photo unavailable");context.drawImage(image,0,0,canvas.width,canvas.height);return await saveShopPhoto(firm,kind,canvas.toDataURL("image/jpeg",.68))}
 finally{image.close()}
}
export function readablePhoto(value:unknown){return typeof value==="string"&&(/^data:image\/(jpeg|png);base64,/.test(value)||/^\/api\/media\/[a-z-]+\/[a-f\d-]+\/[a-f\d-]+\.jpg$/.test(value))?value:""}
