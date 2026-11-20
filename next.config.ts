import type {NextConfig} from 'next';
const config:NextConfig={serverExternalPackages:['pdfkit','@prisma/client'],poweredByHeader:false,agentRules:false,experimental:{cpus:1,staticGenerationMaxConcurrency:1}};
export default config;

