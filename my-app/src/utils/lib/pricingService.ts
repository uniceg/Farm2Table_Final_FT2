import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "./firebase";

export interface MarketPriceData {
  averagePrice: number;
  priceRange: {
    min: number;
    max: number;
  };
  source: 'platform_history' | 'manual_research' | 'farmer_input';
}

export interface PriceCalculation {
  marketPrice: number;
  farmerMarkup: number;
  platformFee: number;
  shippingFee: number;
  vatAmount: number;
  subtotal: number;
  finalPrice: number;
  // 🟢 ADDED: DTI-compliant breakdown for transparency
  breakdown?: {
    productPrice: number;
    platformFeeWithVat: number;
    shippingFee: number;
    vatOnProduct: number;
    vatOnPlatformFee: number;
    subtotalBeforeVat: number;
    totalVat: number;
    grandTotal: number;
  };
}

export interface ShippingCalculation {
  distance: number;
  baseRate: number;
  ratePerKm: number;
  estimatedTime: string;
  total: number;
}

export class PricingService {
  // Calculate market-based price
  static calculateMarketBasedPrice(
    category: string,
    unit: string,
    quality: 'premium' | 'standard' | 'economy' = 'standard'
  ): MarketPriceData {
    
    const priceBenchmarks: { [key: string]: { standard: number, range: { min: number, max: number } } } = {
      'vegetables': { standard: 60, range: { min: 40, max: 120 } },
      'fruits': { standard: 80, range: { min: 50, max: 150 } },
      'rice': { standard: 45, range: { min: 35, max: 80 } },
      'grains': { standard: 50, range: { min: 30, max: 90 } },
      'poultry': { standard: 160, range: { min: 120, max: 220 } },
      'livestock': { standard: 200, range: { min: 150, max: 300 } },
      'seafood': { standard: 180, range: { min: 120, max: 250 } },
      'herbs': { standard: 100, range: { min: 70, max: 180 } }
    };

    const benchmark = priceBenchmarks[category] || priceBenchmarks['vegetables'];
    let basePrice = benchmark.standard;
    
    if (quality === 'premium') basePrice *= 1.3;
    if (quality === 'economy') basePrice *= 0.8;
    
    return {
      averagePrice: Math.round(basePrice),
      priceRange: benchmark.range,
      source: 'platform_history'
    };
  }

  // Get actual average prices from Firestore
  static async getPlatformAveragePrice(category: string): Promise<number> {
    try {
      const salesQuery = query(
        collection(db, "products"),
        where("category", "==", category),
        where("status", "==", "active"),
        where("price", ">", 0)
      );
      
      const snapshot = await getDocs(salesQuery);
      if (snapshot.empty) {
        // 🟢 FIXED: Provide default unit when calling calculateMarketBasedPrice
        return this.calculateMarketBasedPrice(category, 'kg').averagePrice;
      }
      
      const prices = snapshot.docs.map(doc => doc.data().price).filter(Boolean);
      const average = prices.reduce((sum, price) => sum + price, 0) / prices.length;
      
      return Math.round(average);
    } catch (error) {
      console.error("Error getting platform average price:", error);
      // 🟢 FIXED: Provide default unit when calling calculateMarketBasedPrice
      return this.calculateMarketBasedPrice(category, 'kg').averagePrice;
    }
  }
}

export class PricingCalculator {
  // 🟢 DTI-COMPLIANT: Calculate complete price breakdown
  // VAT applied ONLY to product + platform fee (NOT shipping)
  static calculateProductPricing(
    farmerInputPrice: number,
    category: string,
    unit: string,
    shippingCalculation: ShippingCalculation,
    platformFeePercentage: number = 0.05
  ): PriceCalculation {
    
    const marketPrice = this.calculateMarketPrice(category, unit, farmerInputPrice);
    const farmerMarkup = Math.max(0, farmerInputPrice - marketPrice);
    const platformFee = farmerInputPrice * platformFeePercentage;
    
    // 🟢 DTI-COMPLIANT: VAT on product + platform fee ONLY
    // Shipping is VAT-exempt per DTI/BIR regulations
    const subtotalBeforeVat = farmerInputPrice + platformFee;
    const vatAmount = subtotalBeforeVat * 0.12;
    
    // Shipping is VAT-exempt
    const shippingFee = shippingCalculation.total;
    
    const subtotal = farmerInputPrice + platformFee + shippingFee;
    const finalPrice = subtotal + vatAmount;

    // 🟢 DTI-compliant detailed breakdown
    const vatOnProduct = farmerInputPrice * 0.12;
    const vatOnPlatformFee = platformFee * 0.12;
    const platformFeeWithVat = parseFloat((platformFee * 1.12).toFixed(2));

    return {
      marketPrice,
      farmerMarkup,
      platformFee: parseFloat(platformFee.toFixed(2)),
      shippingFee: shippingFee,
      vatAmount: parseFloat(vatAmount.toFixed(2)),
      subtotal: parseFloat(subtotal.toFixed(2)),
      finalPrice: parseFloat(finalPrice.toFixed(2)),
      // Detailed DTI-compliant breakdown
      breakdown: {
        productPrice: farmerInputPrice,
        platformFeeWithVat: platformFeeWithVat,
        shippingFee: shippingFee,
        vatOnProduct: parseFloat(vatOnProduct.toFixed(2)),
        vatOnPlatformFee: parseFloat(vatOnPlatformFee.toFixed(2)),
        subtotalBeforeVat: parseFloat(subtotalBeforeVat.toFixed(2)),
        totalVat: parseFloat(vatAmount.toFixed(2)),
        grandTotal: parseFloat(finalPrice.toFixed(2))
      }
    };
  }

  private static calculateMarketPrice(
    category: string, 
    unit: string, 
    farmerPrice: number
  ): number {
    // 🟢 FIXED: Pass both category and unit to calculateMarketBasedPrice
    const marketData = PricingService.calculateMarketBasedPrice(category, unit);
    const validation = this.validateFarmerPrice(farmerPrice, category, unit);
    return validation.isValid ? farmerPrice : marketData.averagePrice;
  }

  static validateFarmerPrice(
    farmerPrice: number,
    category: string,
    unit: string
  ): { isValid: boolean; suggestion?: number; reason: string } {
    
    // 🟢 FIXED: Pass both category and unit to calculateMarketBasedPrice
    const marketData = PricingService.calculateMarketBasedPrice(category, unit);
    const marketAverage = marketData.averagePrice;
    const minAllowed = marketAverage * 0.6;
    const maxAllowed = marketAverage * 1.4;
    
    if (farmerPrice < minAllowed) {
      return {
        isValid: false,
        suggestion: minAllowed,
        reason: `Price is below market average. Suggested: ₱${minAllowed}`
      };
    }
    
    if (farmerPrice > maxAllowed) {
      return {
        isValid: false,
        suggestion: maxAllowed,
        reason: `Price exceeds market average. Suggested: ₱${maxAllowed}`
      };
    }
    
    return {
      isValid: true,
      reason: "Price is within market range"
    };
  }

  // Calculate shipping with Philippine context
  static calculateShipping(
    distance: number,
    barangay: string,
    vehicleType: 'motorcycle' | 'tricycle' | 'van' = 'motorcycle'
  ): ShippingCalculation {
    
    const baseRates = {
      motorcycle: 20,
      tricycle: 30,
      van: 50
    };
    
    const kmRates = {
      motorcycle: 5,
      tricycle: 7,
      van: 10
    };
    
    const baseRate = baseRates[vehicleType];
    const ratePerKm = kmRates[vehicleType];
    const total = baseRate + (distance * ratePerKm);
    const estimatedTime = this.estimateDeliveryTime(distance, barangay);

    return {
      distance,
      baseRate,
      ratePerKm,
      estimatedTime,
      total: Math.round(total)
    };
  }

  private static estimateDeliveryTime(distance: number, barangay: string): string {
    if (distance <= 2) return "15-25 min";
    if (distance <= 5) return "25-40 min";
    if (distance <= 10) return "40-60 min";
    return "1-2 hours";
  }

  // Calculate distance between coordinates (Haversine formula)
  static calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return parseFloat((R * c).toFixed(2));
  }

  // 🟢 ADDED: Generate DTI-compliant price breakdown display
  static generateDTIPriceBreakdown(priceCalculation: PriceCalculation): string {
    const { breakdown } = priceCalculation;
    
    if (!breakdown) {
      return `
Product Price: ₱${priceCalculation.marketPrice.toFixed(2)}
Platform Fee (5%): ₱${priceCalculation.platformFee.toFixed(2)}
Shipping Fee: ₱${priceCalculation.shippingFee.toFixed(2)}
VAT (12%): ₱${priceCalculation.vatAmount.toFixed(2)}
Total: ₱${priceCalculation.finalPrice.toFixed(2)}
      `.trim();
    }
    
    return `
Product Price: ₱${breakdown.productPrice.toFixed(2)}
Platform Fee (${priceCalculation.platformFee / breakdown.productPrice * 100}%): ₱${breakdown.platformFeeWithVat.toFixed(2)} (incl. VAT)
Shipping Fee: ₱${breakdown.shippingFee.toFixed(2)} (VAT-exempt)
VAT Breakdown:
  - On Product: ₱${breakdown.vatOnProduct.toFixed(2)}
  - On Platform Fee: ₱${breakdown.vatOnPlatformFee.toFixed(2)}
Total VAT (12%): ₱${breakdown.totalVat.toFixed(2)}
Grand Total: ₱${breakdown.grandTotal.toFixed(2)}
    `.trim();
  }

  // 🟢 ADDED: Calculate DTI-compliant total for cart/checkout
  static calculateDTICompliantTotal(
    productPrice: number,
    platformFee: number,
    shippingFee: number
  ): { subtotal: number; vat: number; total: number } {
    // VAT on product + platform fee only (not shipping)
    const taxableAmount = productPrice + platformFee;
    const vat = taxableAmount * 0.12;
    const total = productPrice + platformFee + shippingFee + vat;
    
    return {
      subtotal: parseFloat((productPrice + platformFee + shippingFee).toFixed(2)),
      vat: parseFloat(vat.toFixed(2)),
      total: parseFloat(total.toFixed(2))
    };
  }

  // 🟢 ADDED: Check if price is DTI-compliant
  static isPriceDTICompliant(
    productPrice: number,
    platformFee: number,
    shippingFee: number,
    vatAmount: number
  ): { isCompliant: boolean; reason: string; expectedVat: number } {
    // DTI-compliant: VAT should be 12% of (productPrice + platformFee)
    const expectedVat = (productPrice + platformFee) * 0.12;
    const vatDifference = Math.abs(vatAmount - expectedVat);
    const isCompliant = vatDifference < 0.01; // Allow small rounding differences
    
    if (isCompliant) {
      return {
        isCompliant: true,
        reason: "Price structure follows DTI regulations (VAT on product + platform fee only)",
        expectedVat: parseFloat(expectedVat.toFixed(2))
      };
    } else {
      return {
        isCompliant: false,
        reason: `VAT should be ₱${expectedVat.toFixed(2)} (12% of ₱${(productPrice + platformFee).toFixed(2)}) not ₱${vatAmount.toFixed(2)}`,
        expectedVat: parseFloat(expectedVat.toFixed(2))
      };
    }
  }

  // 🟢 ADDED: Test function to verify DTI compliance
  static testDTICompliance(): void {
    console.log("=== DTI Compliance Test ===");
    
    // Test with your example: ₱150 product, 2% platform fee, ₱35 shipping
    const productPrice = 150;
    const platformFeePercentage = 0.02;
    const platformFee = productPrice * platformFeePercentage; // ₱3
    const shippingFee = 35;
    
    // Wrong calculation (your current output)
    const wrongVat = (productPrice + platformFee + shippingFee) * 0.12;
    const wrongTotal = productPrice + platformFee + shippingFee + wrongVat;
    
    // Correct DTI calculation
    const correctVat = (productPrice + platformFee) * 0.12;
    const correctTotal = productPrice + platformFee + shippingFee + correctVat;
    
    console.log("Product Price: ₱" + productPrice.toFixed(2));
    console.log("Platform Fee (" + (platformFeePercentage * 100) + "%): ₱" + platformFee.toFixed(2));
    console.log("Shipping Fee: ₱" + shippingFee.toFixed(2));
    console.log("\n❌ WRONG (VAT on everything):");
    console.log("  VAT (12%): ₱" + wrongVat.toFixed(2));
    console.log("  Total: ₱" + wrongTotal.toFixed(2));
    console.log("\n✅ CORRECT (DTI-compliant):");
    console.log("  VAT (12% on ₱" + (productPrice + platformFee).toFixed(2) + " only): ₱" + correctVat.toFixed(2));
    console.log("  Total: ₱" + correctTotal.toFixed(2));
    console.log("\nDifference: ₱" + (wrongTotal - correctTotal).toFixed(2) + " (buyer overcharged!)");
    
    // Test the compliance check
    const complianceCheck = this.isPriceDTICompliant(productPrice, platformFee, shippingFee, wrongVat);
    console.log("\nCompliance Check:");
    console.log("Is compliant?", complianceCheck.isCompliant);
    console.log("Reason:", complianceCheck.reason);
  }
}