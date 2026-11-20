import next from 'eslint-config-next/core-web-vitals';
const config = [...next,{ignores:['.next/**','next-env.d.ts','work/**','outputs/**']}];
export default config;
