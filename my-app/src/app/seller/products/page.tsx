"use client";
import React, { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, onSnapshot, orderBy, getDocs, doc, deleteDoc, getDoc } from "firebase/firestore";
import { auth, db } from "../../../utils/lib/firebase";
import ProductCard from "./components/ProductCard/ProductCard";
import CreateProductForm from "./components/CreateProductForm/CreateProductForm";
import UpdateProductForm from "./components/UpdateProductForm/UpdateProductForm";
import DeleteConfirmationModal from "./components/DeleteConfirmationModal/DeleteConfirmationModal";
import CreateProductModal from "../../../components/auth/modals/CreateProductModal/CreateProductModal";
import { Plus, Filter, Edit, Trash2 } from "lucide-react";
import { useCategory } from "../../context/CategoryContext";
import styles from "./products.module.css";

// Updated Date filter dropdown component to match marketplace design
const DateFilterDropdown = ({ sortOrder, onDateSort }: { sortOrder: string, onDateSort: (sort: string) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={styles.dropdownButton}
      >
        <Filter size={16} />
        <span>Sort: {sortOrder === 'newest' ? 'Newest' : 'Oldest'}</span>
        <span className={`${styles.arrow} ${isOpen ? styles.arrowUp : styles.arrowDown}`}></span>
      </button>
      
      {isOpen && (
        <div className={styles.dropdownList}>
          <button
            onClick={() => {
              onDateSort("newest");
              setIsOpen(false);
            }}
            className={`${styles.dropdownItem} ${sortOrder === 'newest' ? styles.selected : ''}`}
          >
            Newest to Oldest
          </button>
          <button
            onClick={() => {
              onDateSort("oldest");
              setIsOpen(false);
            }}
            className={`${styles.dropdownItem} ${sortOrder === 'oldest' ? styles.selected : ''}`}
          >
            Oldest to Newest
          </button>
        </div>
      )}
    </div>
  );
};

// ✅ ADDED: Function to fetch real reviews and calculate ratings
const fetchProductReviews = async (productId: string) => {
  try {
    const reviewsQuery = query(
      collection(db, "reviews"),
      where("productId", "==", productId),
      where("isActive", "==", true),
      orderBy("createdAt", "desc")
    );
    
    const reviewsSnapshot = await getDocs(reviewsQuery);
    const reviewsData = reviewsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log('✅ Fetched real reviews for product:', productId, reviewsData.length);
    return reviewsData;
  } catch (error) {
    console.error("Error fetching reviews:", error);
    return [];
  }
};

// ✅ FIXED: Use getDoc instead of getDocs for single document
const fetchSellerData = async (sellerId: string) => {
  try {
    const sellerDoc = await getDoc(doc(db, "sellers", sellerId));
    if (sellerDoc.exists()) {
      return sellerDoc.data();
    }
    return null;
  } catch (error) {
    console.error("Error fetching seller data:", error);
    return null;
  }
};

// Stock Status Badge Component
const StockStatusBadge = ({ stock }: { stock: number }) => {
  const getStockConfig = (stock: number) => {
    if (stock === 0) {
      return { color: '#ef4444', bgColor: '#fef2f2', text: 'Out of Stock' };
    } else if (stock <= 10) {
      return { color: '#f59e0b', bgColor: '#fffbeb', text: 'Low Stock' };
    } else {
      return { color: '#10b981', bgColor: '#ecfdf5', text: 'In Stock' };
    }
  };

  const config = getStockConfig(stock);

  return (
    <span 
      className={styles.stockBadge}
      style={{ 
        color: config.color, 
        backgroundColor: config.bgColor,
        border: `1px solid ${config.color}20`
      }}
    >
      {config.text}
    </span>
  );
};

export default function ProductsPage() {
    const { selectedCategory } = useCategory();
    const [products, setProducts] = useState<any[]>([]);
    const [sortOrder, setSortOrder] = useState("newest");
    
    // ✅ FIXED: Proper modal state management like marketplace
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [createdProduct, setCreatedProduct] = useState<any>(null);
    
    const [updateProduct, setUpdateProduct] = useState<any>(null);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; product: any }>({ 
      isOpen: false, 
      product: null 
    });
    const [isDeleting, setIsDeleting] = useState(false);

    console.log("📦 ProductsPage - selectedCategory from context:", selectedCategory);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setCurrentUser(user);
                fetchFarmerProducts(user.uid);
            } else {
                setLoading(false);
                setError("Please log in to view your products");
            }
        });
        return () => unsubscribe();
    }, []);

    // ✅ UPDATED: Enhanced product fetching with reviews and seller data
    const fetchFarmerProducts = async (farmerId: string) => {
        setLoading(true);
        setError(null);
        
        try {
            const productsQuery = query(
                collection(db, "products"),
                where("sellerId", "==", farmerId),
                orderBy("createdAt", "desc")
            );
            
            const unsubscribe = onSnapshot(productsQuery, 
                async (querySnapshot) => {
                    const farmerProducts: any[] = [];
                    
                    // Process each product and fetch additional data
                    for (const doc of querySnapshot.docs) {
                        const productData = doc.data();
                        
                        try {
                            // ✅ Fetch real reviews for this product
                            const reviews = await fetchProductReviews(doc.id);
                            
                            // ✅ Calculate average rating from real reviews
                            const averageRating = reviews.length > 0 
                                ? reviews.reduce((sum: number, review: any) => sum + (review.rating || 0), 0) / reviews.length
                                : 0;

                            // ✅ Fetch seller data for location information
                            const sellerData = await fetchSellerData(farmerId);

                            // ✅ Enhanced product data with real metrics
                            const enhancedProduct = {
                                id: doc.id,
                                ...productData,
                                createdAt: productData.createdAt?.toDate ? productData.createdAt.toDate() : new Date(productData.createdAt),
                                // 🟢 REAL REVIEW DATA
                                reviews: reviews,
                                reviewsCount: reviews.length,
                                rating: parseFloat(averageRating.toFixed(1)),
                                // 🟢 SELLER DATA for location
                                farmer: sellerData ? {
                                    location: sellerData.address?.location,
                                    barangay: sellerData.address?.barangay,
                                    displayName: sellerData.displayName,
                                    fullName: sellerData.fullName
                                } : undefined,
                                // 🟢 Ensure stock data is properly formatted
                                stock: productData.quantity_available || productData.stock || 0,
                                // 🟢 Ensure proper image handling
                                imageUrls: productData.imageUrls || (productData.image ? [productData.image] : []),
                                image: productData.imageUrls?.[0] || productData.image
                            };

                            farmerProducts.push(enhancedProduct);
                            
                        } catch (productError) {
                            console.error(`Error processing product ${doc.id}:`, productError);
                            // Fallback: push basic product data without reviews
                            farmerProducts.push({
                                id: doc.id,
                                ...productData,
                                createdAt: productData.createdAt?.toDate ? productData.createdAt.toDate() : new Date(productData.createdAt),
                                reviews: [],
                                reviewsCount: 0,
                                rating: 0,
                                stock: productData.quantity_available || productData.stock || 0,
                                imageUrls: productData.imageUrls || (productData.image ? [productData.image] : []),
                                image: productData.imageUrls?.[0] || productData.image
                            });
                        }
                    }
                    
                    console.log(`✅ Loaded ${farmerProducts.length} products with REAL data for farmer ${farmerId}`);
                    console.log('📊 Sample product data:', farmerProducts[0]);
                    setProducts(farmerProducts);
                    setLoading(false);
                },
                (error) => {
                    console.error("Error with real-time listener:", error);
                    fetchProductsFallback(farmerId);
                }
            );
            return unsubscribe;
        } catch (error) {
            console.error("Error setting up product listener:", error);
            fetchProductsFallback(farmerId);
        }
    };

    // ✅ UPDATED: Enhanced fallback with real data
    const fetchProductsFallback = async (farmerId: string) => {
        try {
            console.log("🔄 Using fallback query...");
            const productsQuery = query(
                collection(db, "products"),
                where("sellerId", "==", farmerId)
            );
            const querySnapshot = await getDocs(productsQuery);
            const farmerProducts: any[] = [];
            
            // Process each product with enhanced data
            for (const doc of querySnapshot.docs) {
                const productData = doc.data();
                
                try {
                    // Fetch reviews for fallback too
                    const reviews = await fetchProductReviews(doc.id);
                    const averageRating = reviews.length > 0 
                        ? reviews.reduce((sum: number, review: any) => sum + (review.rating || 0), 0) / reviews.length
                        : 0;

                    const sellerData = await fetchSellerData(farmerId);

                    farmerProducts.push({
                        id: doc.id,
                        ...productData,
                        createdAt: productData.createdAt?.toDate ? productData.createdAt.toDate() : new Date(productData.createdAt),
                        reviews: reviews,
                        reviewsCount: reviews.length,
                        rating: parseFloat(averageRating.toFixed(1)),
                        farmer: sellerData ? {
                            location: sellerData.address?.location,
                            barangay: sellerData.address?.barangay,
                            displayName: sellerData.displayName,
                            fullName: sellerData.fullName
                        } : undefined,
                        stock: productData.quantity_available || productData.stock || 0,
                        imageUrls: productData.imageUrls || (productData.image ? [productData.image] : []),
                        image: productData.imageUrls?.[0] || productData.image
                    });
                } catch (error) {
                    console.error(`Error in fallback for product ${doc.id}:`, error);
                    farmerProducts.push({
                        id: doc.id,
                        ...productData,
                        createdAt: productData.createdAt?.toDate ? productData.createdAt.toDate() : new Date(productData.createdAt),
                        reviews: [],
                        reviewsCount: 0,
                        rating: 0,
                        stock: productData.quantity_available || productData.stock || 0,
                        imageUrls: productData.imageUrls || (productData.image ? [productData.image] : []),
                        image: productData.imageUrls?.[0] || productData.image
                    });
                }
            }
            
            farmerProducts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
            
            console.log(`✅ Fallback loaded ${farmerProducts.length} products with enhanced data`);
            setProducts(farmerProducts);
            setError("");
        } catch (fallbackError) {
            console.error("Fallback also failed:", fallbackError);
            setError("Failed to load products. Please check your Firestore index setup.");
        } finally {
            setLoading(false);
        }
    };

    const sortProducts = (productsToSort: any[], order: string) => {
        return [...productsToSort].sort((a, b) => {
            const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
            const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
            
            if (order === "newest") {
                return dateB.getTime() - dateA.getTime();
            } else {
                return dateA.getTime() - dateB.getTime();
            }
        });
    };

    const handleDateSort = (sort: string) => {
        setSortOrder(sort);
    };

    // ✅ FIXED: Enhanced create product handler - like marketplace pattern
    const handleProductCreated = (product: any) => {
        console.log("✅ Product created successfully:", product);
        // Set the created product to show success modal
        setCreatedProduct(product);
        // Close the create form modal
        setShowCreateForm(false);
        // The product list will automatically update via the real-time listener
    };

    const handleUpdate = (updatedProduct: any) => {
        setUpdateProduct(null);
    };

    // ✅ FIXED: Enhanced modal handlers like marketplace
    const handleCloseCreateModal = () => {
        setShowCreateForm(false);
    };

    const handleCloseSuccessModal = () => {
        setCreatedProduct(null);
    };

    const handleViewProduct = (productId: string) => {
        console.log("View product:", productId);
        setCreatedProduct(null);
        // You can add navigation to product details here
    };

    const handleCreateAnother = () => {
        setCreatedProduct(null);
        setShowCreateForm(true); // Reopen create form
    };

    // 🟢 UPDATED: Enhanced delete functionality with modal
    const handleDeleteClick = (product: any) => {
        setDeleteModal({
            isOpen: true,
            product: product
        });
    };

    const handleConfirmDelete = async () => {
        if (!currentUser || !deleteModal.product) {
            setError("You must be logged in to delete products");
            return;
        }
        
        setIsDeleting(true);
        try {
            console.log("🗑️ Deleting product:", deleteModal.product.id);
            await deleteDoc(doc(db, "products", deleteModal.product.id));
            console.log("✅ Product deleted successfully from Firestore");
            setDeleteModal({ isOpen: false, product: null });
        } catch (error: any) {
            console.error("❌ Error deleting product:", error);
            setError(error.message || "Failed to delete product. Please try again.");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleCloseDeleteModal = () => {
        if (!isDeleting) {
            setDeleteModal({ isOpen: false, product: null });
        }
    };

    // ✅ FIXED: Show all products immediately without category filtering
    const filteredAndSortedProducts = React.useMemo(() => {
        console.log("🔄 Filtering products...");
        console.log("🔍 Total products:", products.length);
        console.log("🔍 Selected category:", selectedCategory);
        
        // If no category selected or "All Products", show all products
        if (!selectedCategory || selectedCategory === "All Products" || selectedCategory === "all") {
            console.log("✅ Showing ALL products");
            return sortProducts(products, sortOrder);
        }
        
        // Only filter if a specific category is selected
        const filtered = products.filter(p => {
            const matches = p.category === selectedCategory;
            console.log(`🔍 Product "${p.name}" - category: "${p.category}" - matches: ${matches}`);
            return matches;
        });
        
        console.log(`🔍 Filter result: ${filtered.length} products found in "${selectedCategory}"`);
        return sortProducts(filtered, sortOrder);
    }, [products, selectedCategory, sortOrder]);

    if (loading) {
        return (
            <div className={styles.productsPage}>
                <div className={styles.loadingContainer}>
                    <div className={styles.loadingSpinner}></div>
                    <p>Loading your products...</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.productsPage}>
            <div className={styles.productsContent}>
                {/* Controls - Create button and dropdown side by side on the right */}
                <div className={styles.controls}>
                    <div className={styles.controlsGroup}>
                        {/* ✅ FIXED: Create Product Button - Properly connected like marketplace */}
                        <button 
                            className={styles.createBtn} 
                            onClick={() => {
                                console.log("🔄 Opening create product modal");
                                setShowCreateForm(true);
                            }}
                        >
                            <Plus size={18} />
                            Create Product
                        </button>
                        
                        <DateFilterDropdown 
                            sortOrder={sortOrder} 
                            onDateSort={handleDateSort} 
                        />
                    </div>
                </div>

                {/* Error Banner */}
                {error && (
                    <div className={styles.errorBanner}>
                        {error}
                    </div>
                )}

                {/* Products Table */}
                <div className={styles.tableContainer}>
                  <table className={styles.productsTable}>
                    <thead>
                      <tr>
                        <th>Product Name</th>
                        <th>Category</th>
                        <th>Price</th>
                        <th>Stock</th>
                        <th>Rating</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAndSortedProducts && filteredAndSortedProducts.length > 0 ? (
                        filteredAndSortedProducts.map(product => (
                          <tr key={product.id}>
                            <td>
                              <div className={styles.productInfo}>
                                <div className={styles.productImage}>
                                  <img 
                                    src={product.imageUrls?.[0] || product.image || '/images/placeholder.jpg'} 
                                    alt={product.name}
                                  />
                                </div>
                                <div className={styles.productDetails}>
                                  <strong>{product.name}</strong>
                                  <span>{product.description?.substring(0, 50)}...</span>
                                </div>
                              </div>
                            </td>
                            <td className={styles.category}>
                              {product.category || 'Uncategorized'}
                            </td>
                            <td className={styles.price}>
                              ₱{product.price || '0.00'}
                            </td>
                            <td className={styles.stock}>
                              {product.stock || 0}
                            </td>
                            <td className={styles.rating}>
                              <div className={styles.ratingInfo}>
                                <span className={styles.ratingStars}>⭐</span>
                                {product.rating?.toFixed(1) || '0.0'}
                                <span className={styles.reviewCount}>({product.reviewsCount || 0})</span>
                              </div>
                            </td>
                            <td>
                              <StockStatusBadge stock={product.stock || 0} />
                            </td>
                            <td>
                              <div className={styles.actions}>
                                <button 
                                  className={styles.editBtn}
                                  onClick={() => setUpdateProduct(product)}
                                  title="Edit Product"
                                >
                                  <Edit size={16} />
                                </button>
                                <button 
                                  className={styles.deleteBtn}
                                  onClick={() => handleDeleteClick(product)}
                                  title="Delete Product"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className={styles.noProducts}>
                            <div className={styles.emptyState}>
                              <p>No products found</p>
                              <span>
                                {selectedCategory && selectedCategory !== "All Products" && selectedCategory !== "all"
                                  ? `No products found in "${selectedCategory}". Try changing the category filter.`
                                  : "Create your first product to get started!"}
                              </span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Products Grid */}
                <div className={styles.productsContainer}>
                    {filteredAndSortedProducts && filteredAndSortedProducts.length > 0 ? (
                        filteredAndSortedProducts.map(product => (
                            <ProductCard
                                key={product.id}
                                product={product}
                                onUpdate={(p) => setUpdateProduct(p)}
                                onDelete={handleDeleteClick}
                            />
                        ))
                    ) : (
                        <div className={styles.emptyState}>
                            <p>No products found</p>
                            <span>
                                {selectedCategory && selectedCategory !== "All Products" && selectedCategory !== "all"
                                    ? `No products found in "${selectedCategory}". Try changing the category filter.`
                                    : "Create your first product to get started!"
                                }
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* ✅ FIXED: Create Product Form Modal - Like CartSidebar */}
            {showCreateForm && (
                <CreateProductForm 
                    onClose={handleCloseCreateModal}
                    onCreate={handleProductCreated}
                    sellerId={currentUser?.uid}
                />
            )}
            
            {/* ✅ FIXED: Success Modal - Like OrderSuccessModal */}
            <CreateProductModal
                isOpen={!!createdProduct}
                onClose={handleCloseSuccessModal}
                product={createdProduct}
                onViewProduct={handleViewProduct}
                onCreateAnother={handleCreateAnother}
            />

            {updateProduct && (
                <UpdateProductForm 
                    product={updateProduct} 
                    onClose={() => setUpdateProduct(null)} 
                    onUpdate={handleUpdate} 
                />
            )}

            {/* Delete Confirmation Modal */}
            <DeleteConfirmationModal
                isOpen={deleteModal.isOpen}
                onClose={handleCloseDeleteModal}
                onConfirm={handleConfirmDelete}
                productName={deleteModal.product?.name}
                isLoading={isDeleting}
            />
        </div>
    );
}