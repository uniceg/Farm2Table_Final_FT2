'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import styles from './feed.module.css';
import FeedHeader from './components/FeedHeader/FeedHeader';
import FarmDescription from './components/FarmDescription/FarmDescription';
import Gallery from './components/Gallery/Gallery';
import FeaturedProducts from './components/FeaturedProducts/FeaturedProducts';
import FarmerProfiles from './components/FarmerProfiles/FarmerProfiles';
import EditModal from './components/EditModal/EditModal';
// Firebase imports
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../../../utils/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
// TypeScript interfaces
interface Farmer {
  id: string;
  name: string;
  role: string;
  bio: string;
  photo: string;
}
interface SellerData {
  id: string;
  farmName: string;
  logo: string;
  coverPhoto: string;
  location: string;
  description: string;
  rating: number;
  followerCount: number;
  isVerified: boolean;
  gallery: string[];
  featuredProducts: any[];
  farmers: Farmer[];
  sellerId?: string;
}
interface FeedProps {
  viewerRole?: 'seller' | 'buyer';
  farmId?: string;
}
// Default data structure with proper typing
const defaultSellerData: SellerData = {
  id: '',
  farmName: 'Loading Farm...',
  logo: '/api/placeholder/100/100',
  coverPhoto: '/api/placeholder/1200/400',
  location: 'Loading location...',
  description: 'Loading farm description...',
  rating: 0,
  followerCount: 0,
  isVerified: false,
  gallery: [],
  featuredProducts: [],
  farmers: []
};

// Helper function to get verification status from Firestore data
const getVerificationStatus = (firestoreData: any): boolean => {
  // Check if idVerification exists and status is 'approved'
  if (firestoreData.idVerification?.status === 'approved') {
    return true;
  }
  // Fallback to the old isVerified field for backward compatibility
  if (firestoreData.isVerified !== undefined) {
    return firestoreData.isVerified;
  }
  // Default to false if no verification data found
  return false;
};

export default function Feed({ viewerRole = 'seller', farmId }: FeedProps) {
  const params = useParams();
  const [sellerData, setSellerData] = useState<SellerData>(defaultSellerData);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // Determine if we're in buyer view
  const isBuyerView = viewerRole === 'buyer';
  const targetFarmId = farmId || (isBuyerView ? params.farmId as string : undefined);
  
  // Helper function to format location from address fields
  const formatLocation = (address: any): string => {
    if (!address) return 'Add your location';
    
    const parts = [
      address.barangay,
      address.city, 
      address.province,
      address.region
    ].filter(part => part && part.trim() !== '');
    
    return parts.join(', ') || 'Add your location';
  };
  
  // Helper function to format farmers array from seller data
  const formatFarmers = (firestoreData: any): Farmer[] => {
    // Create farmer profile from the main seller
    const mainFarmer: Farmer = {
      id: '1',
      name: firestoreData.fullName || 'Farm Owner',
      role: 'Farm Owner',
      bio: firestoreData.farm?.description || 'Passionate about sustainable farming.',
      photo: '/images/farmer1.jpg'
    };
    return [mainFarmer];
  };
  
  // Fetch seller's own data from Firestore (for seller view)
  const fetchSellerData = async (user: any) => {
    try {
      setLoading(true);
      const sellerDoc = await getDoc(doc(db, 'sellers', user.uid));
      
      if (sellerDoc.exists()) {
        const firestoreData = sellerDoc.data();
        
        console.log('📥 Fetched Firestore data:', firestoreData);
        
        // Transform Firestore data to match your component structure
        const transformedData: SellerData = {
          id: user.uid,
          farmName: firestoreData.farmName || firestoreData.farm?.farmName || 'Your Farm',
          logo: firestoreData.logo || firestoreData.farm?.logo || '/api/placeholder/100/100',
          coverPhoto: firestoreData.coverPhoto || '/api/placeholder/1200/400',
          location: firestoreData.location || formatLocation(firestoreData.address),
          description: firestoreData.description || firestoreData.farm?.description || 'Tell your farm story...',
          rating: firestoreData.rating || 4.8,
          followerCount: firestoreData.followerCount || 0,
          // ✅ FIXED: Use helper function to check verification status
          isVerified: getVerificationStatus(firestoreData),
          gallery: firestoreData.gallery || [],
          featuredProducts: firestoreData.featuredProducts || [],
          farmers: firestoreData.farmers || formatFarmers(firestoreData)
        };
        
        console.log('🔄 Transformed data:', transformedData);
        setSellerData(transformedData);
      } else {
        console.log('❌ No seller profile found');
        setError('No seller profile found. Please complete your profile.');
      }
    } catch (err) {
      console.error('Error fetching seller data:', err);
      setError('Failed to load farm profile.');
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch farm data for buyer view
  const fetchFarmData = async (farmSellerId: string) => {
    try {
      setLoading(true);
      const sellerDoc = await getDoc(doc(db, 'sellers', farmSellerId));
      
      if (sellerDoc.exists()) {
        const firestoreData = sellerDoc.data();
        
        console.log('📥 Fetched Farm data for buyer:', firestoreData);
        
        // Transform Firestore data for buyer view
        const transformedData: SellerData = {
          id: farmSellerId,
          sellerId: farmSellerId,
          farmName: firestoreData.farmName || firestoreData.farm?.farmName || 'Farm',
          logo: firestoreData.logo || firestoreData.farm?.logo || '/api/placeholder/100/100',
          coverPhoto: firestoreData.coverPhoto || '/api/placeholder/1200/400',
          location: firestoreData.location || formatLocation(firestoreData.address),
          description: firestoreData.description || firestoreData.farm?.description || 'Farm description...',
          rating: firestoreData.rating || 0,
          followerCount: firestoreData.followerCount || 0,
          // ✅ FIXED: Use helper function to check verification status
          isVerified: getVerificationStatus(firestoreData),
          gallery: firestoreData.gallery || [],
          featuredProducts: firestoreData.featuredProducts || [],
          farmers: firestoreData.farmers || formatFarmers(firestoreData)
        };
        
        console.log('🔄 Transformed farm data for buyer:', transformedData);
        setSellerData(transformedData);
      } else {
        console.log('❌ Farm not found');
        setError('Farm not found.');
      }
    } catch (err) {
      console.error('Error fetching farm data:', err);
      setError('Failed to load farm profile.');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    if (isBuyerView && targetFarmId) {
      // Buyer view - fetch specific farm's data
      fetchFarmData(targetFarmId);
    } else {
      // Seller view - fetch their own data
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
          setCurrentUserId(user.uid);
          await fetchSellerData(user);
        } else {
          setError('Please sign in to view your farm profile.');
          setLoading(false);
        }
      });
      return () => unsubscribe();
    }
  }, [isBuyerView, targetFarmId]);
  
  const toggleEditMode = () => {
    setIsEditModalOpen(true);
  };
  
  // FIXED: Properly update seller data and refetch from Firestore
  const updateSellerData = async (newData: SellerData) => {
    console.log('💾 Updating seller data:', newData);
    
    // Immediately update local state for better UX
    setSellerData(newData);
    
    // Also refetch from Firestore to ensure consistency
    const currentUser = auth.currentUser;
    if (currentUser) {
      await fetchSellerData(currentUser);
    }
  };
  
  if (loading) {
    return (
      <div className={styles.feedPage}>
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner}></div>
          <p>
            {isBuyerView ? 'Loading farm profile...' : 'Loading your farm profile...'}
          </p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className={styles.feedPage}>
        <div className={styles.errorContainer}>
          <div className={styles.errorIcon}>⚠️</div>
          <h3>Unable to load profile</h3>
          <p>{error}</p>
          <button 
            className={styles.retryButton}
            onClick={() => window.location.reload()}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className={styles.feedPage}>
      {/* Feed Container */}
      <div className={styles.feedContainer}>
        {/* Edit Mode button at top right */}
        {!isBuyerView && (
          <div className={styles.editModeContainer}>
            <button 
              className={styles.editModeButton}
              onClick={toggleEditMode}
            >
              Edit Mode
            </button>
          </div>
        )}
        <FeedHeader 
          profile={sellerData} 
          viewerRole={viewerRole}
          currentUserId={currentUserId}
          profileOwnerId={sellerData.id}
        />
        
        <FeaturedProducts 
          viewerRole={viewerRole}
          farmId={isBuyerView ? sellerData.id : undefined}
        />
        
        <FarmDescription 
          description={sellerData.description} 
          viewerRole={viewerRole}
        />
        
        <Gallery 
          images={sellerData.gallery} 
          viewerRole={viewerRole}
          currentUserId={currentUserId}
          profileOwnerId={sellerData.id}
        />
        
        {/* Farmers Section */}
        <div className={styles.farmersSection}>
          <FarmerProfiles 
            farmers={sellerData.farmers} 
            viewerRole={viewerRole}
          />
        </div>
      </div>
      
      {/* Edit Modal - Only for sellers */}
      {!isBuyerView && (
        <EditModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          sellerData={sellerData}
          onSave={updateSellerData}
        />
      )}
    </div>
  );
}