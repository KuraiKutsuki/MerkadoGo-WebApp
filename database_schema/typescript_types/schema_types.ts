/**
 * MerkadoGo Firestore Database TypeScript Interfaces
 * Compatible with Firebase JS SDK v9/v10
 */

import { Timestamp } from "firebase/firestore";

export type StallStatus = 
  | "open" 
  | "closed" 
  | "temporarily_closed" 
  | "under_renovation" 
  | "coming_soon";

export interface StallDocument {
  id?: string;
  name: string;                   // e.g. "4E'S LLOBET MEATSHOP"
  category: string;               // Primary category (e.g. "Meat", "Fish", "Carenderia / Eateries")
  categories: string[];           // Array of primary category + selected subcategories
  subcategories: string[];        // Selected subcategories (e.g. ["Pork Cuts", "Beef Cuts"])
  products: string[];             // Array of item names sold (e.g. ["Pork Liempo", "Beef Bulalo"])
  address: string;                // Physical location address (e.g. "STALL #1 MEAT SECTION MARKET SITE")
  section: string;                // Building / Section (e.g. "MEAT SECTION", "BUILDING II", "NEW CAMARIN")
  stallNumber?: string;           // Optional stall number
  photoUrls: string[];            // Image URLs
  openTime: string;               // e.g. "5:00 AM"
  closeTime: string;              // e.g. "6:00 PM"
  daysOpen: string[];             // e.g. ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
  latitude: number;               // Map coordinate latitude (e.g. 13.2419233)
  longitude: number;              // Map coordinate longitude (e.g. 123.538546)
  status: StallStatus;            // Operational status
  isOpen: boolean;                // Boolean active flag
  isActive: boolean;              // Boolean active flag
  tags: string[];                 // Search tags and subcategories combined
  updatedAt: Timestamp | Date;    // Timestamp of last update
}

export interface UserDocument {
  uid: string;                    // Firebase Auth UID
  username: string;               // Unique username
  fullName: string;               // Full display name
  email: string;                  // User email
  profilePhotoUrl: string | null; // Profile picture URL
  role: "user" | "admin";         // Access role
  favoriteStalls: string[];       // Array of favorite stall IDs
  fcmToken: string | null;        // Push notification token
  createdAt: Timestamp | Date;    // Registration date
}

export interface UsernameDocument {
  uid: string;                    // Matching User UID
  email: string;                  // Matching email
  createdAt: Timestamp | Date;    // Registration date
}

export interface ReportDocument {
  id?: string;
  userId: string;                 // UID of reporter
  stallId: string;                // ID of reported stall
  stallName: string;              // Name of reported stall
  description: string;            // Text description of issue
  status: "pending" | "reviewed" | "resolved";
  createdAt: Timestamp | Date;
}
