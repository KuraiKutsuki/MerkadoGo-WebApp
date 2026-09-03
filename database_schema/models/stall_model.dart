import 'package:cloud_firestore/cloud_firestore.dart';

class StallModel {
  final String stallId;
  final String name;
  final String category;
  final List<String> categories; // Multi-category support
  final List<String> products;
  final String address;
  final List<String> photoUrls;
  final String openTime;
  final String closeTime;
  final List<String> daysOpen;
  final double latitude;
  final double longitude;
  final bool isActive;
  final String status;
  final String? section;
  final String? stallNumber;
  final DateTime updatedAt;
  final List<String> tags;

  StallModel({
    required this.stallId,
    required this.name,
    required this.category,
    List<String>? categories,
    required this.products,
    required this.address,
    required this.photoUrls,
    required this.openTime,
    required this.closeTime,
    required this.daysOpen,
    required this.latitude,
    required this.longitude,
    required this.isActive,
    this.status = 'open',
    this.section,
    this.stallNumber,
    required this.updatedAt,
    this.tags = const [],
  }) : categories = categories ?? [category];

  // Create StallModel from Firestore document
  factory StallModel.fromFirestore(DocumentSnapshot doc) {
    try {
      final data = doc.data() as Map<String, dynamic>? ?? <String, dynamic>{};

      final category = (data['category'] as String? ?? '').trim();
      final categories = data['categories'] is List
          ? (data['categories'] as List)
              .map((e) => (e ?? '').toString().trim())
              .where((e) => e.isNotEmpty)
              .toList()
          : (category.isNotEmpty ? <String>[category] : <String>[]);

      return StallModel(
        stallId: doc.id,
        name: (data['name'] as String? ?? '').trim(),
        category: category,
        categories: categories,
        products: data['products'] is List
            ? (data['products'] as List)
                .map((e) => (e ?? '').toString().trim())
                .where((e) => e.isNotEmpty)
                .toList()
            : <String>[],
        address: (data['address'] as String? ?? '').trim(),
        photoUrls: data['photoUrls'] is List
            ? (data['photoUrls'] as List)
                .map((e) => (e ?? '').toString().trim())
                .where((e) => e.isNotEmpty)
                .toList()
            : <String>[],
        openTime: data['openTime'] as String? ?? '6:00 AM',
        closeTime: data['closeTime'] as String? ?? '6:00 PM',
        daysOpen: data['daysOpen'] is List
            ? (data['daysOpen'] as List)
                .map((e) => (e ?? '').toString().trim())
                .where((e) => e.isNotEmpty)
                .toList()
            : <String>[],
        latitude: (data['latitude'] as num?)?.toDouble() ?? 0.0,
        longitude: (data['longitude'] as num?)?.toDouble() ?? 0.0,
        isActive: data['isActive'] as bool? ??
            data['isOpen'] as bool? ??
            ((data['status'] as String?) == 'open'),
        status: data['status'] as String? ??
            ((data['isOpen'] == true || data['isActive'] == true)
                ? 'open'
                : 'closed'),
        section: (data['section'] as String? ??
                data['building_or_section'] as String?)
            ?.trim(),
        stallNumber: (data['stallNumber'] as String? ??
                data['stall_number'] as String?)
            ?.trim(),
        updatedAt: (data['updatedAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
        tags: data['tags'] is List
            ? (data['tags'] as List)
                .map((e) => (e ?? '').toString().trim())
                .where((e) => e.isNotEmpty)
                .toList()
            : <String>[],
      );
    } catch (e) {
      return StallModel(
        stallId: doc.id,
        name: 'Error loading stall',
        category: '',
        categories: const <String>[],
        products: const <String>[],
        address: '',
        photoUrls: const <String>[],
        openTime: '6:00 AM',
        closeTime: '6:00 PM',
        daysOpen: const <String>[],
        latitude: 0.0,
        longitude: 0.0,
        isActive: false,
        status: 'closed',
        section: '',
        stallNumber: '',
        updatedAt: DateTime.now(),
        tags: const <String>[],
      );
    }
  }

  // Convert StallModel to Firestore document
  Map<String, dynamic> toFirestore() {
    return {
      'name': name,
      'category': category,
      'categories': categories, // Multi-category array
      'products': products,
      'address': address,
      'photoUrls': photoUrls,
      'openTime': openTime,
      'closeTime': closeTime,
      'daysOpen': daysOpen,
      'latitude': latitude,
      'longitude': longitude,
      'isActive': isActive,
      'isOpen': status == 'open',
      'status': status,
      'section': section ?? '',
      'stallNumber': stallNumber ?? '',
      'stall_number': stallNumber ?? '',
      'updatedAt': Timestamp.fromDate(updatedAt),
      'tags': tags,
    };
  }

  // Create a copy with updated fields
  StallModel copyWith({
    String? stallId,
    String? name,
    String? category,
    List<String>? categories,
    List<String>? products,
    String? address,
    List<String>? photoUrls,
    String? openTime,
    String? closeTime,
    List<String>? daysOpen,
    double? latitude,
    double? longitude,
    bool? isActive,
    String? status,
    String? section,
    String? stallNumber,
    DateTime? updatedAt,
    List<String>? tags,
  }) {
    return StallModel(
      stallId: stallId ?? this.stallId,
      name: name ?? this.name,
      category: category ?? this.category,
      categories: categories ?? this.categories,
      products: products ?? this.products,
      address: address ?? this.address,
      photoUrls: photoUrls ?? this.photoUrls,
      openTime: openTime ?? this.openTime,
      closeTime: closeTime ?? this.closeTime,
      daysOpen: daysOpen ?? this.daysOpen,
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      isActive: isActive ?? this.isActive,
      status: status ?? this.status,
      section: section ?? this.section,
      stallNumber: stallNumber ?? this.stallNumber,
      updatedAt: updatedAt ?? this.updatedAt,
      tags: tags ?? this.tags,
    );
  }

  @override
  String toString() {
    return 'StallModel(stallId: $stallId, name: $name, category: $category, products: $products)';
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
  
    return other is StallModel &&
      other.stallId == stallId &&
      other.name == name &&
      other.category == category;
  }

  @override
  int get hashCode {
    return stallId.hashCode ^
      name.hashCode ^
      category.hashCode;
  }
}
