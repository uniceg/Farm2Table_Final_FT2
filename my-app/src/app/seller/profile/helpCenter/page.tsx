"use client";
import { useState, useRef, useEffect } from "react";
import { Search, MessageCircle, Mail, ChevronDown, ChevronUp, Clock, Shield, Send } from "lucide-react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/utils/lib/firebase";
import { auth } from "@/utils/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import styles from "./helpCenter.module.css";

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
  icon: string;
}

interface ContactForm {
  name: string;
  email: string;
  farmId?: string;
  issueType: "technical" | "account" | "payment" | "products" | "general";
  subject: string;
  message: string;
}

interface ChatMessage {
  id: string;
  text: string;
  sender: "bot" | "user";
  timestamp: Date;
}

export default function SellerHelpCenterPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [contactForm, setContactForm] = useState<ContactForm>({
    name: "",
    email: "",
    farmId: "",
    issueType: "general",
    subject: "",
    message: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      text: "Hello! I'm FarmAssist, your dedicated seller support assistant. How can I help you with your farm operations today?",
      sender: "bot",
      timestamp: new Date()
    }
  ]);
  const [userMessage, setUserMessage] = useState("");
  const [isIssueTypeOpen, setIsIssueTypeOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const issueTypeRef = useRef<HTMLDivElement>(null);

  // Get current user
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
        // Pre-fill user data if available
        setContactForm(prev => ({
          ...prev,
          name: user.displayName || prev.name,
          email: user.email || prev.email
        }));
      }
    });
    return () => unsubscribe();
  }, []);

  // Enhanced FAQ data for sellers/farmers
  const faqs: FAQ[] = [
    {
      id: "1",
      question: "How do I add new products to my farm?",
      answer: "Go to Products > Add New Product. Fill in product details, upload images, set pricing, and inventory. Make sure to categorize correctly for better visibility.",
      category: "products",
      icon: "📦"
    },
    {
      id: "2",
      question: "How are payments processed for my sales?",
      answer: "Payments are processed securely and transferred to your registered account every Friday. You can view your earnings and payment history in the Dashboard > Revenue section.",
      category: "payments",
      icon: "💰"
    },
    {
      id: "3",
      question: "What are the delivery requirements and timelines?",
      answer: "Orders should be prepared within 24 hours. Delivery partners will collect from your farm between 7-9 AM. Ensure products are properly packaged and labeled.",
      category: "delivery",
      icon: "🚚"
    },
    {
      id: "4",
      question: "How do I update my farm profile and information?",
      answer: "Navigate to Your Feed > Edit Mode to update farm details, description, gallery images, and farmer profiles. Changes are reflected immediately.",
      category: "profile",
      icon: "🏪"
    },
    {
      id: "5",
      question: "What are the commission rates and fees?",
      answer: "We charge a 15% commission on all sales. This includes platform maintenance, payment processing, and delivery coordination. No hidden fees.",
      category: "fees",
      icon: "📊"
    },
    {
      id: "6",
      question: "How do I handle customer returns or complaints?",
      answer: "Contact support immediately for quality issues. For valid complaints, we facilitate refunds and you'll be notified. Maintain quality standards to minimize returns.",
      category: "support",
      icon: "🔄"
    },
    {
      id: "7",
      question: "Can I offer discounts or run promotions?",
      answer: "Yes! Go to Products > select product > Edit > set promotional pricing. You can also create bundle deals and seasonal offers to attract more customers.",
      category: "marketing",
      icon: "🎯"
    },
    {
      id: "8",
      question: "How do I track my order performance and analytics?",
      answer: "Visit Dashboard > Top Selling for product performance. You can view sales trends, customer ratings, and inventory turnover rates.",
      category: "analytics",
      icon: "📈"
    }
  ];

  const categories = [
    { id: "all", label: "All Questions", icon: "📚" },
    { id: "products", label: "Products", icon: "📦" },
    { id: "payments", label: "Payments", icon: "💰" },
    { id: "delivery", label: "Delivery", icon: "🚚" },
    { id: "profile", label: "Profile", icon: "🏪" },
    { id: "fees", label: "Fees & Commission", icon: "📊" }
  ];

  const issueTypes = [
    { value: "technical", label: "Technical Issue" },
    { value: "account", label: "Account Management" },
    { value: "payment", label: "Payment Issue" },
    { value: "products", label: "Product Listing" },
    { value: "general", label: "General Inquiry" }
  ];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (issueTypeRef.current && !issueTypeRef.current.contains(event.target as Node)) {
        setIsIssueTypeOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter FAQs based on search and category
  const filteredFaqs = faqs.filter(faq => {
    const matchesSearch = faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         faq.answer.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = activeCategory === "all" || faq.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  // Suggested FAQs based on search (top 3 matches)
  const suggestedFaqs = searchTerm ? 
    faqs.filter(faq => 
      faq.question.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 3) : [];

  const toggleFaq = (id: string) => {
    setExpandedFaq(expandedFaq === id ? null : id);
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // Generate report ID
      const reportId = `REP-${Date.now().toString().slice(-6)}`;
      
      // Map issue types to match your existing format
      const issueTypeMap = {
        technical: "Technical Issue",
        account: "Account Problem", 
        payment: "Payment Issue",
        products: "Product Issue",
        general: "General Inquiry"
      };

      // Create support ticket in the EXISTING supportTickets collection
      const ticketData = {
        userName: contactForm.name,
        userEmail: contactForm.email,
        farmId: contactForm.farmId || "Not provided",
        issueType: issueTypeMap[contactForm.issueType],
        subject: contactForm.subject,
        message: contactForm.message,
        status: "unread",
        createdAt: serverTimestamp(),
        userType: "seller", // This distinguishes seller tickets from buyer tickets
        userId: currentUser?.uid || "unknown",
        reportId: reportId
      };

      // Save to your existing supportTickets collection
      await addDoc(collection(db, "supportTickets"), ticketData);
      
      console.log("✅ Seller support ticket saved to database:", ticketData);
      
      setSubmitSuccess(true);
      setContactForm({
        name: "",
        email: "",
        farmId: "",
        issueType: "general",
        subject: "",
        message: ""
      });
      
      setTimeout(() => setSubmitSuccess(false), 5000);

    } catch (error) {
      console.error("❌ Error submitting support ticket:", error);
      alert("There was an error sending your message. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof ContactForm, value: string) => {
    setContactForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleIssueTypeSelect = (value: "technical" | "account" | "payment" | "products" | "general") => {
    setContactForm(prev => ({
      ...prev,
      issueType: value
    }));
    setIsIssueTypeOpen(false);
  };

  const getSelectedIssueTypeLabel = () => {
    return issueTypes.find(opt => opt.value === contactForm.issueType)?.label || "General Inquiry";
  };

  const handleSendMessage = () => {
    if (!userMessage.trim()) return;
    
    // Add user message
    const newUserMessage: ChatMessage = {
      id: Date.now().toString(),
      text: userMessage,
      sender: "user",
      timestamp: new Date()
    };
    setChatMessages(prev => [...prev, newUserMessage]);
    setUserMessage("");

    // Simulate bot response after delay
    setTimeout(() => {
      const botResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: "I understand you're looking for seller support. Let me connect you with our dedicated seller support team who can assist you with farm operations and account management!",
        sender: "bot",
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, botResponse]);
    }, 1000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Seller Help Center</h1>
        <p className={styles.subtitle}>
          Get support for your farm operations, products, and account management
        </p>
      </div>

      {/* Search Section */}
      <div className={styles.searchSection}>
        <div className={styles.searchContainer}>
          <Search size={20} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Ask about products, payments, delivery, or account..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </div>
        
        {/* Suggested FAQs */}
        {searchTerm && suggestedFaqs.length > 0 && (
          <div className={styles.suggestedFaqs}>
            <h3 className={styles.suggestedTitle}>Quick Answers</h3>
            {suggestedFaqs.map(faq => (
              <button
                key={faq.id}
                className={styles.suggestedItem}
                onClick={() => {
                  setSearchTerm("");
                  setExpandedFaq(faq.id);
                  document.getElementById(`faq-${faq.id}`)?.scrollIntoView({
                    behavior: 'smooth'
                  });
                }}
              >
                <span className={styles.suggestedIcon}>{faq.icon}</span>
                <span className={styles.suggestedText}>{faq.question}</span>
                <ChevronDown size={16} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Support Info with 3D Images */}
      <div className={styles.highlightedSupport}>
        <div className={`${styles.supportFeature} ${styles.supportHours}`}>
          <div className={styles.supportContent}>
            <h3>Seller Support Hours</h3>
            <p>Monday - Saturday<br/>7:00 AM - 8:00 PM</p>
          </div>
        </div>
        <div className={`${styles.supportFeature} ${styles.responseTime}`}>
          <div className={styles.supportContent}>
            <h3>Priority Response</h3>
            <p>Within 30 Minutes<br/>For Seller Issues</p>
          </div>
        </div>
      </div>

      {/* Two Column Contact Options */}
      <div className={styles.contactGrid}>
        {/* Live Chat - Left Side */}
        <div className={styles.chatContainer}>
          <div className={styles.optionHeader}>
            <h3>Live Chat with FarmAssist</h3>
            <p>Your dedicated seller support assistant</p>
          </div>
          
          {/* Messenger-style Chat */}
          <div className={styles.chatWindow}>
            <div className={styles.chatMessages}>
              {chatMessages.map((message) => (
                <div
                  key={message.id}
                  className={`${styles.message} ${message.sender === 'bot' ? styles.botMessage : styles.userMessage}`}
                >
                  <div className={styles.messageContent}>
                    <div className={styles.messageText}>
                      {message.text}
                    </div>
                    <div className={styles.messageTime}>
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Chat Input */}
            <div className={styles.chatInputContainer}>
              <input
                type="text"
                placeholder="Type your message..."
                value={userMessage}
                onChange={(e) => setUserMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                className={styles.chatInput}
              />
              <button 
                onClick={handleSendMessage}
                className={styles.sendButton}
                disabled={!userMessage.trim()}
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Email Form - Right Side */}
        <div className={styles.formContainer}>
          <div className={styles.optionHeader}>
            <h3>Send Detailed Message to Admin</h3>
            <p>For farm operations, account, or technical issues</p>
          </div>
          
          {submitSuccess && (
            <div className={styles.successMessage}>
              <Shield size={18} />
              <div>
                <strong>Message Sent to Admin!</strong>
                <p>Your support ticket has been created and our team will respond within 2 hours.</p>
              </div>
            </div>
          )}

          <form onSubmit={handleContactSubmit} className={styles.contactForm}>
            <div className={styles.formCompact}>
              {/* First Row: Name and Email */}
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Your Name *</label>
                  <input
                    type="text"
                    value={contactForm.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className={styles.formInput}
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Email *</label>
                  <input
                    type="email"
                    value={contactForm.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className={styles.formInput}
                    required
                  />
                </div>
              </div>

              {/* Second Row: Farm ID and Issue Type */}
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Farm ID (optional)</label>
                  <input
                    type="text"
                    placeholder="Your farm identification"
                    value={contactForm.farmId}
                    onChange={(e) => handleInputChange('farmId', e.target.value)}
                    className={styles.formInput}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Issue Type *</label>
                  <div className={styles.dropdownContainer} ref={issueTypeRef}>
                    <button 
                      type="button"
                      className={styles.dropdownButton}
                      onClick={() => setIsIssueTypeOpen(!isIssueTypeOpen)}
                    >
                      <span>{getSelectedIssueTypeLabel()}</span>
                      <span className={`${styles.arrow} ${isIssueTypeOpen ? styles.arrowUp : styles.arrowDown}`}></span>
                    </button>
                    
                    {isIssueTypeOpen && (
                      <div className={styles.dropdownList}>
                        {issueTypes.map(issueType => (
                          <button
                            key={issueType.value}
                            type="button"
                            className={`${styles.dropdownItem} ${contactForm.issueType === issueType.value ? styles.selected : ''}`}
                            onClick={() => handleIssueTypeSelect(issueType.value as any)}
                          >
                            <span>{issueType.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Single Column Fields */}
              <div className={styles.formGroup}>
                <label>Subject *</label>
                <input
                  type="text"
                  placeholder="Brief description of your issue"
                  value={contactForm.subject}
                  onChange={(e) => handleInputChange('subject', e.target.value)}
                  className={styles.formInput}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label>Message *</label>
                <textarea
                  placeholder="Please describe your issue in detail. Include product IDs, order numbers, or specific error messages if applicable."
                  value={contactForm.message}
                  onChange={(e) => handleInputChange('message', e.target.value)}
                  className={styles.formTextarea}
                  rows={3}
                  required
                />
              </div>
            </div>

            <div className={styles.formActions}>
              <button 
                type="submit" 
                className={styles.submitButton}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <div className={styles.spinner}></div>
                    Sending to Admin...
                  </>
                ) : (
                  "Send Message to Admin"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* FAQ Section */}
      <section className={styles.faqSection}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Seller FAQs</h2>
          <p className={styles.sectionSubtitle}>
            Everything about farm operations, products, and account management
          </p>
        </div>

        {/* Category Filter */}
        <div className={styles.categoryFilter}>
          {categories.map(category => (
            <button
              key={category.id}
              className={`${styles.categoryButton} ${activeCategory === category.id ? styles.active : ''}`}
              onClick={() => setActiveCategory(category.id)}
            >
              <span className={styles.categoryIcon}>{category.icon}</span>
              <span>{category.label}</span>
            </button>
          ))}
        </div>

        {/* FAQ List */}
        <div className={styles.faqList}>
          {filteredFaqs.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No questions found matching your search.</p>
              <p className={styles.emptySubtitle}>
                Try different keywords or browse all categories.
              </p>
            </div>
          ) : (
            filteredFaqs.map(faq => (
              <div key={faq.id} id={`faq-${faq.id}`} className={styles.faqItem}>
                <button
                  className={styles.faqQuestion}
                  onClick={() => toggleFaq(faq.id)}
                >
                  <span className={styles.faqIcon}>{faq.icon}</span>
                  <span className={styles.faqText}>{faq.question}</span>
                  {expandedFaq === faq.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>
                {expandedFaq === faq.id && (
                  <div className={styles.faqAnswer}>
                    <p>{faq.answer}</p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}