import {spawnSync} from 'node:child_process';
export function exec(name,args=[],options={}){
 const bin=process.platform==='win32' && ['npx','npm'].includes(name)?name+'.cmd':name;
 const result=spawnSync(bin,args,{stdio:'inherit',shell:process.platform==='win32'&&bin.endsWith('.cmd'),...options});
 if(result.error || result.status!==0)throw new Error([name,...args].join(' ')+' failed ('+(result.error?.message??result.status)+')');
 return result;
}