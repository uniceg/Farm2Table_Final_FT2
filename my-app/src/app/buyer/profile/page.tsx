"use client";
import { useState, useRef, useEffect } from "react";
import styles from "./profile.module.css";
import { Camera, Edit2, Loader2 } from "lucide-react";
import { 
  getUserProfile, 
  updateUserProfile, 
  updateProfilePicture, 
  getOptimizedImageUrl
} from "../../../utils/lib/profileService";
import { auth } from "../../../utils/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

// Default avatar as base64 SVG to ensure it always loads
const DEFAULT_AVATAR_SVG = `data:image/svg+xml;base64,${btoa(`
  <svg width="200" height="200" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="100" cy="100" r="100" fill="#E5E7EB"/>
    <circle cx="100" cy="80" r="40" fill="#9CA3AF"/>
    <path d="M100 140 C60 140 40 180 40 200 L160 200 C160 180 140 140 100 140Z" fill="#9CA3AF"/>
  </svg>
`)}`;

// Philippine address data (same as signup)
const philippineRegions = [
  { region: "Region III - Central Luzon", region_code: "030000000" }
];

const regionIIIProvinces = [
  { province: "Zambales", province_code: "037100000" }
];

// Cities and Municipalities in Zambales - FIXED DATA STRUCTURE
const zambalesCitiesMunicipalities = [
  { city: "Olongapo City", city_code: "037109000" },
  { city: "Botolan", city_code: "037101000" },
  { city: "Cabangan", city_code: "037102000" },
  { city: "Candelaria", city_code: "037103000" },
  { city: "Castillejos", city_code: "037104000" },
  { city: "Iba", city_code: "037105000" },
  { city: "Masinloc", city_code: "037106000" },
  { city: "Palauig", city_code: "037107000" },
  { city: "San Antonio", city_code: "037108000" },
  { city: "San Felipe", city_code: "037110000" },
  { city: "San Marcelino", city_code: "037111000" },
  { city: "San Narciso", city_code: "037112000" },
  { city: "Santa Cruz", city_code: "037113000" },
  { city: "Subic", city_code: "037114000" }
];
// BARANGAYS DATA FOR ZAMBALES
const zambalesBarangays = {
  // Olongapo City
  "037109000": [
    { brgy: "Asinan", brgy_code: "037109001" },
    { brgy: "Banicain", brgy_code: "037109002" },
    { brgy: "Barreto", brgy_code: "037109003" },
    { brgy: "East Bajac-bajac", brgy_code: "037109004" },
    { brgy: "East Tapinac", brgy_code: "037109005" },
    { brgy: "Gordon Heights", brgy_code: "037109006" },
    { brgy: "Kalaklan", brgy_code: "037109007" },
    { brgy: "Mabayuan", brgy_code: "037109008" },
    { brgy: "New Cabalan", brgy_code: "037109009" },
    { brgy: "New Ilalim", brgy_code: "037109010" },
    { brgy: "New Kababae", brgy_code: "037109011" },
    { brgy: "New Kalalake", brgy_code: "037109012" },
    { brgy: "Old Cabalan", brgy_code: "037109013" },
    { brgy: "Pag-asa", brgy_code: "037109014" },
    { brgy: "Santa Rita", brgy_code: "037109015" },
    { brgy: "West Bajac-bajac", brgy_code: "037109016" },
    { brgy: "West Tapinac", brgy_code: "037109017" }
  ],
  // Botolan
  "037101000": [
    { brgy: "Bangan", brgy_code: "037101001" },
    { brgy: "Batolilan", brgy_code: "037101002" },
    { brgy: "Beneg", brgy_code: "037101003" },
    { brgy: "Binuclutan", brgy_code: "037101004" },
    { brgy: "Burgos", brgy_code: "037101005" },
    { brgy: "Cabatuan", brgy_code: "037101006" },
    { brgy: "Capayawan", brgy_code: "037101007" },
    { brgy: "Carael", brgy_code: "037101008" },
    { brgy: "Danacbunga", brgy_code: "037101009" },
    { brgy: "Maguisguis", brgy_code: "037101010" },
    { brgy: "Malomboy", brgy_code: "037101011" },
    { brgy: "Mambog", brgy_code: "037101012" },
    { brgy: "Moraza", brgy_code: "037101013" },
    { brgy: "Nacolcol", brgy_code: "037101014" },
    { brgy: "Owaog-Nebloc", brgy_code: "037101015" },
    { brgy: "Paco", brgy_code: "037101016" },
    { brgy: "Palis", brgy_code: "037101017" },
    { brgy: "Panan", brgy_code: "037101018" },
    { brgy: "Poblacion", brgy_code: "037101019" },
    { brgy: "Porac", brgy_code: "037101020" },
    { brgy: "San Juan", brgy_code: "037101021" },
    { brgy: "San Miguel", brgy_code: "037101022" },
    { brgy: "Santiago", brgy_code: "037101023" },
    { brgy: "Tampo", brgy_code: "037101024" },
    { brgy: "Taugtog", brgy_code: "037101025" },
    { brgy: "Villat", brgy_code: "037101026" }
  ],
  // Cabangan
  "037102000": [
    { brgy: "Anonang", brgy_code: "037102001" },
    { brgy: "Apo-apo", brgy_code: "037102002" },
    { brgy: "Arew", brgy_code: "037102003" },
    { brgy: "Banuan", brgy_code: "037102004" },
    { brgy: "Cadmang-Reserva", brgy_code: "037102005" },
    { brgy: "Camiling", brgy_code: "037102006" },
    { brgy: "Casabaan", brgy_code: "037102007" },
    { brgy: "Dolores", brgy_code: "037102008" },
    { brgy: "Felmida-Diaz", brgy_code: "037102009" },
    { brgy: "Laoag", brgy_code: "037102010" },
    { brgy: "Lomboy", brgy_code: "037102011" },
    { brgy: "Longos", brgy_code: "037102012" },
    { brgy: "Mabanglit", brgy_code: "037102013" },
    { brgy: "New San Juan", brgy_code: "037102014" },
    { brgy: "San Isidro", brgy_code: "037102015" },
    { brgy: "Santa Rita", brgy_code: "037102016" },
    { brgy: "Tondo", brgy_code: "037102017" }
  ],
  // Candelaria
  "037103000": [
    { brgy: "Babancal", brgy_code: "037103001" },
    { brgy: "Binabalian", brgy_code: "037103002" },
    { brgy: "Catol", brgy_code: "037103003" },
    { brgy: "Dampay", brgy_code: "037103004" },
    { brgy: "Lauis", brgy_code: "037103005" },
    { brgy: "Libertador", brgy_code: "037103006" },
    { brgy: "Malabon", brgy_code: "037103007" },
    { brgy: "Malimanga", brgy_code: "037103008" },
    { brgy: "Pamibian", brgy_code: "037103009" },
    { brgy: "Panayonan", brgy_code: "037103010" },
    { brgy: "Pinagrealan", brgy_code: "037103011" },
    { brgy: "Poblacion", brgy_code: "037103012" },
    { brgy: "Sinabacan", brgy_code: "037103013" },
    { brgy: "Taposo", brgy_code: "037103014" },
    { brgy: "Uacon", brgy_code: "037103015" }
  ],
  // Castillejos
  "037104000": [
    { brgy: "Balaybay", brgy_code: "037104001" },
    { brgy: "Buengay", brgy_code: "037104002" },
    { brgy: "Del Pilar", brgy_code: "037104003" },
    { brgy: "Looc", brgy_code: "037104004" },
    { brgy: "Magsaysay", brgy_code: "037104005" },
    { brgy: "Nagbayan", brgy_code: "037104006" },
    { brgy: "Nagbunga", brgy_code: "037104007" },
    { brgy: "San Agustin", brgy_code: "037104008" },
    { brgy: "San Jose", brgy_code: "037104009" },
    { brgy: "San Juan", brgy_code: "037104010" },
    { brgy: "San Nicolas", brgy_code: "037104011" },
    { brgy: "San Pablo", brgy_code: "037104012" },
    { brgy: "San Roque", brgy_code: "037104013" },
    { brgy: "Santa Maria", brgy_code: "037104014" }
  ],
  // Iba
  "037105000": [
    { brgy: "Amungan", brgy_code: "037105001" },
    { brgy: "Bangantalinga", brgy_code: "037105002" },
    { brgy: "Dirita-Baloguen", brgy_code: "037105003" },
    { brgy: "Lipay-Dingin-Panibuatan", brgy_code: "037105004" },
    { brgy: "Palanginan", brgy_code: "037105005" },
    { brgy: "San Agustin", brgy_code: "037105006" },
    { brgy: "Santa Barbara", brgy_code: "037105007" },
    { brgy: "Santo Rosario", brgy_code: "037105008" },
    { brgy: "Zone 1 Poblacion", brgy_code: "037105009" },
    { brgy: "Zone 2 Poblacion", brgy_code: "037105010" },
    { brgy: "Zone 3 Poblacion", brgy_code: "037105011" },
    { brgy: "Zone 4 Poblacion", brgy_code: "037105012" },
    { brgy: "Zone 5 Poblacion", brgy_code: "037105013" },
    { brgy: "Zone 6 Poblacion", brgy_code: "037105014" }
  ],
  // Masinloc
  "037106000": [
    { brgy: "Baloganon", brgy_code: "037106001" },
    { brgy: "Bamban", brgy_code: "037106002" },
    { brgy: "Bani", brgy_code: "037106003" },
    { brgy: "Collat", brgy_code: "037106004" },
    { brgy: "Inhobol", brgy_code: "037106005" },
    { brgy: "North Poblacion", brgy_code: "037106006" },
    { brgy: "San Lorenzo", brgy_code: "037106007" },
    { brgy: "San Salvador", brgy_code: "037106008" },
    { brgy: "Santa Rita", brgy_code: "037106009" },
    { brgy: "Santo Rosario", brgy_code: "037106010" },
    { brgy: "South Poblacion", brgy_code: "037106011" },
    { brgy: "Taltal", brgy_code: "037106012" },
    { brgy: "Tapuac", brgy_code: "037106013" }
  ],
  // Palauig
  "037107000": [
    { brgy: "Alwa", brgy_code: "037107001" },
    { brgy: "Bato", brgy_code: "037107002" },
    { brgy: "Bulawen", brgy_code: "037107003" },
    { brgy: "Cauyan", brgy_code: "037107004" },
    { brgy: "East Poblacion", brgy_code: "037107005" },
    { brgy: "Garreta", brgy_code: "037107006" },
    { brgy: "Libaba", brgy_code: "037107007" },
    { brgy: "Liozon", brgy_code: "037107008" },
    { brgy: "Lipay", brgy_code: "037107009" },
    { brgy: "Locloc", brgy_code: "037107010" },
    { brgy: "Macarang", brgy_code: "037107011" },
    { brgy: "Magalawa", brgy_code: "037107012" },
    { brgy: "Pangolingan", brgy_code: "037107013" },
    { brgy: "Salaza", brgy_code: "037107014" },
    { brgy: "San Juan", brgy_code: "037107015" },
    { brgy: "Santo Niño", brgy_code: "037107016" },
    { brgy: "Santo Tomas", brgy_code: "037107017" },
    { brgy: "Tition", brgy_code: "037107018" },
    { brgy: "West Poblacion", brgy_code: "037107019" }
  ],
  // San Antonio
  "037108000": [
    { brgy: "Angeles", brgy_code: "037108001" },
    { brgy: "Antipolo", brgy_code: "037108002" },
    { brgy: "Burgos", brgy_code: "037108003" },
    { brgy: "East Dirita", brgy_code: "037108004" },
    { brgy: "Luna", brgy_code: "037108005" },
    { brgy: "Pundaquit", brgy_code: "037108006" },
    { brgy: "San Esteban", brgy_code: "037108007" },
    { brgy: "San Gregorio", brgy_code: "037108008" },
    { brgy: "San Juan", brgy_code: "037108009" },
    { brgy: "San Miguel", brgy_code: "037108010" },
    { brgy: "San Nicolas", brgy_code: "037108011" },
    { brgy: "Santiago", brgy_code: "037108012" },
    { brgy: "West Dirita", brgy_code: "037108013" }
  ],
  // San Felipe
  "037110000": [
    { brgy: "Amagna", brgy_code: "037110001" },
    { brgy: "Apostol", brgy_code: "037110002" },
    { brgy: "Balincaguing", brgy_code: "037110003" },
    { brgy: "Farañal", brgy_code: "037110004" },
    { brgy: "Feria", brgy_code: "037110005" },
    { brgy: "Maloma", brgy_code: "037110006" },
    { brgy: "Manglicmot", brgy_code: "037110007" },
    { brgy: "Rosete", brgy_code: "037110008" },
    { brgy: "San Rafael", brgy_code: "037110009" },
    { brgy: "Santo Niño", brgy_code: "037110010" },
    { brgy: "Villa Fidelia", brgy_code: "037110011" }
  ],
  // San Marcelino
  "037111000": [
    { brgy: "Aglao", brgy_code: "037111001" },
    { brgy: "Buhawen", brgy_code: "037111002" },
    { brgy: "Burgos", brgy_code: "037111003" },
    { brgy: "Central", brgy_code: "037111004" },
    { brgy: "Consuelo Norte", brgy_code: "037111005" },
    { brgy: "Consuelo Sur", brgy_code: "037111006" },
    { brgy: "La Paz", brgy_code: "037111007" },
    { brgy: "Laoag", brgy_code: "037111008" },
    { brgy: "Linasin", brgy_code: "037111009" },
    { brgy: "Linusungan", brgy_code: "037111010" },
    { brgy: "Lucero", brgy_code: "037111011" },
    { brgy: "Nagbunga", brgy_code: "037111012" },
    { brgy: "Rabanes", brgy_code: "037111013" },
    { brgy: "Rizal", brgy_code: "037111014" },
    { brgy: "San Guillermo", brgy_code: "037111015" },
    { brgy: "San Isidro", brgy_code: "037111016" },
    { brgy: "San Rafael", brgy_code: "037111017" },
    { brgy: "Santa Fe", brgy_code: "037111018" }
  ],
  // San Narciso
  "037112000": [
    { brgy: "Alusiis", brgy_code: "037112001" },
    { brgy: "Beddeng", brgy_code: "037112002" },
    { brgy: "Candelaria", brgy_code: "037112003" },
    { brgy: "Dallipawen", brgy_code: "037112004" },
    { brgy: "Grullo", brgy_code: "037112005" },
    { brgy: "La Paz", brgy_code: "037112006" },
    { brgy: "Libertad", brgy_code: "037112007" },
    { brgy: "Namatacan", brgy_code: "037112008" },
    { brgy: "Natividad", brgy_code: "037112009" },
    { brgy: "Omaya", brgy_code: "037112010" },
    { brgy: "Paite", brgy_code: "037112011" },
    { brgy: "Patrocinio", brgy_code: "037112012" },
    { brgy: "San Jose", brgy_code: "037112013" },
    { brgy: "San Juan", brgy_code: "037112014" },
    { brgy: "San Pascual", brgy_code: "037112015" },
    { brgy: "San Rafael", brgy_code: "037112016" },
    { brgy: "Siminublan", brgy_code: "037112017" }
  ],
  // Santa Cruz
  "037113000": [
    { brgy: "Babuyan", brgy_code: "037113001" },
    { brgy: "Bangan", brgy_code: "037113002" },
    { brgy: "Bayto", brgy_code: "037113003" },
    { brgy: "Biay", brgy_code: "037113004" },
    { brgy: "Bolitoc", brgy_code: "037113005" },
    { brgy: "Bulawon", brgy_code: "037113006" },
    { brgy: "Canaynayan", brgy_code: "037113007" },
    { brgy: "Gama", brgy_code: "037113008" },
    { brgy: "Guinabon", brgy_code: "037113009" },
    { brgy: "Guisguis", brgy_code: "037113010" },
    { brgy: "Lipay", brgy_code: "037113011" },
    { brgy: "Lomboy", brgy_code: "037113012" },
    { brgy: "Lucapon North", brgy_code: "037113013" },
    { brgy: "Lucapon South", brgy_code: "037113014" },
    { brgy: "Malabago", brgy_code: "037113015" },
    { brgy: "Naulo", brgy_code: "037113016" },
    { brgy: "Pamonoran", brgy_code: "037113017" },
    { brgy: "Poblacion North", brgy_code: "037113018" },
    { brgy: "Poblacion South", brgy_code: "037113019" },
    { brgy: "Sabang", brgy_code: "037113020" },
    { brgy: "San Fernando", brgy_code: "037113021" },
    { brgy: "Tabalong", brgy_code: "037113022" },
    { brgy: "Tubotubo North", brgy_code: "037113023" },
    { brgy: "Tubotubo South", brgy_code: "037113024" }
  ],
  // Subic
  "037114000": [
    { brgy: "Aningway", brgy_code: "037114001" },
    { brgy: "Asinan", brgy_code: "037114002" },
    { brgy: "Baraca-Camachile", brgy_code: "037114003" },
    { brgy: "Batiawan", brgy_code: "037114004" },
    { brgy: "Calapacuan", brgy_code: "037114005" },
    { brgy: "Calapandayan", brgy_code: "037114006" },
    { brgy: "Cawag", brgy_code: "037114007" },
    { brgy: "Ilwas", brgy_code: "037114008" },
    { brgy: "Mangan-Vaca", brgy_code: "037114009" },
    { brgy: "Matain", brgy_code: "037114010" },
    { brgy: "Naugsol", brgy_code: "037114011" },
    { brgy: "Pamatawan", brgy_code: "037114012" },
    { brgy: "San Isidro", brgy_code: "037114013" },
    { brgy: "Santo Tomas", brgy_code: "037114014" },
    { brgy: "Wawandue", brgy_code: "037114015" }
  ]
};

export default function ProfilePage() {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    contact: "",
    address: ""
  });
  const [deliveryAddress, setDeliveryAddress] = useState({
    streetName: "",
    building: "",
    houseNo: "",
    barangay: "",
    city: "",
    province: "",
    region: "",
    postalCode: ""
  });
  
  const [profileImage, setProfileImage] = useState(DEFAULT_AVATAR_SVG);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [imageLoading, setImageLoading] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Address dropdown states
  const [provinces, setProvinces] = useState<{ province: string; province_code: string }[]>([]);
  const [cities, setCities] = useState<{ city: string; city_code: string }[]>([]);
  const [barangays, setBarangays] = useState<{ brgy: string; brgy_code: string }[]>([]);

  // Store original data to track changes
  const [originalFormData, setOriginalFormData] = useState({
    fullName: "",
    email: "",
    contact: "",
    address: ""
  });
  const [originalDeliveryAddress, setOriginalDeliveryAddress] = useState({
    streetName: "",
    building: "",
    houseNo: "",
    barangay: "",
    city: "",
    province: "",
    region: "",
    postalCode: ""
  });

  // Store the complete user data to preserve all fields
  const [completeUserData, setCompleteUserData] = useState<any>(null);

  const checkImageExists = (url: string): Promise<boolean> => {
    return new Promise((resolve) => {
      if (url === DEFAULT_AVATAR_SVG) {
        resolve(true);
        return;
      }
      const img = new Image();
      const timeout = setTimeout(() => {
        img.onload = img.onerror = null;
        resolve(false);
      }, 5000);
      img.onload = () => {
        clearTimeout(timeout);
        resolve(true);
      };
      
      img.onerror = () => {
        clearTimeout(timeout);
        resolve(false);
      };
      
      img.src = url;
    });
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        await fetchUserProfile();
      } else {
        setIsLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Initialize provinces
  useEffect(() => {
    setProvinces(regionIIIProvinces);
  }, []);

  // Check for changes whenever form data changes
  useEffect(() => {
    const formChanged = 
      formData.fullName !== originalFormData.fullName ||
      formData.contact !== originalFormData.contact ||
      formData.email !== originalFormData.email;

    const addressChanged = 
      deliveryAddress.streetName !== originalDeliveryAddress.streetName ||
      deliveryAddress.building !== originalDeliveryAddress.building ||
      deliveryAddress.houseNo !== originalDeliveryAddress.houseNo ||
      deliveryAddress.barangay !== originalDeliveryAddress.barangay ||
      deliveryAddress.city !== originalDeliveryAddress.city ||
      deliveryAddress.province !== originalDeliveryAddress.province ||
      deliveryAddress.region !== originalDeliveryAddress.region ||
      deliveryAddress.postalCode !== originalDeliveryAddress.postalCode;

    setHasChanges(formChanged || addressChanged);
    
    console.log("🔄 Changes detected:", {
      hasChanges: formChanged || addressChanged,
      formChanged,
      addressChanged
    });
  }, [formData, deliveryAddress, originalFormData, originalDeliveryAddress]);

  const fetchUserProfile = async () => {
    try {
      setIsLoading(true);
      setError("");
      setSuccess("");
      setImageLoading(true);
      
      const user = auth.currentUser;
      if (!user) {
        setError("No user logged in");
        setIsLoading(false);
        return;
      }

      console.log("🔄 Fetching profile for user:", user.uid, user.email);
      
      try {
        const userData = await getUserProfile();
        
        if (userData) {
          console.log("📥 Loaded complete user data:", userData);
          
          // Store the complete user data to preserve all fields
          setCompleteUserData(userData);
          
          // Set form data
          const newFormData = {
            fullName: userData.fullName || "",
            email: userData.email || user.email || "",
            contact: userData.contact || "",
            address: ""
          };
          
          setFormData(newFormData);
          setOriginalFormData(newFormData);
          
          // Set delivery address if it exists
          let addressData = {
            streetName: "",
            building: "",
            houseNo: "",
            barangay: "",
            city: "",
            province: "",
            region: "",
            postalCode: ""
          };

          if (userData.address) {
            const address = userData.address;
            addressData = {
              streetName: address.streetName || "",
              building: address.building || "",
              houseNo: address.houseNo || "",
              barangay: address.barangay || "",
              city: address.city || "",
              province: address.province || "",
              region: address.region || "",
              postalCode: address.postalCode || ""
            };
          }

          setDeliveryAddress(addressData);
          setOriginalDeliveryAddress(addressData);

          // Set dropdown data based on saved address
          if (addressData.region) {
            setProvinces(regionIIIProvinces);
          }
          if (addressData.province) {
            setCities(zambalesCitiesMunicipalities);
          }
          if (addressData.city) {
            const selectedCity = zambalesCitiesMunicipalities.find(c => c.city === addressData.city);
            if (selectedCity) {
              const barangaysData = zambalesBarangays[selectedCity.city_code as keyof typeof zambalesBarangays] || [];
              setBarangays(barangaysData);
            }
          }
          
          // Enhanced profile picture loading
          if (userData.profilePic) {
            const optimizedUrl = getOptimizedImageUrl(userData.profilePic, 200, 200);
            console.log("🖼️ Setting profile picture URL:", optimizedUrl);
            
            try {
              const imageExists = await checkImageExists(optimizedUrl);
              if (imageExists) {
                setProfileImage(optimizedUrl);
                console.log("✅ Profile image loaded successfully");
              } else {
                console.warn("❌ Profile image doesn't exist, using default");
                setProfileImage(DEFAULT_AVATAR_SVG);
              }
            } catch (error) {
              console.warn("❌ Profile image check failed, using default:", error);
              setProfileImage(DEFAULT_AVATAR_SVG);
            }
          } else {
            setProfileImage(DEFAULT_AVATAR_SVG);
          }
        }
      } catch (err: any) {
        // Handle "profile not found" error specifically
        if (err.message === "User profile not found in buyers collection") {
          console.log("🆕 Profile not found for user:", user.email);
          
          // Set default values for new user
          const defaultFormData = {
            fullName: user.displayName || "",
            email: user.email || "",
            contact: "",
            address: ""
          };
          
          setFormData(defaultFormData);
          setOriginalFormData(defaultFormData);
          
          // Pre-populate region and provinces
          const defaultAddress = {
            ...deliveryAddress,
            region: "Region III - Central Luzon"
          };
          setDeliveryAddress(defaultAddress);
          setOriginalDeliveryAddress(defaultAddress);
          setProvinces(regionIIIProvinces);
          
          setError("Welcome! Please complete your profile information below.");
          
          // Don't throw the error - we're handling it gracefully
          return;
        } else {
          // Re-throw other errors
          throw err;
        }
      }
      
    } catch (err: any) {
      console.error('Error fetching profile:', err);
      
      if (err.message === "User profile not found in buyers collection") {
        // This should be handled in the inner try-catch, but as a fallback
        const user = auth.currentUser;
        const defaultFormData = {
          fullName: user?.displayName || "",
          email: user?.email || "",
          contact: "",
          address: ""
        };
        setFormData(defaultFormData);
        setOriginalFormData(defaultFormData);
        setError("Welcome! Please complete your profile to continue.");
      } else if (err.message === "No user logged in") {
        setError("Please log in to view your profile.");
      } else {
        setError('Failed to load profile data. Please try refreshing the page.');
      }
    } finally {
      setIsLoading(false);
      setImageLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAddressChange = (field: string, value: string) => {
    setDeliveryAddress(prev => ({
      ...prev,
      [field]: value
    }));

    // Handle dropdown cascading
    if (field === "region") {
      const selectedRegion = philippineRegions.find(r => r.region === value);
      if (selectedRegion) {
        setProvinces(regionIIIProvinces);
        setDeliveryAddress(prev => ({
          ...prev,
          province: "",
          city: "",
          barangay: ""
        }));
        setCities([]);
        setBarangays([]);
      }
    }

    if (field === "province") {
      const selectedProvince = provinces.find(p => p.province === value);
      if (selectedProvince) {
        setCities(zambalesCitiesMunicipalities);
        setDeliveryAddress(prev => ({
          ...prev,
          city: "",
          barangay: ""
        }));
        setBarangays([]);
      }
    }

    if (field === "city") {
      const selectedCity = cities.find(c => c.city === value);
      if (selectedCity) {
        const barangaysData = zambalesBarangays[selectedCity.city_code as keyof typeof zambalesBarangays] || [];
        setBarangays(barangaysData);
        setDeliveryAddress(prev => ({
          ...prev,
          barangay: ""
        }));
      }
    }
  };

  const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setError("");
      setSuccess("");
      setImageLoading(true);
      
      if (!file.type.startsWith('image/')) {
        setError('Please select a valid image file');
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size should be less than 5MB');
        return;
      }
      
      // Use Cloudinary for upload
      const imageUrl = await updateProfilePicture(file);
      const optimizedUrl = getOptimizedImageUrl(imageUrl, 200, 200);
      
      try {
        const imageExists = await checkImageExists(optimizedUrl);
        if (imageExists) {
          setProfileImage(optimizedUrl);
          console.log("✅ Image uploaded and loaded successfully:", optimizedUrl);
          setSuccess("Profile picture updated successfully!");
          setHasChanges(true); // Image change counts as a change
        } else {
          setError('Image uploaded but failed to load. Please try again.');
          setProfileImage(DEFAULT_AVATAR_SVG);
        }
      } catch (error) {
        console.error('Failed to load uploaded image:', error);
        setError('Image uploaded but failed to load. Please try again.');
        setProfileImage(DEFAULT_AVATAR_SVG);
      }
      
    } catch (err) {
      console.error('Error uploading image:', err);
      setError('Failed to upload profile image');
      setProfileImage(DEFAULT_AVATAR_SVG);
    } finally {
      setImageLoading(false);
    }
  };

  const handleSaveChanges = async () => {
    try {
      setIsSaving(true);
      setError("");
      setSuccess("");
      
      const user = auth.currentUser;
      if (!user) {
        setError("No user logged in");
        return;
      }

      // Prepare update data - ONLY include changed fields
      const updateData: any = {
        updatedAt: new Date()
      };

      // Check which fields have changed and only include those
      if (formData.fullName !== originalFormData.fullName) {
        updateData.fullName = formData.fullName;
      }

      if (formData.contact !== originalFormData.contact) {
        updateData.contact = formData.contact;
      }

      // Check if any address fields changed
      const addressChanged = 
        deliveryAddress.streetName !== originalDeliveryAddress.streetName ||
        deliveryAddress.building !== originalDeliveryAddress.building ||
        deliveryAddress.houseNo !== originalDeliveryAddress.houseNo ||
        deliveryAddress.barangay !== originalDeliveryAddress.barangay ||
        deliveryAddress.city !== originalDeliveryAddress.city ||
        deliveryAddress.province !== originalDeliveryAddress.province ||
        deliveryAddress.region !== originalDeliveryAddress.region ||
        deliveryAddress.postalCode !== originalDeliveryAddress.postalCode;

      if (addressChanged) {
        // Preserve existing location data if it exists
        const existingLocation = completeUserData?.address?.location;
        
        updateData.address = {
          ...deliveryAddress,
          // Preserve the location data if it exists in the original data
          ...(existingLocation && { location: existingLocation })
        };
      }

      console.log("💾 Saving only changed fields:", updateData);

      // If no fields changed except updatedAt, don't send the request
      const fieldsToUpdate = Object.keys(updateData).filter(key => key !== 'updatedAt');
      if (fieldsToUpdate.length === 0) {
        setSuccess("No changes to save.");
        setIsSaving(false);
        return;
      }

      const updatedUser = await updateUserProfile(updateData);
      
      if (updatedUser) {
        // Update all original data
        setOriginalFormData({
          fullName: formData.fullName,
          email: formData.email,
          contact: formData.contact,
          address: ""
        });
        
        setOriginalDeliveryAddress(deliveryAddress);
        
        // Update the complete user data with the changes
        if (completeUserData) {
          setCompleteUserData({
            ...completeUserData,
            ...updateData
          });
        }
        
        setHasChanges(false);
        setSuccess("Profile updated successfully!");
        
        console.log("✅ Only changed fields saved successfully!");
        
        // Clear welcome messages
        if (error.includes("Welcome") || error.includes("complete your profile")) {
          setError("");
        }
      }
      
    } catch (err) {
      console.error('❌ Error updating profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleCancelAll = () => {
    // Reset all data to original
    setFormData(originalFormData);
    setDeliveryAddress(originalDeliveryAddress);
    setError("");
    setSuccess("");
    setHasChanges(false);
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    console.warn("❌ Image failed to load, using default avatar");
    const target = e.target as HTMLImageElement;
    
    if (target.src !== DEFAULT_AVATAR_SVG) {
      target.src = DEFAULT_AVATAR_SVG;
    }
    
    target.onerror = null;
    setImageLoading(false);
  };

  const handleImageLoad = () => {
    setImageLoading(false);
    console.log("✅ Profile image loaded successfully");
  };

  if (isLoading) {
    return (
      <div className={styles.profileContent}>
        <div className={styles.loadingContainer}>
          <Loader2 className={styles.spinner} size={32} />
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.profileContent}>
      <div className={styles.header}>
        <h1 className={styles.title}>Personal Information</h1>
        <p className={styles.subtitle}>Manage your account settings and preferences</p>
      </div>
      
      {error && (
        <div className={styles.errorMessage}>
          {error}
        </div>
      )}

      {success && (
        <div className={styles.successMessage}>
          {success}
        </div>
      )}
      
      {/* Main Profile Container */}
      <div className={styles.profileContainer}>
        
        {/* Profile Picture Section - Centered */}
        <div className={styles.profilePictureSection}>
          <div className={styles.profileImageContainer}>
            <div className={styles.imageWrapper}>
              {imageLoading && (
                <div className={styles.imageLoading}>
                  <Loader2 className={styles.imageSpinner} size={20} />
                </div>
              )}
              <img 
                src={profileImage} 
                alt="Profile" 
                className={styles.profileImage}
                onError={handleImageError}
                onLoad={handleImageLoad}
                style={{ opacity: imageLoading ? 0.5 : 1 }}
              />
            </div>
            <button 
              className={styles.editImageButton}
              onClick={handleImageClick}
              type="button"
              disabled={isSaving || imageLoading}
            >
              <Camera size={16} />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageChange}
              accept="image/*"
              className={styles.fileInput}
            />
          </div>
          <p className={styles.imageHint}>Click the camera icon to change your profile picture</p>
        </div>

        {/* Personal Information Section */}
        <div className={styles.personalInfoSection}>
          <h3 className={styles.sectionTitle}>Personal Information</h3>
          
          {/* Full Name and Email on same line */}
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="fullName" className={styles.label}>
                Full Name
              </label>
              <input
                id="fullName"
                type="text"
                value={formData.fullName}
                onChange={(e) => handleInputChange("fullName", e.target.value)}
                className={styles.input}
                placeholder="Enter your full name"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="email" className={styles.label}>
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={formData.email}
                className={styles.input}
                disabled={true} // Email should not be editable
                placeholder="Enter your email address"
              />
            </div>
          </div>

          {/* Phone Number - same width as full name */}
          <div className={styles.phoneNumberRow}>
            <div className={styles.formGroup}>
              <label htmlFor="contact" className={styles.label}>
                Phone Number
              </label>
              <input
                id="contact"
                type="tel"
                value={formData.contact}
                onChange={(e) => handleInputChange("contact", e.target.value)}
                className={styles.input}
                placeholder="+63 912 345 6789"
              />
            </div>
          </div>
        </div>

        {/* Delivery Address Section */}
        <div className={styles.deliveryAddressSection}>
          <h3 className={styles.sectionTitle}>Delivery Address</h3>
          
          {/* First Line: Region, Province, City */}
          <div className={styles.formRowThree}>
            <div className={styles.formGroup}>
              <label htmlFor="region" className={styles.label}>
                Region
              </label>
              <select 
                id="region"
                className={styles.input}
                value={deliveryAddress.region}
                onChange={(e) => handleAddressChange("region", e.target.value)}
              >
                <option value="">Select Region</option>
                {philippineRegions.map(region => (
                  <option key={region.region_code} value={region.region}>
                    {region.region}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="province" className={styles.label}>
                Province
              </label>
              <select 
                id="province"
                className={styles.input}
                value={deliveryAddress.province}
                onChange={(e) => handleAddressChange("province", e.target.value)}
                disabled={!deliveryAddress.region}
              >
                <option value="">Select Province</option>
                {provinces.map(province => (
                  <option key={province.province_code} value={province.province}>
                    {province.province}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="city" className={styles.label}>
                City/Municipality
              </label>
              <select 
                id="city"
                className={styles.input}
                value={deliveryAddress.city}
                onChange={(e) => handleAddressChange("city", e.target.value)}
                disabled={!deliveryAddress.province}
              >
                <option value="">Select City/Municipality</option>
                {cities.map(city => (
                  <option key={city.city_code} value={city.city}>
                    {city.city}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Second Line: Barangay, Postal Code, Street Name */}
          <div className={styles.formRowThree}>
            <div className={styles.formGroup}>
              <label htmlFor="barangay" className={styles.label}>
                Barangay
              </label>
              <select 
                id="barangay"
                className={styles.input}
                value={deliveryAddress.barangay}
                onChange={(e) => handleAddressChange("barangay", e.target.value)}
                disabled={!deliveryAddress.city}
              >
                <option value="">Select Barangay</option>
                {barangays.map(barangay => (
                  <option key={barangay.brgy_code} value={barangay.brgy}>
                    {barangay.brgy}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="postalCode" className={styles.label}>
                Postal Code
              </label>
              <input
                id="postalCode"
                type="text"
                value={deliveryAddress.postalCode}
                onChange={(e) => handleAddressChange("postalCode", e.target.value)}
                className={styles.input}
                placeholder="Postal Code"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="streetName" className={styles.label}>
                Street Name
              </label>
              <input
                id="streetName"
                type="text"
                value={deliveryAddress.streetName}
                onChange={(e) => handleAddressChange("streetName", e.target.value)}
                className={styles.input}
                placeholder="Street Name"
              />
            </div>
          </div>

          {/* Last Line: House No. and Building (Optional) */}
          <div className={styles.formRowTwo}>
            <div className={styles.formGroup}>
              <label htmlFor="houseNo" className={styles.label}>
                House No.
              </label>
              <input
                id="houseNo"
                type="text"
                value={deliveryAddress.houseNo}
                onChange={(e) => handleAddressChange("houseNo", e.target.value)}
                className={styles.input}
                placeholder="House No."
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="building" className={styles.label}>
                Building (Optional)
              </label>
              <input
                id="building"
                type="text"
                value={deliveryAddress.building}
                onChange={(e) => handleAddressChange("building", e.target.value)}
                className={styles.input}
                placeholder="Building"
              />
            </div>
          </div>
        </div>

        {/* Global Save/Cancel Buttons - Always show when there are changes */}
        {hasChanges && (
          <div className={styles.actionButtons}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={handleCancelAll}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.saveButton}
              onClick={handleSaveChanges}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className={styles.buttonSpinner} size={16} />
                  Saving...
                </>
              ) : (
                'Save All Changes'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}