// Report Model for user-submitted stall reports
class ReportModel {
  final String reportId;
  final String userId;
  final String stallId;
  final String stallName;
  final String description;
  final String status; // 'pending', 'reviewed', 'resolved'
  final DateTime createdAt;

  ReportModel({
    required this.reportId,
    required this.userId,
    required this.stallId,
    required this.stallName,
    required this.description,
    required this.status,
    required this.createdAt,
  });

  // Create from Firestore document
  factory ReportModel.fromFirestore(Map<String, dynamic> data, String docId) {
    return ReportModel(
      reportId: docId,
      userId: data['userId'] ?? '',
      stallId: data['stallId'] ?? '',
      stallName: data['stallName'] ?? '',
      description: data['description'] ?? '',
      status: data['status'] ?? 'pending',
      createdAt: (data['createdAt'] as dynamic)?.toDate() ?? DateTime.now(),
    );
  }

  // Convert to Firestore document
  Map<String, dynamic> toFirestore() {
    return {
      'userId': userId,
      'stallId': stallId,
      'stallName': stallName,
      'description': description,
      'status': status,
      'createdAt': createdAt,
    };
  }

  // Copy with method for immutability
  ReportModel copyWith({
    String? reportId,
    String? userId,
    String? stallId,
    String? stallName,
    String? description,
    String? status,
    DateTime? createdAt,
  }) {
    return ReportModel(
      reportId: reportId ?? this.reportId,
      userId: userId ?? this.userId,
      stallId: stallId ?? this.stallId,
      stallName: stallName ?? this.stallName,
      description: description ?? this.description,
      status: status ?? this.status,
      createdAt: createdAt ?? this.createdAt,
    );
  }
}
