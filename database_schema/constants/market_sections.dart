import 'package:flutter/material.dart';

/// Single Market Section or Building definition
class MarketSectionItem {
  final String id; // Canonical ID matching vendor_notes.json / Firestore (e.g. 'MEAT SECTION', 'BUILDING II')
  final String label; // User-friendly display label (e.g. 'Meat Section', 'Building II')
  final String group; // Categorical building group (e.g. 'Commodity Sections', 'Numbered Buildings')
  final IconData icon;
  final String description;

  const MarketSectionItem({
    required this.id,
    required this.label,
    required this.group,
    required this.icon,
    required this.description,
  });
}

/// Centralized Source of Truth for Ligao City Public Market Sections & Buildings
class MarketSections {
  MarketSections._();

  static const List<MarketSectionItem> items = [
    // ----------------------------------------------------
    // 1. SPECIALIZED COMMODITY SECTIONS
    // ----------------------------------------------------
    MarketSectionItem(
      id: 'MEAT SECTION',
      label: 'Meat Section',
      group: 'Commodity Sections',
      icon: Icons.restaurant_rounded,
      description: 'Pork, beef, poultry & fresh cuts',
    ),
    MarketSectionItem(
      id: 'FISH SECTION',
      label: 'Fish Section',
      group: 'Commodity Sections',
      icon: Icons.water_drop_rounded,
      description: 'Fresh seafood, saltwater & freshwater fish',
    ),
    MarketSectionItem(
      id: 'CARENDERIA',
      label: 'Carenderia / Eateries',
      group: 'Commodity Sections',
      icon: Icons.local_dining_rounded,
      description: 'Cooked meals, snacks, refreshments & dining',
    ),

    // ----------------------------------------------------
    // 2. CAMARIN BUILDINGS
    // ----------------------------------------------------
    MarketSectionItem(
      id: 'NEW CAMARIN',
      label: 'New Camarin',
      group: 'Camarin Buildings',
      icon: Icons.storefront_rounded,
      description: 'Tailoring, dressmaking, repairs & specialty shops',
    ),
    MarketSectionItem(
      id: 'OLD CAMARIN',
      label: 'Old Camarin',
      group: 'Camarin Buildings',
      icon: Icons.store_rounded,
      description: 'Dry goods, general merchandise & retail',
    ),

    // ----------------------------------------------------
    // 3. NUMBERED MARKET BUILDINGS
    // ----------------------------------------------------
    MarketSectionItem(
      id: 'BUILDING I',
      label: 'Building I',
      group: 'Numbered Buildings',
      icon: Icons.domain_rounded,
      description: 'Commercial stalls & market retail',
    ),
    MarketSectionItem(
      id: 'BUILDING II',
      label: 'Building II',
      group: 'Numbered Buildings',
      icon: Icons.domain_rounded,
      description: 'Rice, grains, dry goods & general merchandise',
    ),
    MarketSectionItem(
      id: 'BUILDING III',
      label: 'Building III',
      group: 'Numbered Buildings',
      icon: Icons.domain_rounded,
      description: 'Ingredients, condiments & wholesale supplies',
    ),
    MarketSectionItem(
      id: 'BUILDING IV',
      label: 'Building IV',
      group: 'Numbered Buildings',
      icon: Icons.domain_rounded,
      description: 'Commercial stalls & retail services',
    ),
    MarketSectionItem(
      id: 'BUILDING V',
      label: 'Building V',
      group: 'Numbered Buildings',
      icon: Icons.domain_rounded,
      description: 'Retail stores & consumer goods',
    ),
    MarketSectionItem(
      id: 'BUILDING VI',
      label: 'Building VI',
      group: 'Numbered Buildings',
      icon: Icons.domain_rounded,
      description: 'Apparel, footwear & merchandise',
    ),
    MarketSectionItem(
      id: 'BUILDING VII',
      label: 'Building VII',
      group: 'Numbered Buildings',
      icon: Icons.domain_rounded,
      description: 'Personal care, salon & wellness services',
    ),
    MarketSectionItem(
      id: 'BUILDING VIII',
      label: 'Building VIII',
      group: 'Numbered Buildings',
      icon: Icons.domain_rounded,
      description: 'Repair & specialty services',
    ),

    // ----------------------------------------------------
    // 4. MARKET EXTENSIONS (I through X)
    // ----------------------------------------------------
    MarketSectionItem(
      id: 'EXTENSION I',
      label: 'Extension I',
      group: 'Market Extensions',
      icon: Icons.other_houses_rounded,
      description: 'Perimeter market stalls & general vendors',
    ),
    MarketSectionItem(
      id: 'EXTENSION II',
      label: 'Extension II',
      group: 'Market Extensions',
      icon: Icons.other_houses_rounded,
      description: 'Perimeter market stalls & retail',
    ),
    MarketSectionItem(
      id: 'EXTENSION III',
      label: 'Extension III',
      group: 'Market Extensions',
      icon: Icons.other_houses_rounded,
      description: 'Perimeter market stalls & retail',
    ),
    MarketSectionItem(
      id: 'EXTENSION IV',
      label: 'Extension IV',
      group: 'Market Extensions',
      icon: Icons.other_houses_rounded,
      description: 'Perimeter market stalls & retail',
    ),
    MarketSectionItem(
      id: 'EXTENSION V',
      label: 'Extension V',
      group: 'Market Extensions',
      icon: Icons.other_houses_rounded,
      description: 'Fresh fruits, vegetables & produce extensions',
    ),
    MarketSectionItem(
      id: 'EXTENSION VI',
      label: 'Extension VI',
      group: 'Market Extensions',
      icon: Icons.other_houses_rounded,
      description: 'Perimeter market stalls & retail',
    ),
    MarketSectionItem(
      id: 'EXTENSION VII',
      label: 'Extension VII',
      group: 'Market Extensions',
      icon: Icons.other_houses_rounded,
      description: 'Perimeter market stalls & retail',
    ),
    MarketSectionItem(
      id: 'EXTENSION VIII',
      label: 'Extension VIII',
      group: 'Market Extensions',
      icon: Icons.other_houses_rounded,
      description: 'Perimeter market stalls & retail',
    ),
    MarketSectionItem(
      id: 'EXTENSION IX',
      label: 'Extension IX',
      group: 'Market Extensions',
      icon: Icons.other_houses_rounded,
      description: 'Wholesale, snacks & repack supplies',
    ),
    MarketSectionItem(
      id: 'EXTENSION X',
      label: 'Extension X',
      group: 'Market Extensions',
      icon: Icons.other_houses_rounded,
      description: 'Perimeter market stalls & utilities',
    ),
  ];

  /// Find a MarketSectionItem by ID, label, or address string
  static MarketSectionItem? findSection(String? query) {
    if (query == null || query.trim().isEmpty) return null;
    final normalized = query.trim().toUpperCase().replaceAll('_', ' ');

    for (final item in items) {
      if (item.id.toUpperCase() == normalized ||
          item.label.toUpperCase() == normalized ||
          item.id.replaceAll(' ', '') == normalized.replaceAll(' ', '') ||
          normalized.contains(item.id.toUpperCase())) {
        return item;
      }
    }
    return null;
  }

  /// Get formatted display label for any section identifier
  static String getLabel(String? sectionId) {
    if (sectionId == null || sectionId.trim().isEmpty) return 'Unassigned';
    final found = findSection(sectionId);
    return found?.label ?? sectionId.trim();
  }
}
