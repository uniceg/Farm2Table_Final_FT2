"use client";
import { usePathname } from "next/navigation";
import BuyerLayout from "../../components/layouts/BuyerLayout";
import DashboardSubmenu from "../../components/buyer-submenus/DashboardSubmenu";
import MarketplaceSubmenu from "../../components/buyer-submenus/MarketplaceSubmenu";
import ProfileSubmenu from "../../components/buyer-submenus/ProfileSubmenu";
import { CartProvider } from "../context/CartContext";

export default function RootBuyerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const renderSubmenu = () => {
    if (pathname?.startsWith("/buyer/dashboard")) {
      return <DashboardSubmenu />;
    }
    
    if (pathname?.startsWith("/buyer/marketplace")) {
      return <MarketplaceSubmenu />;
    }
    
    if (pathname?.startsWith("/buyer/profile")) {
      return <ProfileSubmenu />;
    }
    
    return null;
  };

  const currentSubmenu = renderSubmenu();

  return (
    <CartProvider>
      {/* Remove onLogoutClick prop since BuyerLayout handles its own logout */}
      <BuyerLayout> 
        {currentSubmenu}
        {children}
      </BuyerLayout>
    </CartProvider>
  );
}