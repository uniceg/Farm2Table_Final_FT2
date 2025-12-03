"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCategory } from "../../../components/buyer-submenus/MarketplaceSubmenu";
import ProductCard from "../../../components/ui/ProductCard";
import CartSidebar from "../../../components/cart/CartSidebar";
import OrderSuccessModal from "../../../components/auth/modals/OrderModal/OrderSuccessModal";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";
import styles from "./marketplace.module.css";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { db } from "../../../utils/lib/firebase";
import { updateStock } from "../../../utils/lib/productService";

import type { Product as ProductServiceType } from "../../../utils/lib/productService";

interface UserLocation {
  lat: number;
  lng: number;
}

interface Farmer {
  location?: UserLocation;
  barangay?: string;
  displayName?: string;
  fullName?: string;
}

interface MarketplaceProduct extends Omit<ProductServiceType, 'price' | 'imageUrls'> {
  price?: number;
  displayPrice?: string;
  category?: string;
  status?: string;
  farmName?: string;
  description?: string;
  imageUrls?: string[];
  image?: string;
  sold?: number;
  quantity_available?: number;
  stock?: number;
  deliveryFee?: number;
  deliveryTime?: string;
  sellerId?: string;
  farmer_id?: string;
  farmerBarangay?: string;
  minimumOrderQuantity?: number;
  farmer?: Farmer;
  reviews?: any[];
  reviewsCount?: number;
  rating?: number;
  createdAt?: any;
  smartScore?: number;
  matchReason?: string;
  isSmartMatch?: boolean;
  distance?: number;
}

interface UserProfile {
  fullName?: string;
  contact?: string;
  address?: {
    city?: string;
    houseNo?: string;
    streetName?: string;
    barangay?: string;
    province?: string;
    postalCode?: string;
    location?: UserLocation;
  };
  deliveryAddress?: {
    city?: string;
    houseNo?: string;
    streetName?: string;
    barangay?: string;
    province?: string;
    postalCode?: string;
    location?: UserLocation;
  };
}

interface Seller {
  id: string;
  address?: {
    city?: string;
    barangay?: string;
    location?: UserLocation;
  };
  fullName?: string;
  displayName?: string;
}

const SMART_MATCHING_WEIGHTS = {
  proximity: 0.4,
  price: 0.3,
  demand: 0.2,
  rating: 0.1,
};

const SMART_THRESHOLDS = {
  maxDistance: 50,
  priceVariation: 0.3,
  minRating: 3.0,
};

const calculateProximityScore = (distance: number, maxDistance: number = 50): number => {
  if (distance > maxDistance) return 0;
  return Math.max(0, 1 - (distance / maxDistance));
};

const calculatePriceScore = (productPrice: number, avgCategoryPrice: number): number => {
  if (!avgCategoryPrice || avgCategoryPrice === 0) return 0.5;
  
  const priceRatio = productPrice / avgCategoryPrice;
  if (priceRatio < 0.7) return 0.7;
  if (priceRatio > 1.3) return 0.3;
  return 1 - (priceRatio - 0.7) / 0.6;
};

const calculateDemandScore = (soldCount: number, stock: number): number => {
  if (stock === 0) return 0;
  const sellThroughRate = soldCount / (soldCount + stock);
  return Math.min(1, sellThroughRate * 2);
};

const calculateRatingScore = (rating: number): number => {
  return rating / 5;
};

const getMatchReason = (scores: { proximity: number; price: number; demand: number; rating: number }): string => {
  const maxScore = Math.max(...Object.values(scores));
  if (maxScore === scores.proximity) return "Near your location";
  if (maxScore === scores.price) return "Great value";
  if (maxScore === scores.demand) return "Popular choice";
  if (maxScore === scores.rating) return "Highly rated";
  return "Well-balanced match";
};

export default function MarketplacePage() {
  const categoryContext = useCategory();
  const selectedCategory = categoryContext?.selectedCategory || "all";
  
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("smart");
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [locationFilteredProducts, setLocationFilteredProducts] = useState<MarketplaceProduct[]>([]);
  const [locationLoading, setLocationLoading] = useState(true);
  const [categoryAverages, setCategoryAverages] = useState<{[key: string]: number}>({});
  
  const [showMOQModal, setShowMOQModal] = useState(false);
  const [moqProduct, setMoqProduct] = useState<MarketplaceProduct | null>(null);
  const [moqError, setMoqError] = useState("");
  
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [orderSuccessData, setOrderSuccessData] = useState<any>(null);
  
  const sortRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { user, userProfile, loading: authLoading } = useAuth() as { 
    user: any; 
    userProfile: UserProfile; 
    loading: boolean 
  };
  
  const {
    cartItems,
    isCartOpen,
    addToCart,
    removeFromCart,
    updateQuantity,
    updateNotes,
    closeCart,
    clearCart,
  } = useCart();

  const currentUserLocation = useMemo((): UserLocation | null => {
    if (!userProfile) return null;
    
    const location = userProfile.address?.location || userProfile.deliveryAddress?.location;
    if (location?.lat && location?.lng) {
      return location;
    }
    
    return null;
  }, [userProfile]);

  const validateMOQ = (product: MarketplaceProduct, quantity: number = 1): { isValid: boolean; message: string } => {
    const moq = product.minimumOrderQuantity || 1;
    
    if (quantity < moq) {
      return {
        isValid: false,
        message: `Minimum order quantity for ${product.name} is ${moq} ${product.unit || 'unit'}. Please add at least ${moq} to your cart.`
      };
    }
    
    if (product.stock && quantity > product.stock) {
      return {
        isValid: false,
        message: `Only ${product.stock} ${product.unit || 'units'} available in stock.`
      };
    }
    
    return {
      isValid: true,
      message: `Quantity meets minimum order requirement.`
    };
  };

  const handleMOQModal = (product: MarketplaceProduct) => {
    setMoqProduct(product);
    setMoqError("");
    setShowMOQModal(true);
  };

  const handleMOQAddToCart = (quantity: number) => {
    if (!moqProduct) return;
    
    const validation = validateMOQ(moqProduct, quantity);
    if (!validation.isValid) {
      setMoqError(validation.message);
      return;
    }
    
    const productWithFarmerData = {
      ...moqProduct,
      farmer: moqProduct.farmer || {
        location: moqProduct.farmer?.location,
        barangay: moqProduct.farmerBarangay,
        displayName: moqProduct.farmName,
        fullName: moqProduct.farmName
      }
    };
    
    addToCart(productWithFarmerData, quantity);
    setShowMOQModal(false);
    setMoqProduct(null);
    setMoqError("");
  };

  useEffect(() => {
    if (showMOQModal && moqProduct) {
      const input = document.getElementById('moqQuantityInput') as HTMLInputElement;
      const priceDisplay = document.querySelector(`.${styles.priceAmount}`);
      
      const updatePrice = () => {
        if (input && priceDisplay && moqProduct) {
          const quantity = parseInt(input.value) || (moqProduct.minimumOrderQuantity || 1);
          const total = (moqProduct.price || 0) * quantity;
          priceDisplay.textContent = `₱${total.toFixed(2)}`;
          
          // Validate as user types
          const validation = validateMOQ(moqProduct, quantity);
          setMoqError(validation.isValid ? "" : validation.message);
        }
      };
      
      if (input) {
        input.addEventListener('input', updatePrice);
        updatePrice();
        
        return () => input.removeEventListener('input', updatePrice);
      }
    }
  }, [showMOQModal, moqProduct]);

  const handleOrderSuccess = (orderData: any) => {
    setOrderSuccessData({
      id: orderData.id,
      orderNumber: orderData.orderNumber,
      totalPrice: orderData.totalPrice,
      deliveryMethod: orderData.deliveryMethod,
      deliveryTime: orderData.deliveryTime,
      deliveryDate: orderData.deliveryDate,
      itemCount: orderData.itemCount,
      paymentMethod: orderData.paymentMethod,
      status: orderData.status || 'pending'
    });
    
    setShowSuccessModal(true);
    clearCart();
    closeCart();
  };

  useEffect(() => {
    if (orderSuccessData) {
      console.log("🔍 DEBUG - orderSuccessData state:", orderSuccessData);
    }
  }, [orderSuccessData]);

  const handleCloseSuccessModal = () => {
    setShowSuccessModal(false);
    setOrderSuccessData(null);
  };

  const handleCloseMOQModal = () => {
    setShowMOQModal(false);
    setMoqProduct(null);
    setMoqError("");
  };

  const fetchProductReviews = async (productId: string) => {
    try {
      const reviewsQuery = query(
        collection(db, "reviews"),
        where("productId", "==", productId),
        where("isActive", "==", true),
        orderBy("createdAt", "desc")
      );
      
      const reviewsSnapshot = await getDocs(reviewsQuery);
      return reviewsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error("Error fetching reviews:", error);
      return [];
    }
  };

  const calculateCategoryAverages = async (productsData: MarketplaceProduct[]) => {
    const categoryTotals: {[key: string]: { sum: number; count: number }} = {};
    
    productsData.forEach(product => {
      if (product.category && product.price) {
        if (!categoryTotals[product.category]) {
          categoryTotals[product.category] = { sum: 0, count: 0 };
        }
        categoryTotals[product.category].sum += product.price;
        categoryTotals[product.category].count += 1;
      }
    });
    
    const averages: {[key: string]: number} = {};
    Object.keys(categoryTotals).forEach(category => {
      averages[category] = categoryTotals[category].sum / categoryTotals[category].count;
    });
    
    setCategoryAverages(averages);
    return averages;
  };

  const applySmartMatching = (
    products: MarketplaceProduct[], 
    userLocation: UserLocation | null, 
    categoryAverages: {[key: string]: number}
  ): MarketplaceProduct[] => {
    if (!userLocation) return products;
    
    return products.map(product => {
      let proximityScore = 0.5;
      let distance = 0;
      
      if (product.farmer?.location) {
        try {
          const R = 6371;
          const dLat = (product.farmer.location.lat - userLocation.lat) * Math.PI / 180;
          const dLon = (product.farmer.location.lng - userLocation.lng) * Math.PI / 180;
          const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(userLocation.lat * Math.PI / 180) * 
            Math.cos(product.farmer.location.lat * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          distance = R * c;
          
          proximityScore = calculateProximityScore(distance, SMART_THRESHOLDS.maxDistance);
        } catch (error) {
          console.error("Error calculating distance:", error);
        }
      }
      
      const priceScore = calculatePriceScore(product.price || 0, categoryAverages[product.category || ''] || 0);
      const demandScore = calculateDemandScore(product.sold || 0, product.stock || 0);
      const ratingScore = calculateRatingScore(product.rating || 0);
      
      const smartScore = 
        proximityScore * SMART_MATCHING_WEIGHTS.proximity +
        priceScore * SMART_MATCHING_WEIGHTS.price +
        demandScore * SMART_MATCHING_WEIGHTS.demand +
        ratingScore * SMART_MATCHING_WEIGHTS.rating;
      
      const matchReason = getMatchReason({ 
        proximity: proximityScore, 
        price: priceScore, 
        demand: demandScore, 
        rating: ratingScore 
      });
      
      return {
        ...product,
        smartScore,
        matchReason,
        isSmartMatch: smartScore > 0.6,
        distance: distance > 0 ? parseFloat(distance.toFixed(1)) : undefined
      };
    });
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(event.target as Node)) {
        setIsSortOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchProductsWithSmartMatching = async () => {
      try {
        setLocationLoading(true);
        
        const querySnapshot = await getDocs(collection(db, "products"));
        const productsData: MarketplaceProduct[] = await Promise.all(
          querySnapshot.docs.map(async (doc) => {
            const productData = {
              id: doc.id,
              ...doc.data(),
            } as MarketplaceProduct;
            try {
              const reviews = await fetchProductReviews(doc.id);
              const averageRating = reviews.length > 0 
                ? reviews.reduce((sum: number, review: any) => sum + (review.rating || 0), 0) / reviews.length
                : 0;
              return {
                ...productData,
                reviews: reviews,
                reviewsCount: reviews.length,
                rating: parseFloat(averageRating.toFixed(1)),
              } as MarketplaceProduct;
            } catch (reviewError) {
              console.error(`Error fetching reviews for product ${doc.id}:`, reviewError);
              return {
                ...productData,
                reviews: [],
                reviewsCount: 0,
                rating: 0,
              } as MarketplaceProduct;
            }
          })
        );
        const averages = await calculateCategoryAverages(productsData);
        if (!user || !userProfile) {
          setProducts(productsData);
          setLocationFilteredProducts(productsData);
          return;
        }
        const buyerCity = userProfile.address?.city || userProfile.deliveryAddress?.city;
        if (!buyerCity) {
          setProducts(productsData);
          setLocationFilteredProducts(productsData);
          return;
        }
        const sellersQuery = await getDocs(collection(db, "sellers"));
        const sellersData: Seller[] = sellersQuery.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        const sellerDataMap: { [sellerId: string]: Seller } = {};
        sellersData.forEach(seller => {
          sellerDataMap[seller.id] = seller;
        });
        const sameCityProducts = productsData.filter(product => {
          const sellerId = product.sellerId || product.farmer_id;
          if (!sellerId) return false;
          const sellerData = sellerDataMap[sellerId];
          if (!sellerData) return false;
          const sellerCity = sellerData.address?.city;
          if (!sellerCity) return false;
          return sellerCity === buyerCity;
        });
        const productsWithFarmerData = sameCityProducts.map(product => {
          const sellerId = product.sellerId || product.farmer_id;
          const sellerData = sellerDataMap[sellerId];
          
          if (sellerData) {
            return {
              ...product,
              farmer: {
                location: sellerData.address?.location,
                barangay: sellerData.address?.barangay || product.farmerBarangay,
                displayName: product.farmName,
                fullName: sellerData.fullName || product.farmName
              },
              farmerBarangay: sellerData.address?.barangay || product.farmerBarangay
            };
          }
          
          return product;
        });
        const smartMatchedProducts = applySmartMatching(
          productsWithFarmerData, 
          currentUserLocation, 
          averages
        );
        setProducts(productsData);
        setLocationFilteredProducts(smartMatchedProducts);
      } catch (error) {
        console.error("Error fetching products with smart matching:", error);
        const querySnapshot = await getDocs(collection(db, "products"));
        const productList: MarketplaceProduct[] = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          reviews: [],
          reviewsCount: 0,
          rating: 0,
        } as MarketplaceProduct));
        setProducts(productList);
        setLocationFilteredProducts(productList);
      } finally {
        setLoading(false);
        setLocationLoading(false);
      }
    };
    fetchProductsWithSmartMatching();
  }, [user, userProfile, currentUserLocation]);

  const filteredProducts = useMemo(() => {
    const filtered = locationFilteredProducts
      .filter((product) => {
        const matchesSearch =
          product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          product.farmName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          product.description?.toLowerCase().includes(searchTerm.toLowerCase());
        
        let matchesCategory = true;
        if (selectedCategory !== "all") {
          matchesCategory = product.category === selectedCategory;
        }
        
        const isActive = product.status ? product.status === "active" : true;
        return matchesSearch && matchesCategory && isActive;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "smart":
            return (b.smartScore || 0) - (a.smartScore || 0);
          case "proximity":
            if (a.distance !== undefined && b.distance !== undefined) {
              return a.distance - b.distance;
            }
            return (a.farmName || "").localeCompare(b.farmName || "");
          case "price":
            return (a.price || 0) - (b.price || 0);
          case "stock":
            return (b.stock || 0) - (a.stock || 0);
          case "rating":
            return (b.rating || 0) - (a.rating || 0);
          default:
            return (b.smartScore || 0) - (a.smartScore || 0);
        }
      });
    return filtered;
  }, [locationFilteredProducts, selectedCategory, searchTerm, sortBy]);

  const formatProductForCard = (product: MarketplaceProduct) => {
    const checkIfNew = () => {
      if (!product.createdAt) return false;
      
      try {
        let productDate: Date;
        
        if (product.createdAt && (product.createdAt as any).toDate) {
          productDate = (product.createdAt as any).toDate();
        } else if (product.createdAt && (product.createdAt as any).seconds) {
          productDate = new Date((product.createdAt as any).seconds * 1000);
        } else {
          productDate = new Date(product.createdAt as any);
        }
        
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        
        return productDate >= oneWeekAgo;
      } catch (error) {
        console.error("Error checking if product is new:", error);
        return false;
      }
    };
    return {
      ...product,
      image: product.imageUrls?.[0] || product.image || "",
      displayPrice: product.price?.toString() || "0",
      price: product.price,
      sold: product.sold || 0,
      stock: product.quantity_available || product.stock || 0,
      rating: product.rating || 0,
      reviews: product.reviewsCount || 0,
      isNew: checkIfNew(),
      deliveryFee: product.deliveryFee || 0,
      deliveryTime: product.deliveryTime || "15-45 min",
      farmerBarangay: product.farmerBarangay,
      farmer: product.farmer || {
        location: product.farmer?.location,
        barangay: product.farmerBarangay,
        displayName: product.farmName,
        fullName: product.farmName
      },
      smartScore: product.smartScore,
      matchReason: product.matchReason,
      isSmartMatch: product.isSmartMatch,
      minimumOrderQuantity: product.minimumOrderQuantity || 1
    };
  };

  const handleAddToCart = async (product: MarketplaceProduct) => {
    const moq = product.minimumOrderQuantity || 1;
    
    if (moq > 1) {
      handleMOQModal(product);
      return;
    }
    
    const productWithFarmerData = {
      ...product,
      farmer: product.farmer || {
        location: product.farmer?.location,
        barangay: product.farmerBarangay,
        displayName: product.farmName,
        fullName: product.farmName
      }
    };
    
    addToCart(productWithFarmerData);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  };

  const handleSaveItem = (product: MarketplaceProduct) => {
    console.log("Saving item:", product.name);
  };

  const handleViewDetails = (product: MarketplaceProduct) => {
    console.log("Viewing details:", product.name);
    router.push(`/buyer/marketplace/${product.id}`);
  };

  const handleSortSelect = (value: string) => {
    setSortBy(value);
    setIsSortOpen(false);
  };

  const getSelectedSortLabel = () => {
    const options = [
      { value: "smart", label: "Smart Match" },
      { value: "proximity", label: "Nearest" },
      { value: "price", label: "Lowest Price" },
      { value: "stock", label: "Highest Stock" },
      { value: "rating", label: "Highest Rating" }
    ];
    const selected = options.find(opt => opt.value === sortBy);
    return (
      <div className={styles.sortLabel}>
        <span>{selected?.label}</span>
      </div>
    );
  };

  const handlePlaceOrder = async (orderData: any) => {
    if (!user) {
      alert("Please log in to place an order");
      return;
    }
    
    setIsPlacingOrder(true);
    try {
      const sellerOrders = orderData.ordersBySeller || orderData.sellers || [];
      
      for (const sellerOrder of sellerOrders) {
        for (const item of sellerOrder.items || []) {
          const productId = item.productId || item.id;
          if (!productId) continue;
          
          const productRef = doc(db, "products", productId);
          const productSnap = await getDoc(productRef);
          if (productSnap.exists()) {
            const currentStock =
              productSnap.data().quantity_available ??
              productSnap.data().stock ??
              0;
            const newStock = Math.max(currentStock - item.quantity, 0);
            await updateStock(productId, newStock);
          }
        }
      }
      
      clearCart();
      closeCart();
      
      console.log("✅ Order placed successfully!");
      
    } catch (error) {
      console.error("❌ Error in post-order cleanup:", error);
      alert("Order was placed, but there was an error updating inventory.");
    } finally {
      setIsPlacingOrder(false);
    }
  };

  if (authLoading || locationLoading) {
    return (
      <div className={styles.emptyState}>
        <p>Checking authentication and location...</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.emptyState}>
        <p>Loading products...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header - Removed the subtitle */}
      <div className={styles.header}>
        <h1 className={styles.title}>Marketplace</h1>
      </div>

      {/* Search and Filter Controls */}
      <div className={styles.controls}>
        <div className={styles.searchContainer}>
          <Search size={20} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search products, farms, or descriptions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </div>
        <div className={styles.filterControls}>
          <div className={styles.dropdownContainer} ref={sortRef}>
            <button 
              className={`${styles.dropdownButton} ${sortBy !== "smart" ? styles.active : styles.smartActive}`}
              onClick={() => setIsSortOpen(!isSortOpen)}
            >
              {getSelectedSortLabel()}
              <span className={`${styles.arrow} ${isSortOpen ? styles.arrowUp : styles.arrowDown}`}></span>
            </button>
            
            {isSortOpen && (
              <div className={styles.dropdownList}>
                <button
                  className={`${styles.dropdownItem} ${sortBy === "smart" ? styles.selected : ''}`}
                  onClick={() => handleSortSelect("smart")}
                >
                  <span>Smart Match</span>
                </button>
                <button
                  className={`${styles.dropdownItem} ${sortBy === "proximity" ? styles.selected : ''}`}
                  onClick={() => handleSortSelect("proximity")}
                >
                  <span>Nearest</span>
                </button>
                <button
                  className={`${styles.dropdownItem} ${sortBy === "price" ? styles.selected : ''}`}
                  onClick={() => handleSortSelect("price")}
                >
                  <span>Lowest Price</span>
                </button>
                <button
                  className={`${styles.dropdownItem} ${sortBy === "stock" ? styles.selected : ''}`}
                  onClick={() => handleSortSelect("stock")}
                >
                  <span>Highest Stock</span>
                </button>
                <button
                  className={`${styles.dropdownItem} ${sortBy === "rating" ? styles.selected : ''}`}
                  onClick={() => handleSortSelect("rating")}
                >
                  <span>Highest Rating</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {filteredProducts.length === 0 ? (
        <div className={styles.emptyState}>
          <p>No products found matching your criteria.</p>
          <p>Try adjusting your search or filters.</p>
        </div>
      ) : (
        <div className={styles.productsContainer}>
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={formatProductForCard(product)}
              onAddToCart={handleAddToCart}
              onSaveItem={handleSaveItem}
              onViewDetails={handleViewDetails}
              showNewTag={true}
              currentUserLocation={currentUserLocation}
            />
          ))}
        </div>
      )}

      {/* MOQ Modal */}
      {showMOQModal && moqProduct && (
        <div className={styles.modalOverlay}>
          <div className={styles.moqModal}>
            <div className={styles.moqModalHeader}>
              <div className={styles.moqIconContainer}>
                <div className={styles.moqIcon}>📦</div>
              </div>
              <div className={styles.moqTitleSection}>
                <h3 className={styles.moqTitle}>Minimum Order Required</h3>
                <p className={styles.moqSubtitle}>{moqProduct.name}</p>
              </div>
              <button onClick={handleCloseMOQModal} className={styles.closeButton}>
                ×
              </button>
            </div>
            
            <div className={styles.moqModalContent}>
              <div className={styles.moqAlert}>
                <div className={styles.moqAlertIcon}>ℹ️</div>
                <div className={styles.moqAlertText}>
                  <strong>Minimum order:</strong> {moqProduct.minimumOrderQuantity} {moqProduct.unit || 'unit'}
                  {moqProduct.minimumOrderQuantity! > 1 ? 's' : ''}
                </div>
              </div>
              
              <div className={styles.moqOptions}>
                <div className={styles.moqOptionCard}>
                  <div className={styles.moqOptionHeader}>
                    <span className={styles.moqOptionLabel}>Quick Add</span>
                    <span className={styles.moqOptionBadge}>Recommended</span>
                  </div>
                  <div className={styles.moqOptionContent}>
                    <div className={styles.moqOptionQuantity}>
                      <span className={styles.moqOptionNumber}>{moqProduct.minimumOrderQuantity}</span>
                      <span className={styles.moqOptionUnit}>{moqProduct.unit || 'units'}</span>
                    </div>
                    <div className={styles.moqOptionPrice}>
                      ₱{((moqProduct.price || 0) * (moqProduct.minimumOrderQuantity || 1)).toFixed(2)}
                    </div>
                    <button 
                      onClick={() => handleMOQAddToCart(moqProduct.minimumOrderQuantity || 1)}
                      className={styles.moqOptionButton}
                    >
                      Add to Cart
                    </button>
                  </div>
                </div>
                
                <div className={styles.moqOptionDivider}>
                  <span>OR</span>
                </div>
                
                <div className={styles.moqOptionCard}>
                  <div className={styles.moqOptionHeader}>
                    <span className={styles.moqOptionLabel}>Custom Quantity</span>
                  </div>
                  <div className={styles.moqOptionContent}>
                    <div className={styles.quantityControls}>
                      <button 
                        className={styles.quantityBtn}
                        onClick={() => {
                          const input = document.getElementById('moqQuantityInput') as HTMLInputElement;
                          const current = parseInt(input.value) || (moqProduct.minimumOrderQuantity || 1);
                          if (current > (moqProduct.minimumOrderQuantity || 1)) {
                            input.value = (current - 1).toString();
                          }
                        }}
                        disabled={!!moqError}
                      >
                        −
                      </button>
                      
                      <div className={styles.quantityInputWrapper}>
                        <input
                          type="number"
                          id="moqQuantityInput"
                          min={moqProduct.minimumOrderQuantity || 1}
                          max={moqProduct.stock || 100}
                          defaultValue={moqProduct.minimumOrderQuantity || 1}
                          className={styles.quantityInput}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || (moqProduct.minimumOrderQuantity || 1);
                            const validation = validateMOQ(moqProduct, value);
                            setMoqError(validation.isValid ? "" : validation.message);
                          }}
                        />
                        <span className={styles.quantityUnit}>{moqProduct.unit || 'units'}</span>
                      </div>
                      
                      <button 
                        className={styles.quantityBtn}
                        onClick={() => {
                          const input = document.getElementById('moqQuantityInput') as HTMLInputElement;
                          const current = parseInt(input.value) || (moqProduct.minimumOrderQuantity || 1);
                          const max = moqProduct.stock || 100;
                          if (current < max) {
                            input.value = (current + 1).toString();
                          }
                        }}
                        disabled={!!moqError}
                      >
                        +
                      </button>
                    </div>
                    
                    <div className={styles.customPrice}>
                      Total: <span className={styles.priceAmount}>₱0.00</span>
                      <span className={styles.priceNote}>Calculated as you type</span>
                    </div>
                    
                    <button 
                      onClick={() => {
                        const input = document.getElementById('moqQuantityInput') as HTMLInputElement;
                        const quantity = parseInt(input.value) || (moqProduct.minimumOrderQuantity || 1);
                        handleMOQAddToCart(quantity);
                      }}
                      className={`${styles.moqOptionButton} ${styles.customButton}`}
                      disabled={!!moqError}
                    >
                      Add {moqError ? "Valid Quantity" : "Custom Amount"}
                    </button>
                  </div>
                </div>
              </div>
              
              <div className={styles.moqInfo}>
                <div className={styles.moqInfoItem}>
                  <span className={styles.moqInfoLabel}>Available Stock:</span>
                  <span className={styles.moqInfoValue}>{moqProduct.stock || 100} {moqProduct.unit || 'units'}</span>
                </div>
                <div className={styles.moqInfoItem}>
                  <span className={styles.moqInfoLabel}>Unit Price:</span>
                  <span className={styles.moqInfoValue}>₱{(moqProduct.price || 0).toFixed(2)}/{moqProduct.unit || 'unit'}</span>
                </div>
              </div>
              
              {moqError && (
                <div className={styles.moqError}>
                  <div className={styles.errorIcon}>⚠️</div>
                  <div className={styles.errorText}>{moqError}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <CartSidebar
        isOpen={isCartOpen}
        onClose={closeCart}
        cartItems={cartItems}
        onUpdateQuantity={updateQuantity}
        onRemoveItem={removeFromCart}
        onUpdateNotes={updateNotes}
        onPlaceOrder={handlePlaceOrder}
        onOrderSuccess={handleOrderSuccess}
        buyerInfo={{
          id: user?.uid || "",
          name: userProfile?.fullName || user?.displayName || user?.email?.split('@')[0] || "Customer",
          address: userProfile?.address
            ? [
                userProfile.address.houseNo,
                userProfile.address.streetName,
                userProfile.address.barangay,
                userProfile.address.city,
                userProfile.address.province,
                userProfile.address.postalCode,
              ]
                .filter(Boolean)
                .join(", ")
            : userProfile?.deliveryAddress 
            ? [
                userProfile.deliveryAddress.houseNo,
                userProfile.deliveryAddress.streetName,
                userProfile.deliveryAddress.barangay,
                userProfile.deliveryAddress.city,
                userProfile.deliveryAddress.province,
                userProfile.deliveryAddress.postalCode,
              ]
                .filter(Boolean)
                .join(", ")
            : "No address provided",
          contact: userProfile?.contact || "No contact provided",
        }}
        currentUserLocation={currentUserLocation}
      />

      <OrderSuccessModal
        isOpen={showSuccessModal}
        onClose={handleCloseSuccessModal}
        orderData={orderSuccessData}
      />
    </div>
  );
}