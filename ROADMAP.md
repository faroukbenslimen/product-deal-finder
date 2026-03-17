# Product Roadmap & Future Features

This document outlines the planned features and enhancements for the AI Price Comparison App.

## 🟢 Phase 1: Immediate UI & Data Enhancements (AI-Driven)
These features will be added by upgrading the current Gemini AI prompt and updating the React UI. No external APIs or databases are required for these.

*   **Product Images:** Extract and display the main product image thumbnail for each store result to improve the visual experience.
*   **Stock & Availability Status:** Indicate whether the item is "In Stock", "Out of Stock", or "Pre-order" directly on the result card.
*   **Shipping Information:** Extract and display shipping costs and delivery estimates (e.g., "Free Shipping", "+$5.99 Delivery").
*   **Visual Search (Image Upload):** Allow users to upload a photo of a product to automatically identify and search for it.

## 🟡 Phase 2: User Personalization (Requires Database/Firebase)
These features require setting up a backend database and authentication system (like Firebase).

*   **User Accounts:** Allow users to sign up and log in (e.g., via Google Auth).
*   **Wishlists & Saved Searches:** Enable users to save specific products or deals to their profile to monitor later.
*   **Price Drop Alerts:** Let users opt-in to notifications when a saved product drops below a target price.

## 🔵 Phase 3: Hybrid API Integration (Monetization & Speed)
These features involve integrating direct APIs for major retailers while keeping the AI fallback for local stores.

*   **Direct Affiliate APIs:** Integrate official APIs (like Amazon Associates, eBay Partner Network) to fetch prices in milliseconds and earn affiliate commissions.
*   **Hybrid Search Engine:** 
    *   Use fast API calls for global giants (Amazon, Walmart, etc.).
    *   Use the AI web-reading approach for local/regional stores (e.g., Mytek, Tunisianet) that do not have public APIs.
