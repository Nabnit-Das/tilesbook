import type {Metadata} from 'next';
import './style.css';
export const metadata: Metadata={title:'TileBook | Billing & Inventory',description:'Billing and inventory for tile and marble dealers.',manifest:'/manifest.webmanifest'};
export default function Layout({children}:{children:React.ReactNode}) {
  return <html lang="en"><body>{children}</body></html>;
}