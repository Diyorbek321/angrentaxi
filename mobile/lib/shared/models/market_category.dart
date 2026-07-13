import 'package:equatable/equatable.dart';

class MarketCategory extends Equatable {
  const MarketCategory({
    required this.id,
    required this.name,
    required this.emoji,
  });

  final String id;
  final String name;
  final String emoji;

  factory MarketCategory.fromJson(Map<String, dynamic> json) {
    return MarketCategory(
      id: json['id'] as String,
      name: json['name'] as String,
      emoji: (json['emoji'] as String?) ?? '🛒',
    );
  }

  @override
  List<Object?> get props => [id, name, emoji];
}
