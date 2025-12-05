import { 
  collection, 
  addDoc, 
  getDocs, 
  getDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  serverTimestamp,
  query,
  where,
  orderBy 
} from 'firebase/firestore';
import { db } from './firebase';

// Import pricing services
import { PricingCalculator, type PriceCalculation, type ShippingCalculation } from './pricingService';

// Simple in-memory cache for products (replaces Redis)
const productCache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 1800000; // 30 minutes in milliseconds
const SHORT_CACHE_TTL = 300000; // 5 minutes

// 🟢 ENHANCED: Local caching functions with better error handling
const cacheProduct = async (product: Product): Promise<void> => {
  try {
    if (product.id) {
      productCache.set(`product:${product.id}`, {
        data: { ...product, _cachedAt: Date.now() },
        timestamp: Date.now()
      });
      console.log(`✅ Cached product ${product.id} locally`);
    }
  } catch (error) {
    console.log('⚠️ Failed to cache product:', error);
  }
};

const getCachedProduct = async (id: string): Promise<Product | null> => {
  try {
    const cacheKey = `product:${id}`;
    const cached = productCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      console.log(`✅ Serving product ${id} from local cache`);
      return cached.data as Product;
    }
    
    // Remove expired cache
    if (cached && (Date.now() - cached.timestamp) >= CACHE_TTL) {
      productCache.delete(cacheKey);
    }
    
    return null;
  } catch (error) {
    console.log('⚠️ Failed to get cached product:', error);
    return null;
  }
};

const cacheProductsList = async (
  products: Product[], 
  cacheKey: string = 'products:all'
): Promise<void> => {
  try {
    productCache.set(cacheKey, {
      data: products.map(p => ({ ...p, _cachedAt: Date.now() })),
      timestamp: Date.now()
    });
    console.log(`✅ Cached ${products.length} products locally in ${cacheKey}`);
  } catch (error) {
    console.log('⚠️ Failed to cache products list:', error);
  }
};

const getCachedProductsList = async (
  cacheKey: string = 'products:all'
): Promise<Product[] | null> => {
  try {
    const cached = productCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      console.log(`✅ Serving products from local cache: ${cacheKey}`);
      return cached.data as Product[];
    }
    
    // Remove expired cache
    if (cached && (Date.now() - cached.timestamp) >= CACHE_TTL) {
      productCache.delete(cacheKey);
    }
    
    return null;
  } catch (error) {
    console.log('⚠️ Failed to get cached products list:', error);
    return null;
  }
};

// Simple rate limiting using local storage
const rateLimitStore = new Map<string, { count: number, timestamp: number }>();

async function checkApiRateLimit(ip: string, endpoint: string): Promise<boolean> {
  try {
    const rateLimitKey = `rate:api:${endpoint}:${ip}:${Math.floor(Date.now() / 60000)}`;
    
    // Clean up old rate limits
    const now = Date.now();
    for (const [key, value] of rateLimitStore.entries()) {
      if (now - value.timestamp > 60000) { // 1 minute
        rateLimitStore.delete(key);
      }
    }
    
    const current = rateLimitStore.get(rateLimitKey);
    const count = current ? current.count + 1 : 1;
    
    rateLimitStore.set(rateLimitKey, {
      count,
      timestamp: now
    });
    
    const limit = endpoint === 'search' ? 30 : 60;
    return count > limit;
  } catch (error) {
    console.log('⚠️ Rate limit check failed, allowing request:', error);
    return false;
  }
}

// ✅ ADDED: Event publishing service without Redis
async function publishProductEvent(productData: any, eventType: string = 'created') {
  try {
    const eventPayload = {
      id: productData.id,
      name: productData.name,
      price: productData.price,
      farmer: productData.farmName || 'Unknown Farmer',
      category: productData.category,
      description: productData.description,
      stock: productData.stock,
      unit: productData.unit,
      requiresColdChain: productData.requiresColdChain || false,
      tags: productData.tags || [],
      minimumOrderQuantity: productData.minimumOrderQuantity || 1,
      farmName: productData.farmName,
      location: productData.location,
      imageUrls: productData.imageUrls || [],
      timestamp: new Date().toISOString(),
      eventType: `PRODUCT_${eventType.toUpperCase()}`
    };

    // Send to your hub service
    const response = await fetch('http://localhost:4001/products/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventPayload)
    });
    
    if (!response.ok) {
      console.log(`Hub service unavailable for ${eventType} event`);
    } else {
      console.log(`✅ Product ${eventType} event published to hub service`);
    }
  } catch (error) {
    console.log(`⚠️ Event publishing failed for ${eventType}, but operation continues`);
  }
}

// ✅ ADDED: Function to update hot products tracking
async function updateHotProductsCache(productId: string): Promise<void> {
  try {
    // Simple in-memory tracking
    const viewsKey = `product:views:${productId}`;
    const currentViews = productCache.get(viewsKey);
    const newCount = currentViews ? (currentViews.data as number) + 1 : 1;
    
    productCache.set(viewsKey, {
      data: newCount,
      timestamp: Date.now()
    });
    
    // Clean up old views periodically
    if (newCount % 10 === 0) {
      console.log(`🔥 Product ${productId} getting hot! Views: ${newCount}`);
    }
  } catch (error) {
    console.log('⚠️ Failed to update hot products cache:', error);
  }
}

// ✅ Added helper function for updating stock
export async function updateStock(productId: string, newStock: number) {
  try {
    const productRef = doc(db, "products", productId);
    await updateDoc(productRef, { 
      stock: newStock,
      updatedAt: serverTimestamp()
    });
    console.log(`✅ Stock updated for product ${productId}: ${newStock}`);
    
    // 🟢 ENHANCED: Update cache with new stock
    const cachedProduct = await getCachedProduct(productId);
    if (cachedProduct) {
      cachedProduct.stock = newStock;
      await cacheProduct(cachedProduct);
    }
    
    // Publish inventory update event
    await publishProductEvent({ id: productId, stock: newStock }, 'stock_updated');
    
  } catch (error: any) {
    console.error("❌ Failed to update stock:", error);
    throw new Error(`Failed to update stock: ${error.message}`);
  }
}

export interface Product {
  id?: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  minStock: number; 
  minimumOrderQuantity: number; // Minimum Order Quantity
  category: string;
  unit: string;
  imageUrls: string[];
  createdAt?: any;
  updatedAt?: any;
  isActive: boolean;
  sellerId: string;
  farmName: string;
  location: string;
  
  // 🔥 STEP 8: Add cold chain field
  requiresColdChain?: boolean; // For temperature-sensitive products
  
  // 🟢 ADDED: Product tags field
  tags?: string[]; // Array of product tags like ["Organic", "Fresh Harvest", etc.]
  
  // 🟢 ADDED: Rating and reviews fields for proper data structure
  rating?: number;
  reviews?: number;
  sold?: number;

  // 🟢 ADDED: New pricing transparency fields
  farmerPrice?: number;          // Price set by farmer
  marketPrice?: number;          // Calculated market reference price
  platformFee?: number;          // 5% service fee
  shippingFee?: number;          // Calculated delivery cost
  vatAmount?: number;            // 12% VAT
  finalPrice?: number;           // Total price (farmerPrice + platformFee + shippingFee + vatAmount)
  
  // 🟢 ADDED: Shipping calculation fields
  shippingBaseRate?: number;
  shippingRatePerKm?: number;
  estimatedDistance?: number;
  estimatedDeliveryTime?: string;
  
  // 🟢 ADDED: Complete price breakdown
  priceBreakdown?: PriceCalculation;
  
  // 🟢 ADDED: Cache metadata
  _cachedAt?: number;
  _cacheVersion?: string;
}

export interface ProductData {
  name: string;
  description: string;
  price: number;
  stock: number;
  minStock: number; // ADDED: minStock field
  // ✅ ADDED: MOQ field
  minimumOrderQuantity: number; // Minimum Order Quantity
  category: string;
  unit: string;
  images: File[];
  farmName: string;
  location: string;
  
  // 🔥 STEP 8: Add cold chain field
  requiresColdChain?: boolean; // For temperature-sensitive products
  
  // 🟢 ADDED: Product tags field
  tags?: string[]; // Array of product tags like ["Organic", "Fresh Harvest", etc.]

  // 🟢 ADDED: New pricing fields
  farmerPrice?: number;
  shippingBaseRate?: number;
  shippingRatePerKm?: number;
}

// Helper function to convert file to base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

// Helper function to compress images before upload
const compressImage = (file: File, maxWidth = 800, quality = 0.7): Promise<File> => {
  return new Promise((resolve, reject) => {
    // If file is already small, return as is
    if (file.size < 500 * 1024) { // 500KB
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Calculate new dimensions
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              console.log(`✅ Image compressed: ${file.size} → ${compressedFile.size} bytes`);
              resolve(compressedFile);
            } else {
              reject(new Error('Canvas to Blob conversion failed'));
            }
          },
          'image/jpeg',
          quality
        );
      };
      
      img.onerror = () => reject(new Error('Image loading failed'));
    };
    
    reader.onerror = () => reject(new Error('File reading failed'));
  });
};

// 🟢 ADDED: Function to calculate initial pricing for new products
const calculateInitialPricing = (
  farmerPrice: number,
  category: string,
  unit: string,
  location: string
): PriceCalculation => {
  // Default shipping calculation (will be updated when user location is available)
  const defaultShipping: ShippingCalculation = {
    distance: 5, // Default distance in km
    baseRate: 20,
    ratePerKm: 5,
    estimatedTime: '30-45 min',
    total: 45 // 20 + (5 * 5)
  };

  return PricingCalculator.calculateProductPricing(
    farmerPrice,
    category,
    unit,
    defaultShipping
  );
};

// Add new product - ENHANCED with local caching and event publishing
export const addProduct = async (productData: ProductData, sellerId: string): Promise<Product> => {
  try {
    // Check rate limit for product creation
    const rateLimited = await checkApiRateLimit(sellerId, 'create_product');
    if (rateLimited) {
      throw new Error('Too many product creation requests. Please wait a moment.');
    }
    
    let imageUrls: string[] = [];
    
    // Upload all images if provided using Cloudinary
    if (productData.images && productData.images.length > 0) {
      console.log('🔄 Starting image upload for', productData.images.length, 'images');
      
      const imageUploads = productData.images.map(async (imageFile, index) => {
        try {
          console.log(`📤 Processing image ${index + 1}:`, imageFile.name, 'Size:', imageFile.size, 'bytes');
          
          // Compress image before upload to reduce size
          const compressedFile = await compressImage(imageFile);
          
          const base64Data = await fileToBase64(compressedFile);
          
          const imagePayload = {
            base64Data,
            fileName: compressedFile.name
          };

          console.log('📨 Sending to Cloudinary API...');
          
          const response = await fetch('/api/upload-cloudinary', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              images: [imagePayload]
            }),
          });

          console.log('📩 API Response status:', response.status);
          
      if (!response.ok) {
            if (response.status === 413) {
              throw new Error('Image too large even after compression. Please use a smaller image.');
            }
            throw new Error(`Upload failed with status: ${response.status}`);
          }

          const result = await response.json();
          console.log('✅ Upload successful:', result);
          
          if (!result.success) {
            throw new Error(result.error || 'Image upload failed');
          }

          return result.imageUrls[0];
        } catch (error: any) {
          console.error(`❌ Failed to upload image ${index + 1}:`, error);
          throw error;
        }
      });

      imageUrls = await Promise.all(imageUploads);
      console.log('🎉 All images uploaded successfully');
    }

    // 🟢 ADDED: Calculate price breakdown
    const farmerPrice = productData.farmerPrice || productData.price;
    const priceBreakdown = calculateInitialPricing(
      farmerPrice,
      productData.category,
      productData.unit,
      productData.location
    );

    const productWithMetadata: Omit<Product, 'id'> = {
      name: productData.name,
      description: productData.description,
      price: productData.price, // Keep original price for backward compatibility
      stock: productData.stock,
      minStock: productData.minStock, // ADDED: minStock field
      // ✅ ADDED: MOQ field with default value
      minimumOrderQuantity: productData.minimumOrderQuantity || 1,
      category: productData.category,
      unit: productData.unit,
      farmName: productData.farmName,
      location: productData.location,
      imageUrls: imageUrls,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isActive: true,
      sellerId: sellerId, // ← USE THE ACTUAL SELLER ID
      // 🔥 STEP 8: Add cold chain field
      requiresColdChain: productData.requiresColdChain || false,
      // 🟢 ADDED: Product tags with validation
      tags: productData.tags ? productData.tags.slice(0, 4) : [], // Limit to 4 tags
      // 🟢 ADDED: Initialize rating and review fields
      rating: 0,
      reviews: 0,
      sold: 0,
      // 🟢 ADDED: New pricing transparency fields
      farmerPrice: farmerPrice,
      marketPrice: priceBreakdown.marketPrice,
      platformFee: priceBreakdown.platformFee,
      shippingFee: priceBreakdown.shippingFee,
      // 🟢 DTI-COMPLIANT: VAT on product + platform fee ONLY (NOT shipping)
      vatAmount: priceBreakdown.vatAmount,
      finalPrice: priceBreakdown.finalPrice,
      // 🟢 ADDED: Shipping calculation fields
      shippingBaseRate: productData.shippingBaseRate || 20,
      shippingRatePerKm: productData.shippingRatePerKm || 5,
      estimatedDistance: 5, // Default, will be updated
      estimatedDeliveryTime: '30-45 min',
      // 🟢 ADDED: Complete price breakdown
      priceBreakdown: priceBreakdown,
      // 🟢 ADDED: Cache metadata
      _cachedAt: Date.now(),
      _cacheVersion: '1.0'
    };

    console.log('💾 Saving product to Firestore for seller:', sellerId);
    console.log('🏠 Farm details:', { 
      farmName: productData.farmName, 
      location: productData.location 
    });
    console.log('📊 Stock details:', {
      stock: productData.stock,
      minStock: productData.minStock,
      minimumOrderQuantity: productData.minimumOrderQuantity || 1
    });
    console.log('💰 Pricing details:', {
      farmerPrice: farmerPrice,
      marketPrice: priceBreakdown.marketPrice,
      platformFee: priceBreakdown.platformFee,
      shippingFee: priceBreakdown.shippingFee,
      vatAmount: priceBreakdown.vatAmount,
      finalPrice: priceBreakdown.finalPrice
    });
    console.log('❄️ Cold Chain:', productData.requiresColdChain ? 'Yes' : 'No');
    console.log('🏷️ Product Tags:', productData.tags || []);
    
    const docRef = await addDoc(collection(db, 'products'), productWithMetadata);
    console.log('✅ Product created with ID:', docRef.id);
    
    const newProduct = { 
      id: docRef.id, 
      ...productWithMetadata
    };

    // ✅ ENHANCED: Cache the new product locally
    await cacheProduct(newProduct);
    
    // Clear product list cache to ensure fresh data
    productCache.delete('products:all');
    productCache.delete(`products:seller:${sellerId}`);
    
    // ✅ ENHANCED: Publish event
    await publishProductEvent(newProduct, 'created');
    
    return newProduct;
  } catch (error: any) {
    console.error('❌ Error adding product:', error);
    throw new Error(`Failed to add product: ${error.message}`);
  }
};

// Get all products - ENHANCED with local caching
export const getProducts = async (sellerId: string | null = null): Promise<Product[]> => {
  try {
    // Check rate limit
    const ip = 'server'; // In real app, get from request
    if (await checkApiRateLimit(ip, 'get_products')) {
      throw new Error('Too many requests. Please try again later.');
    }
    
    let cacheKey = 'products:all';
    if (sellerId) {
      cacheKey = `products:seller:${sellerId}`;
      
      // Try to get from cache first for seller-specific products
      const cachedProducts = await getCachedProductsList(cacheKey);
      if (cachedProducts) {
        console.log('✅ Serving seller products from local cache:', sellerId);
        
        // Update hot products cache
        cachedProducts.forEach(product => {
          if (product.id) updateHotProductsCache(product.id).catch(console.error);
        });
        
        return cachedProducts;
      }
    } else {
      // Try to get from cache first for public listings
      const cachedProducts = await getCachedProductsList();
      if (cachedProducts) {
        console.log('✅ Serving public products from local cache');
        
        // Update hot products cache
        cachedProducts.forEach(product => {
          if (product.id) updateHotProductsCache(product.id).catch(console.error);
        });
        
        return cachedProducts;
      }
    }

    let q;
    if (sellerId) {
      q = query(
        collection(db, 'products'),
        where('sellerId', '==', sellerId),
        where('isActive', '==', true),
        orderBy('createdAt', 'desc')
      );
    } else {
      q = query(
        collection(db, 'products'),
        where('isActive', '==', true),
        orderBy('createdAt', 'desc')
      );
    }

    const querySnapshot = await getDocs(q);
    const products = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      _cachedAt: Date.now(),
      _cacheVersion: '1.0'
    })) as Product[];

    // 🟢 ENHANCED: Cache the results locally
    await cacheProductsList(products, cacheKey);
    
    // Update hot products cache
    products.forEach(product => {
      if (product.id) updateHotProductsCache(product.id).catch(console.error);
    });

    return products;
  } catch (error: any) {
    console.error('Error getting products:', error);
    // Return empty array on error for graceful degradation
    return [];
  }
};

// Get product by ID - ENHANCED with local caching and hot tracking
export const getProductById = async (id: string): Promise<Product> => {
  try {
    // Check rate limit for product views
    if (await checkApiRateLimit(`product_${id}`, 'view_product')) {
      console.log('⚠️ Rate limited for product view:', id);
    }
    
    // 🟢 ENHANCED: Try to get from cache first with fallback
    const cachedProduct = await getCachedProduct(id);
    if (cachedProduct) {
      console.log('✅ Serving product from local cache:', id);
      
      // Update hot products tracking
      await updateHotProductsCache(id);
      
      // Check if cache is stale (older than 15 minutes)
      const cacheAge = Date.now() - (cachedProduct._cachedAt || 0);
      if (cacheAge > 15 * 60 * 1000) {
        // Cache is stale, refresh in background
        refreshProductCache(id).catch(console.error);
      }
      
      return cachedProduct;
    }

    console.log('⚠️ Cache miss for product, fetching from DB:', id);
    
    const docRef = doc(db, 'products', id);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const product = { 
        id: docSnap.id, 
        ...docSnap.data(),
        _cachedAt: Date.now(),
        _cacheVersion: '1.0'
      } as Product;
      
      // 🟢 ENHANCED: Cache the product locally
      await cacheProduct(product);
      
      // Update hot products tracking
      await updateHotProductsCache(id);
      
      return product;
    } else {
      throw new Error('Product not found');
    }
  } catch (error: any) {
    console.error('Error getting product:', error);
    throw new Error(`Failed to get product: ${error.message}`);
  }
};

// Background cache refresh function
async function refreshProductCache(productId: string): Promise<void> {
  try {
    const docRef = doc(db, 'products', productId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const product = { 
        id: docSnap.id, 
        ...docSnap.data(),
        _cachedAt: Date.now(),
        _cacheVersion: '1.0'
      } as Product;
      
      await cacheProduct(product);
      console.log(`🔄 Background cache refresh for product ${productId}`);
    }
  } catch (error) {
    console.log('⚠️ Background cache refresh failed:', error);
  }
}

// Update product - ENHANCED with cache management
export const updateProduct = async (
  id: string, 
  productData: Partial<Product>, 
  newImages: File[] = []
): Promise<Product> => {
  try {
    console.log('🔄 Starting product update for ID:', id);
    
    // 🔥 TEMPORARY FIX FOR MOCK DATA - Skip Firebase check for simple IDs
    if (id && id.length < 10) { // Simple IDs are usually short (like "1", "2", "7")
      console.log('🎭 Mock data detected, returning simulated update for ID:', id);
      
      // Simulate successful update for mock data
      const mockUpdatedProduct = {
        id,
        name: productData.name || '',
        description: productData.description || '',
        price: productData.price || 0,
        stock: productData.stock || 0,
        minStock: productData.minStock || 10,
        minimumOrderQuantity: productData.minimumOrderQuantity || 1,
        category: productData.category || '',
        unit: productData.unit || '',
        farmName: productData.farmName || '',
        location: productData.location || '',
        imageUrls: productData.imageUrls || [],
        updatedAt: new Date(),
        createdAt: new Date(),
        isActive: true,
        sellerId: 'current-user-id',
        requiresColdChain: productData.requiresColdChain || false,
        tags: productData.tags || [],
        rating: productData.rating || 0,
        reviews: productData.reviews || 0,
        sold: productData.sold || 0,
        farmerPrice: productData.farmerPrice || productData.price || 0,
        marketPrice: productData.marketPrice || productData.price || 0,
        platformFee: productData.platformFee || 0,
        shippingFee: productData.shippingFee || 0,
        vatAmount: productData.vatAmount || 0,
        finalPrice: productData.finalPrice || productData.price || 0,
        _cachedAt: Date.now(),
        _cacheVersion: '1.0'
      } as Product;
      
      console.log('✅ Mock update successful:', mockUpdatedProduct);
      
      // Cache the mock update
      await cacheProduct(mockUpdatedProduct);
      
      // Publish event for mock data too
      await publishProductEvent(mockUpdatedProduct, 'updated');
      
      return mockUpdatedProduct;
    }
    
    // For real Firebase IDs, do the normal check
    const docRef = doc(db, 'products', id);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      console.error('❌ Document not found for ID:', id);
      throw new Error(`Product with ID "${id}" not found. It may have been deleted.`);
    }

    console.log('✅ Document exists, current data:', docSnap.data());

    const existingData = docSnap.data();
    let imageUrls = existingData.imageUrls || []; // Start with existing images
    
    // Upload new images if provided using Cloudinary
    if (newImages && newImages.length > 0) {
      console.log('📤 Uploading', newImages.length, 'new images');
      
      const imageUploads = newImages.map(async (imageFile, index) => {
        try {
          console.log(`📤 Uploading new image ${index + 1}:`, imageFile.name, 'Size:', imageFile.size, 'bytes');
          
          // Compress image before upload to reduce size
          const compressedFile = await compressImage(imageFile);
          
          const base64Data = await fileToBase64(compressedFile);
          
          const imagePayload = {
            base64Data,
            fileName: compressedFile.name
          };

          console.log('📨 Sending to Cloudinary API...');
          
          const response = await fetch('/api/upload-cloudinary', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              images: [imagePayload]
            }),
          });

          console.log('📩 API Response status:', response.status);
          
          if (!response.ok) {
            if (response.status === 413) {
              throw new Error('Image too large even after compression. Please use a smaller image.');
            }
            throw new Error(`Upload failed with status: ${response.status}`);
          }

          const result = await response.json();
          console.log('✅ New image upload successful:', result);
          
          if (!result.success) {
            throw new Error(result.error || 'Image upload failed');
          }

          return result.imageUrls[0];
        } catch (error: any) {
          console.error(`❌ Failed to upload new image ${index + 1}:`, error);
          throw error;
        }
      });

      const newImageUrls = await Promise.all(imageUploads);
      imageUrls = [...newImageUrls]; // Replace existing images with new ones
      console.log('✅ New images uploaded, replacing existing ones:', imageUrls);
    } else {
      console.log('🔄 No new images provided, keeping existing images:', imageUrls);
    }

    // 🟢 ADDED: Recalculate pricing if farmer price changes
    let priceBreakdown = existingData.priceBreakdown;
    if (productData.farmerPrice !== undefined && productData.farmerPrice !== existingData.farmerPrice) {
      const shipping: ShippingCalculation = {
        distance: existingData.estimatedDistance || 5,
        baseRate: existingData.shippingBaseRate || 20,
        ratePerKm: existingData.shippingRatePerKm || 5,
        estimatedTime: existingData.estimatedDeliveryTime || '30-45 min',
        total: existingData.shippingFee || 45
      };

      priceBreakdown = PricingCalculator.calculateProductPricing(
        productData.farmerPrice,
        productData.category || existingData.category,
        productData.unit || existingData.unit,
        shipping
      );
    }

    const updateData = {
      name: productData.name,
      description: productData.description,
      price: productData.price,
      stock: productData.stock,
      minStock: productData.minStock,
      minimumOrderQuantity: productData.minimumOrderQuantity !== undefined 
        ? productData.minimumOrderQuantity 
        : existingData.minimumOrderQuantity || 1,
      category: productData.category,
      unit: productData.unit,
      farmName: productData.farmName,
      location: productData.location,
      imageUrls: imageUrls,
      updatedAt: serverTimestamp(),
      requiresColdChain: productData.requiresColdChain,
      tags: productData.tags ? productData.tags.slice(0, 4) : existingData.tags || [],
      ...(priceBreakdown && {
        farmerPrice: productData.farmerPrice,
        marketPrice: priceBreakdown.marketPrice,
        platformFee: priceBreakdown.platformFee,
        shippingFee: priceBreakdown.shippingFee,
        vatAmount: priceBreakdown.vatAmount,
        finalPrice: priceBreakdown.finalPrice,
        priceBreakdown: priceBreakdown
      })
    };

    console.log('💾 Updating document with:', updateData);

    await updateDoc(docRef, updateData);
    console.log('✅ Product updated successfully');
    
    const updatedProduct = { 
      id, 
      ...updateData,
      createdAt: existingData.createdAt,
      isActive: existingData.isActive !== undefined ? existingData.isActive : true,
      sellerId: existingData.sellerId || 'current-user-id',
      rating: existingData.rating || 0,
      reviews: existingData.reviews || 0,
      sold: existingData.sold || 0,
      farmerPrice: priceBreakdown ? priceBreakdown.marketPrice : existingData.farmerPrice,
      marketPrice: priceBreakdown ? priceBreakdown.marketPrice : existingData.marketPrice,
      platformFee: priceBreakdown ? priceBreakdown.platformFee : existingData.platformFee,
      shippingFee: priceBreakdown ? priceBreakdown.shippingFee : existingData.shippingFee,
      vatAmount: priceBreakdown ? priceBreakdown.vatAmount : existingData.vatAmount,
      finalPrice: priceBreakdown ? priceBreakdown.finalPrice : existingData.finalPrice,
      priceBreakdown: priceBreakdown || existingData.priceBreakdown,
      _cachedAt: Date.now(),
      _cacheVersion: '1.0'
    } as Product;

    // 🟢 ENHANCED: Update cache with the updated product
    await cacheProduct(updatedProduct);
    
    // 🟢 ENHANCED: Clear related caches
    productCache.delete('products:all');
    if (existingData.sellerId) {
      productCache.delete(`products:seller:${existingData.sellerId}`);
    }
    
    // ✅ ENHANCED: Publish update event
    await publishProductEvent(updatedProduct, 'updated');

    return updatedProduct;
  } catch (error: any) {
    console.error('❌ Error updating product:', error);
    throw new Error(`Failed to update product: ${error.message}`);
  }
};

// Delete product (soft delete) - ENHANCED with cache cleanup
export const deleteProduct = async (id: string): Promise<void> => {
  try {
    // 🔥 TEMPORARY FIX FOR MOCK DATA - Skip Firebase for simple IDs
    if (id && id.length < 10) {
      console.log('🎭 Mock data detected, skipping Firebase delete for ID:', id);
      
      // Still clear cache for mock data
      productCache.delete(`product:${id}`);
      return;
    }
    
    const docRef = doc(db, 'products', id);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      console.log('⚠️ Product already deleted or not found:', id);
      productCache.delete(`product:${id}`);
      return;
    }
    
    const existingData = docSnap.data();
    
    await updateDoc(docRef, {
      isActive: false,
      updatedAt: serverTimestamp()
    });

    // 🟢 ENHANCED: Clear caches
    productCache.delete(`product:${id}`);
    productCache.delete('products:all');
    if (existingData.sellerId) {
      productCache.delete(`products:seller:${existingData.sellerId}`);
    }
    
    // Publish delete event
    await publishProductEvent({ id, ...existingData }, 'deleted');
    
    console.log('✅ Product soft deleted and cache cleared:', id);
  } catch (error: any) {
    console.error('Error deleting product:', error);
    throw new Error(`Failed to delete product: ${error.message}`);
  }
};

// Get products by category - ENHANCED with local caching
export const getProductsByCategory = async (category: string): Promise<Product[]> => {
  try {
    // Check rate limit
    const ip = 'server';
    if (await checkApiRateLimit(ip, `category_${category}`)) {
      console.log('⚠️ Rate limited for category view:', category);
      return [];
    }
    
    const cacheKey = `products:category:${category}`;
    
    // 🟢 ENHANCED: Try to get from cache first
    const cachedProducts = await getCachedProductsList(cacheKey);
    if (cachedProducts) {
      console.log('✅ Serving category products from local cache:', category);
      
      // Update hot products cache
      cachedProducts.forEach(product => {
        if (product.id) updateHotProductsCache(product.id).catch(console.error);
      });
      
      return cachedProducts;
    }

    const q = query(
      collection(db, 'products'), 
      where('category', '==', category),
      where('isActive', '==', true),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    const products = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      _cachedAt: Date.now(),
      _cacheVersion: '1.0'
    })) as Product[];

    // 🟢 ENHANCED: Cache the category results locally
    await cacheProductsList(products, cacheKey);
    
    // Update hot products cache
    products.forEach(product => {
      if (product.id) updateHotProductsCache(product.id).catch(console.error);
    });

    return products;
  } catch (error: any) {
    console.error('Error getting products by category:', error);
    return []; // Graceful degradation
  }
};

// Search products by name - ENHANCED with caching
export const searchProducts = async (searchTerm: string): Promise<Product[]> => {
  try {
    // Check rate limit for search
    const ip = 'server';
    if (await checkApiRateLimit(ip, 'search')) {
      throw new Error('Too many search requests. Please try again later.');
    }
    
    // Try cache for search results (short TTL since searches vary)
    const cacheKey = `search:${searchTerm.toLowerCase()}`;
    const cached = productCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < SHORT_CACHE_TTL) {
      console.log('✅ Serving search results from cache:', searchTerm);
      return cached.data as Product[];
    }
    
    const allProducts = await getProducts();
    
    // Filter products
    const results = allProducts.filter(product => 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.farmName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.tags && product.tags.some(tag => 
        tag.toLowerCase().includes(searchTerm.toLowerCase())
      ))
    );
    
    // Cache search results for 5 minutes
    productCache.set(cacheKey, {
      data: results,
      timestamp: Date.now()
    });
    
    return results;
  } catch (error: any) {
    console.error('Error searching products:', error);
    return [];
  }
};

// 🟢 ADDED: Get products by tags
export const getProductsByTags = async (tags: string[]): Promise<Product[]> => {
  try {
    const cacheKey = `products:tags:${tags.sort().join(',')}`;
    
    // Try cache first
    const cached = productCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      console.log('✅ Serving tag-based products from cache:', tags);
      return cached.data as Product[];
    }
    
    const allProducts = await getProducts();
    
    // Filter products that have at least one of the specified tags
    const results = allProducts.filter(product => 
      product.tags && product.tags.some(tag => 
        tags.includes(tag)
      )
    );
    
    // Cache for 15 minutes
    productCache.set(cacheKey, {
      data: results,
      timestamp: Date.now()
    });
    
    return results;
  } catch (error: any) {
    console.error('Error getting products by tags:', error);
    return [];
  }
};

// 🟢 ADDED: Function to update product pricing with actual distance
export const updateProductPricingWithDistance = async (
  productId: string,
  userLocation: { lat: number; lng: number },
  farmerLocation: { lat: number; lng: number },
  farmerBarangay: string
): Promise<PriceCalculation> => {
  try {
    const docRef = doc(db, "products", productId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      throw new Error('Product not found');
    }

    const product = docSnap.data() as Product;
    
    // Calculate actual distance
    const distance = PricingCalculator.calculateDistance(
      userLocation.lat,
      userLocation.lng,
      farmerLocation.lat,
      farmerLocation.lng
    );
    
    // Calculate shipping with actual distance
    const shipping = PricingCalculator.calculateShipping(
      distance,
      farmerBarangay,
      'motorcycle'
    );
    
    // Recalculate complete price breakdown
    const priceBreakdown = PricingCalculator.calculateProductPricing(
      product.farmerPrice || product.price || 0,
      product.category,
      product.unit,
      shipping
    );

    // Update product with new pricing
    await updateDoc(docRef, {
      estimatedDistance: distance,
      shippingFee: shipping.total,
      estimatedDeliveryTime: shipping.estimatedTime,
      priceBreakdown: priceBreakdown,
      marketPrice: priceBreakdown.marketPrice,
      platformFee: priceBreakdown.platformFee,
      vatAmount: priceBreakdown.vatAmount,
      finalPrice: priceBreakdown.finalPrice,
      updatedAt: serverTimestamp()
    });

    console.log('✅ Product pricing updated with actual distance:', {
      productId,
      distance: `${distance.toFixed(1)} km`,
      shippingFee: shipping.total,
      finalPrice: priceBreakdown.finalPrice
    });

    // 🟢 ENHANCED: Update cache with new pricing
    const cachedProduct = await getCachedProduct(productId);
    if (cachedProduct) {
      cachedProduct.estimatedDistance = distance;
      cachedProduct.shippingFee = shipping.total;
      cachedProduct.estimatedDeliveryTime = shipping.estimatedTime;
      cachedProduct.priceBreakdown = priceBreakdown;
      cachedProduct.marketPrice = priceBreakdown.marketPrice;
      cachedProduct.platformFee = priceBreakdown.platformFee;
      cachedProduct.vatAmount = priceBreakdown.vatAmount;
      cachedProduct.finalPrice = priceBreakdown.finalPrice;
      cachedProduct._cachedAt = Date.now();
      await cacheProduct(cachedProduct);
    }

    return priceBreakdown;
  } catch (error: any) {
    console.error('❌ Error updating product pricing with distance:', error);
    throw new Error(`Failed to update product pricing: ${error.message}`);
  }
};

// 🟢 ADDED: Function to validate and update farmer price
export const validateAndUpdateFarmerPrice = async (
  productId: string,
  newFarmerPrice: number
): Promise<{ isValid: boolean; suggestion?: number; reason: string; priceBreakdown?: PriceCalculation }> => {
  try {
    const docRef = doc(db, "products", productId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      throw new Error('Product not found');
    }

    const product = docSnap.data() as Product;
    
    // Validate the new price
    const validation = PricingCalculator.validateFarmerPrice(
      newFarmerPrice,
      product.category,
      product.unit
    );

    if (validation.isValid) {
      // Get current shipping data
      const shipping: ShippingCalculation = {
        distance: product.estimatedDistance || 5,
        baseRate: product.shippingBaseRate || 20,
        ratePerKm: product.shippingRatePerKm || 5,
        estimatedTime: product.estimatedDeliveryTime || '30-45 min',
        total: product.shippingFee || 45
      };

      // Recalculate price breakdown
      const priceBreakdown = PricingCalculator.calculateProductPricing(
        newFarmerPrice,
        product.category,
        product.unit,
        shipping
      );

      // Update the product
      await updateDoc(docRef, {
        farmerPrice: newFarmerPrice,
        priceBreakdown: priceBreakdown,
        marketPrice: priceBreakdown.marketPrice,
        platformFee: priceBreakdown.platformFee,
        vatAmount: priceBreakdown.vatAmount,
        finalPrice: priceBreakdown.finalPrice,
        updatedAt: serverTimestamp()
      });

      // 🟢 ENHANCED: Update cache with new price
      const cachedProduct = await getCachedProduct(productId);
      if (cachedProduct) {
        cachedProduct.farmerPrice = newFarmerPrice;
        cachedProduct.priceBreakdown = priceBreakdown;
        cachedProduct.marketPrice = priceBreakdown.marketPrice;
        cachedProduct.platformFee = priceBreakdown.platformFee;
        cachedProduct.vatAmount = priceBreakdown.vatAmount;
        cachedProduct.finalPrice = priceBreakdown.finalPrice;
        cachedProduct._cachedAt = Date.now();
        await cacheProduct(cachedProduct);
      }

      return {
        isValid: true,
        reason: validation.reason,
        priceBreakdown: priceBreakdown
      };
    }

    return validation;
  } catch (error: any) {
    console.error('❌ Error validating farmer price:', error);
    throw new Error(`Failed to validate farmer price: ${error.message}`);
  }
};

// ✅ ADDED: MOQ Validation Helper Functions
export const validateMOQ = (product: Product, quantity: number): { isValid: boolean; message: string } => {
  const moq = product.minimumOrderQuantity || 1;
  
  if (quantity < moq) {
    return {
      isValid: false,
      message: `Minimum order quantity for ${product.name} is ${moq} ${product.unit}.`
    };
  }
  
  return {
    isValid: true,
    message: `Quantity meets minimum order requirement.`
  };
};

export const validateCartItemsMOQ = (cartItems: Array<{ product: Product; quantity: number }>): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  cartItems.forEach(item => {
    const validation = validateMOQ(item.product, item.quantity);
    if (!validation.isValid) {
      errors.push(validation.message);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// 🟢 ADDED: Cache statistics
export const getCacheStats = async (): Promise<{
  totalProducts: number;
  cachedProducts: number;
  hitRate: number;
  memoryUsage: string;
}> => {
  try {
    const productKeys = Array.from(productCache.keys()).filter(key => 
      key.startsWith('product:') && !key.includes(':views:')
    );
    
    return {
      totalProducts: productKeys.length,
      cachedProducts: productKeys.length,
      hitRate: 0, // Simple implementation doesn't track hits/misses
      memoryUsage: 'Local cache'
    };
  } catch (error) {
    console.log('⚠️ Failed to get cache stats:', error);
    return {
      totalProducts: 0,
      cachedProducts: 0,
      hitRate: 0,
      memoryUsage: 'Unknown'
    };
  }
};

// 🟢 ADDED: Clear all product caches
export const clearAllProductCaches = async (): Promise<void> => {
  try {
    const keys = Array.from(productCache.keys());
    keys.forEach(key => productCache.delete(key));
    console.log(`🧹 Cleared ${keys.length} cache keys`);
  } catch (error) {
    console.log('⚠️ Failed to clear product caches:', error);
  }
};