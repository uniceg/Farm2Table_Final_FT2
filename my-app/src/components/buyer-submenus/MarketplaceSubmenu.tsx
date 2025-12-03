"use client";
import { Beef, Carrot, Egg, Fish, Gem, Gift, Package, Wheat } from "lucide-react";
import { createContext, useContext, useState } from "react";
import SubmenuSidebar from "../layouts/SubmenuSidebar";

const CategoryContext = createContext<{
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
}>({
  selectedCategory: "all",
  setSelectedCategory: () => {},
});

export function useCategory() {
  return useContext(CategoryContext);
}

interface MarketplaceSubmenuProps {
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function MarketplaceSubmenu({ 
  isMobileOpen = false, 
  onMobileClose 
}: MarketplaceSubmenuProps) {
  // Simple state - no URL params
  const [selectedCategory, setSelectedCategory] = useState("all");

  const items = [
    { category: "all", label: "All Products", icon: Package },
    { category: "fresh-produce", label: "Fresh Produce", icon: Carrot },
    { category: "dairy-eggs", label: "Dairy & Eggs", icon: Egg },
    { category: "grains-staples", label: "Grains & Staples", icon: Wheat },
    { category: "livestock-poultry", label: "Livestock & Poultry", icon: Beef },
    { category: "fishery", label: "Fishery", icon: Fish },
    { category: "specialty-products", label: "Specialty Products", icon: Gem },
    { category: "value-added-goods", label: "Value-added Goods", icon: Gift },
  ];

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    
    if (onMobileClose) {
      onMobileClose();
    }
  };

  return (
    <CategoryContext.Provider value={{ selectedCategory, setSelectedCategory }}>
      <SubmenuSidebar 
        title="Marketplace"
        items={items.map(item => ({
          href: "#", // Remove URL dependency
          label: item.label,
          icon: item.icon,
          category: item.category
        }))}
        selectedCategory={selectedCategory}
        onCategoryChange={handleCategoryChange}
        type="category"
        isMobileOpen={isMobileOpen}
        onMobileClose={onMobileClose}
      />
    </CategoryContext.Provider>
  );
}