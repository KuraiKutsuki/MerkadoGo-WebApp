import 'package:flutter/material.dart';
import '../../features/map/domain/zone_palette.dart';

/// Single Category definition with rich metadata, subcategories, and visual tokens
class MarketCategoryItem {
  final String id;
  final String primaryCategoryName; // Exact primary_category from vendor_notes.json
  final String displayName;
  final String shortName;
  final IconData icon;
  final ZoneColorSet colorSet;
  final List<String> subcategories; // Subcategories from subcategory_search_directory.json
  final List<String> keywords;

  const MarketCategoryItem({
    required this.id,
    required this.primaryCategoryName,
    required this.displayName,
    required this.shortName,
    required this.icon,
    required this.colorSet,
    required this.subcategories,
    required this.keywords,
  });
}

/// Centralized Source of Truth:
/// - Main stall categories are aligned in shopper-intuitive order:
///   1. Fresh & Staple Foods (Meat, Fish, Mixed Meat, Produce, Ingredients, Coconut & Gata, Rice & Grains)
///   2. Prepared Food & Convenience (Eateries, Sari Sari, Wholesale Snacks)
///   3. Goods, Fashion & Tailoring (Dry Goods, Thrift Apparel, Tailoring)
///   4. Services & Personal Care (Specialty Repair, Salon & Beauty, Wellness & Spa)
///   5. Other (Miscellaneous)
class MarketCategories {
  MarketCategories._();

  static const List<MarketCategoryItem> items = [
    // ----------------------------------------------------
    // 1. FRESH & STAPLE FOODS (Cooking & Wet Market)
    // ----------------------------------------------------

    // 1. Meat (Pork & Beef)
    MarketCategoryItem(
      id: 'meat',
      primaryCategoryName: 'Meat',
      displayName: 'Meat (Pork & Beef)',
      shortName: 'Meat',
      icon: Icons.restaurant_rounded,
      colorSet: ZonePalette.meat,
      subcategories: [
        'Pork Cuts',
        'Beef Cuts',
        'Bones',
        'Offal',
        'Fat',
      ],
      keywords: [
        'pork', 'beef', 'baboy', 'baka', 'orig', 'karneng urig',
        'liempo', 'pork chop', 'kasim', 'pigue', 'bulalo',
      ],
    ),

    // 2. Fish & Seafood
    MarketCategoryItem(
      id: 'fish',
      primaryCategoryName: 'Fish',
      displayName: 'Fish & Seafood',
      shortName: 'Fish',
      icon: Icons.water_drop_rounded,
      colorSet: ZonePalette.fish,
      subcategories: [
        'Freshwater Fish',
        'Saltwater Fish',
        'Dried Fish',
        'Shellfish',
        'Squid',
        'Shrimp',
      ],
      keywords: [
        'isda', 'sira', 'tilapia', 'bangus', 'galunggong', 'tulingan',
        'pusit', 'hipon', 'alimasag', 'tuyo', 'daing', 'alamang',
      ],
    ),

    // 3. Mixed Meat & Poultry
    MarketCategoryItem(
      id: 'mixed_meat',
      primaryCategoryName: 'Mixed Meat',
      displayName: 'Mixed Meat & Poultry',
      shortName: 'Mixed Meat',
      icon: Icons.egg_alt_rounded,
      colorSet: ZonePalette.mixedMeat,
      subcategories: [
        'Dressed Chicken',
        'Whole Chicken',
        'Chicken Cuts',
        'Eggs',
        'Chicken Inwards',
      ],
      keywords: [
        'manok', 'chicken', 'poultry', 'dressed chicken', 'itlog', 'egg',
        'atay', 'balunbalunan', 'pakpak', 'hita', 'breast',
      ],
    ),

    // 4. Produce (Vegetables & Fruits)
    MarketCategoryItem(
      id: 'produce',
      primaryCategoryName: 'Produce',
      displayName: 'Produce (Vegetables & Fruits)',
      shortName: 'Produce',
      icon: Icons.eco_rounded,
      colorSet: ZonePalette.produce,
      subcategories: [
        'Leafy Vegetables',
        'Root Crops',
        'Solanaceous Vegetables',
        'Legumes',
        'Fresh Fruits',
      ],
      keywords: [
        'gulay', 'prutas', 'vegetables', 'fruits', 'saging', 'talong',
        'kamatis', 'kalabasa', 'sitaw', 'pechay', 'kangkong', 'patatas',
      ],
    ),

    // 5. Ingredients, Spices & Seasonings
    MarketCategoryItem(
      id: 'ingredients',
      primaryCategoryName: 'Ingredients',
      displayName: 'Ingredients & Spices',
      shortName: 'Ingredients',
      icon: Icons.kitchen_rounded,
      colorSet: ZonePalette.ingredients,
      subcategories: [
        'Aromatics',
        'Spices',
        'Sauces',
        'Cooking Oils',
        'Vinegars',
        'Condiments',
      ],
      keywords: [
        'bawang', 'sibuyas', 'luya', 'paminta', 'sili', 'lada',
        'patis', 'toyo', 'suka', 'mantika', 'seasoning', 'magic sarap',
      ],
    ),

    // 6. Coconut & Gata
    MarketCategoryItem(
      id: 'coconut_and_gata',
      primaryCategoryName: 'Coconut & Gata',
      displayName: 'Coconut & Gata',
      shortName: 'Coconut & Gata',
      icon: Icons.cookie_outlined,
      colorSet: ZonePalette.coconutAndGata,
      subcategories: [
        'Pure Gata',
        'Fresh Grated Coconut',
        'Whole Coconuts',
        'Buko Juice',
      ],
      keywords: [
        'niyog', 'gata', 'buko', 'kudkud', 'grated coconut', 'coconut milk',
      ],
    ),

    // 7. Rice & Grains
    MarketCategoryItem(
      id: 'rice_and_grains',
      primaryCategoryName: 'Rice & Grains',
      displayName: 'Rice & Grains',
      shortName: 'Rice & Grains',
      icon: Icons.grain_rounded,
      colorSet: ZonePalette.riceAndGrains,
      subcategories: [
        'White Rice',
        'Brown Rice',
        'Corn',
        'Animal Feeds',
      ],
      keywords: [
        'bigas', 'bagas', 'rice', 'sinandomeng', 'dinorado',
        'mais', 'corn', 'feeds', 'patuka', 'darak',
      ],
    ),

    // ----------------------------------------------------
    // 2. PREPARED FOOD & CONVENIENCE (Eateries & Snacks)
    // ----------------------------------------------------

    // 8. Eateries & Cooked Meals
    MarketCategoryItem(
      id: 'eateries',
      primaryCategoryName: 'Eateries',
      displayName: 'Eateries & Food Stalls',
      shortName: 'Eateries',
      icon: Icons.local_dining_rounded,
      colorSet: ZonePalette.eateries,
      subcategories: [
        'Cooked Dishes',
        'Rice Meals',
        'Lugaw',
        'Snacks',
        'Beverages',
        'Street Food',
      ],
      keywords: [
        'karinderya', 'kainan', 'lutong bahay', 'kanin', 'ulam', 'meryenda',
        'pancit', 'mami', 'halo-halo', 'gulaman', 'silog', 'lugaw',
      ],
    ),

    // 9. Sari Sari & Retail Essentials
    MarketCategoryItem(
      id: 'sari_sari',
      primaryCategoryName: 'Sari Sari',
      displayName: 'Sari Sari / Convenience Retail',
      shortName: 'Sari Sari',
      icon: Icons.storefront_rounded,
      colorSet: ZonePalette.sariSari,
      subcategories: [
        'Canned Goods',
        'Toiletries',
        'Snacks',
        'Beverages',
        'Household Cleaners',
        'Daily Essentials',
      ],
      keywords: [
        'sabon', 'shampoo', 'sardinas', 'toothpaste', 'chichirya',
        'kape', 'asukal', 'asin', 'softdrinks', 'noodles',
      ],
    ),

    // 10. Wholesale Snacks & Repacked Supplies
    MarketCategoryItem(
      id: 'wholesale_snacks',
      primaryCategoryName: 'Wholesale Snacks & Repacked Supplies',
      displayName: 'Wholesale Snacks & Supplies',
      shortName: 'Wholesale Snacks',
      icon: Icons.inventory_2_rounded,
      colorSet: ZonePalette.wholesaleSnacks,
      subcategories: [
        'Candies',
        'Biscuits',
        'Repacked Sugar',
        'Repacked Flour',
        'Baking Supplies',
      ],
      keywords: [
        'candy', 'biscuit', 'crackers', 'chichirya', 'kutkutin',
        'asukal', 'harina', 'repacked', 'wholesale', 'baking',
      ],
    ),

    // ----------------------------------------------------
    // 3. GOODS, FASHION & CLOTHING
    // ----------------------------------------------------

    // 11. Dry Goods & General Merchandise
    MarketCategoryItem(
      id: 'dry_goods',
      primaryCategoryName: 'Dry Goods',
      displayName: 'Dry Goods & General Merchandise',
      shortName: 'Dry Goods',
      icon: Icons.shopping_bag_rounded,
      colorSet: ZonePalette.dryGoods,
      subcategories: [
        'Plasticware',
        'Kitchenware',
        'Towels',
        'Mats',
        'Ropes',
        'Hardware Accessories',
      ],
      keywords: [
        'planggana', 'timba', 'sandok', 'kalan', 'plastic', 'tuwalya',
        'banig', 'tali', 'dry goods', 'gamit sa bahay',
      ],
    ),

    // 12. Thrift Apparel (Ukay-Ukay)
    MarketCategoryItem(
      id: 'thrift_apparel',
      primaryCategoryName: 'Thrift Apparel',
      displayName: 'Thrift Apparel & RTW',
      shortName: 'Thrift Apparel',
      icon: Icons.checkroom_rounded,
      colorSet: ZonePalette.thriftApparel,
      subcategories: [
        'Shirts',
        'Pants',
        'Jackets',
        'Footwear',
        'Bags',
        'Kids Wear',
      ],
      keywords: [
        'ukay', 'ukay-ukay', 'damit', 'pantalon', 't-shirt', 'jacket',
        'shoes', 'sapatos', 'tsinelas', 'bag', 'rtw', 'second hand',
      ],
    ),

    // 13. Tailoring & Dress Shop
    MarketCategoryItem(
      id: 'tailoring_and_dress_shop',
      primaryCategoryName: 'Tailoring & Dress Shop',
      displayName: 'Tailoring & Dress Shop',
      shortName: 'Tailoring',
      icon: Icons.content_cut_rounded,
      colorSet: ZonePalette.tailoring,
      subcategories: [
        'Alterations',
        'Custom Uniforms',
        'Dressmaking',
        'Curtains',
        'Zippers & Buttons',
      ],
      keywords: [
        'patahi', 'tahi', 'tailor', 'mananahi', 'alteration', 'zipper',
        'uniporme', 'gown', 'kurtina', 'dressmaker',
      ],
    ),

    // ----------------------------------------------------
    // 4. SERVICES & PERSONAL CARE
    // ----------------------------------------------------

    // 14. Specialty Repair
    MarketCategoryItem(
      id: 'specialty_repair',
      primaryCategoryName: 'Specialty Repair',
      displayName: 'Specialty Repair Services',
      shortName: 'Specialty Repair',
      icon: Icons.build_rounded,
      colorSet: ZonePalette.specialtyRepair,
      subcategories: [
        'Electronics Repair',
        'Shoe Repair',
        'Watch Repair',
        'Key Duplication',
        'Appliance Repair',
      ],
      keywords: [
        'repair', 'kumpuni', 'sapatos', 'relo', 'susi', 'duplicate key',
        'appliances', 'electric fan', 'cellphone repair',
      ],
    ),

    // 15. Salon & Beauty
    MarketCategoryItem(
      id: 'salon_and_beauty',
      primaryCategoryName: 'Salon & Beauty',
      displayName: 'Salon & Beauty',
      shortName: 'Salon & Beauty',
      icon: Icons.face_retouching_natural_rounded,
      colorSet: ZonePalette.salonAndBeauty,
      subcategories: [
        'Haircut',
        'Nails',
        'Makeup',
        'Barber',
      ],
      keywords: [
        'gupit', 'buhok', 'barber', 'parlor', 'salon',
        'manicure', 'pedicure', 'rebond', 'kulay',
      ],
    ),

    // 16. Wellness & Spa
    MarketCategoryItem(
      id: 'wellness',
      primaryCategoryName: 'Wellness & Spa',
      displayName: 'Wellness & Spa',
      shortName: 'Wellness & Spa',
      icon: Icons.self_improvement_rounded,
      colorSet: ZonePalette.wellnessAndSpa,
      subcategories: [
        'Massage',
        'Therapy',
        'Reflexology',
      ],
      keywords: [
        'hilot', 'masahe', 'massage', 'spa', 'therapy', 'relaxation',
      ],
    ),

    // ----------------------------------------------------
    // 5. OTHER / GENERAL
    // ----------------------------------------------------

    // 17. Miscellaneous
    MarketCategoryItem(
      id: 'miscellaneous',
      primaryCategoryName: 'Miscellaneous',
      displayName: 'Miscellaneous (Services & Utilities)',
      shortName: 'Miscellaneous',
      icon: Icons.category_rounded,
      colorSet: ZonePalette.miscellaneous,
      subcategories: [
        'Bills Payment',
        'Printing',
        'LPG',
        'Grinding',
      ],
      keywords: [
        'lpg', 'gasul', 'printing', 'xerox', 'gilingan',
        'bayad center', 'services', 'general',
      ],
    ),
  ];

  /// Get list of category names for directory tabs (includes 'All' and 'Favorites')
  static List<String> get directoryFilterNames => [
        'All',
        'Favorites',
        ...items.map((i) => i.primaryCategoryName),
      ];

  /// Find matching category item based on stall's primary_category or aliases
  static MarketCategoryItem? findCategory(String? categoryName) {
    if (categoryName == null || categoryName.trim().isEmpty) return null;
    final norm = categoryName.trim().toLowerCase().replaceAll(RegExp(r'[^\w\s]'), ' ');

    for (final item in items) {
      final pNorm = item.primaryCategoryName.toLowerCase().replaceAll(RegExp(r'[^\w\s]'), ' ');
      final idNorm = item.id.toLowerCase().replaceAll(RegExp(r'[^\w\s]'), ' ');
      final sNorm = item.shortName.toLowerCase().replaceAll(RegExp(r'[^\w\s]'), ' ');
      final dNorm = item.displayName.toLowerCase().replaceAll(RegExp(r'[^\w\s]'), ' ');

      if (pNorm == norm || idNorm == norm || sNorm == norm || dNorm == norm) {
        return item;
      }
      if (pNorm.contains(norm) || norm.contains(pNorm) || sNorm.contains(norm) || norm.contains(sNorm)) {
        return item;
      }
    }
    return null;
  }

  /// Get visual properties for any category string
  static ({
    IconData icon,
    Color color,
    Color bg,
    Color outline,
    String displayName,
    String primaryCategoryName,
    List<String> subcategories,
  }) getVisuals(String? categoryName) {
    final item = findCategory(categoryName);
    if (item != null) {
      return (
        icon: item.icon,
        color: item.colorSet.fill,
        bg: item.colorSet.accent,
        outline: item.colorSet.outline,
        displayName: item.displayName,
        primaryCategoryName: item.primaryCategoryName,
        subcategories: item.subcategories,
      );
    }

    final fallbackColor = ZonePalette.getColorSet(categoryName);
    return (
      icon: Icons.storefront_rounded,
      color: fallbackColor.fill,
      bg: fallbackColor.accent,
      outline: fallbackColor.outline,
      displayName: categoryName ?? 'General Stall',
      primaryCategoryName: categoryName ?? 'General',
      subcategories: const <String>[],
    );
  }
}
