import 'package:cloud_firestore/cloud_firestore.dart';

class UserModel {
  final String uid;
  final String username;
  final String fullName;
  final String email;
  final String? profilePhotoUrl;
  final String role;
  final List<String> favoriteStalls;
  final String? fcmToken;
  final DateTime createdAt;

  UserModel({
    required this.uid,
    required this.username,
    required this.fullName,
    required this.email,
    this.profilePhotoUrl,
    required this.role,
    this.favoriteStalls = const [],
    this.fcmToken,
    required this.createdAt,
  });

  factory UserModel.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return UserModel(
      uid: doc.id,
      username: data['username'] ?? '',
      fullName: data['fullName'] ?? '',
      email: data['email'] ?? '',
      profilePhotoUrl: data['profilePhotoUrl'],
      role: data['role'] ?? 'user',
      favoriteStalls: List<String>.from(data['favoriteStalls'] ?? []),
      fcmToken: data['fcmToken'],
      createdAt: (data['createdAt'] as Timestamp).toDate(),
    );
  }

  Map<String, dynamic> toFirestore() {
    return {
      'username': username,
      'fullName': fullName,
      'email': email,
      'profilePhotoUrl': profilePhotoUrl,
      'role': role,
      'favoriteStalls': favoriteStalls,
      'fcmToken': fcmToken,
      'createdAt': Timestamp.fromDate(createdAt),
    };
  }

  UserModel copyWith({
    String? username,
    String? fullName,
    String? email,
    String? profilePhotoUrl,
    String? role,
    List<String>? favoriteStalls,
    String? fcmToken,
  }) {
    return UserModel(
      uid: uid,
      username: username ?? this.username,
      fullName: fullName ?? this.fullName,
      email: email ?? this.email,
      profilePhotoUrl: profilePhotoUrl ?? this.profilePhotoUrl,
      role: role ?? this.role,
      favoriteStalls: favoriteStalls ?? this.favoriteStalls,
      fcmToken: fcmToken ?? this.fcmToken,
      createdAt: createdAt,
    );
  }
}
