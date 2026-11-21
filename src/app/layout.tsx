import './globals.css';
import '@fontsource/dm-sans/latin-400.css';import '@fontsource/dm-sans/latin-500.css';import '@fontsource/dm-sans/latin-600.css';import '@fontsource/dm-sans/latin-700.css';
import type {Metadata,Viewport} from 'next';import {Locale} from '@/components/Locale';
export const metadata:Metadata={title:{default:'TileBook',template:'%s · TileBook'},description:'GST billing, stock and accounts for tile and marble dealers.',manifest:'/manifest.webmanifest',icons:{icon:'/icons/icon-192.png'}};
export const viewport:Viewport={width:'device-width',initialScale:1,themeColor:'#14183f'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><Locale>{children}</Locale></body></html>;}