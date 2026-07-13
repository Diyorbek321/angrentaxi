import 'package:equatable/equatable.dart';

class MenuCategory extends Equatable {
  const MenuCategory({required this.id, required this.name});

  final String id;
  final String name;

  factory MenuCategory.fromJson(Map<String, dynamic> json) {
    return MenuCategory(id: json['id'] as String, name: json['name'] as String);
  }

  @override
  List<Object?> get props => [id, name];
}
