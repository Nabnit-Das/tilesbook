import type { NextConfig } from 'next';
const config: NextConfig = { devIndicators: false, outputFileTracingIncludes: { '/api/print/*': ['./node_modules/@fontsource/noto-sans*/files/*'], '/api/reports/*': ['./node_modules/@fontsource/noto-sans*/files/*'], '/api/data': ['./supabase/**/*.sql'] }, serverExternalPackages: ['@electric-sql/pglite','playwright','playwright-core'] };
export default config;
