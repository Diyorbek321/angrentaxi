import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/features/auth/auth_provider.dart';
import 'package:angren_taxi/shared/widgets/app_button.dart';
import 'package:angren_taxi/shared/widgets/app_text_field.dart';
import 'package:angren_taxi/shared/widgets/error_widget.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

/// Real profile editor (PATCH /users/me) — previously "Ma'lumotlarni
/// tahrirlash" / the profile header pencil icon did nothing at all.
class EditProfileScreen extends StatefulWidget {
  const EditProfileScreen({super.key});

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  late final TextEditingController _firstNameController;
  late final TextEditingController _lastNameController;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final name = context.read<AuthProvider>().currentUser?.name ?? '';
    final parts = name.trim().split(RegExp(r'\s+'));
    _firstNameController = TextEditingController(
      text: parts.isNotEmpty && parts.first != '' ? parts.first : '',
    );
    _lastNameController = TextEditingController(
      text: parts.length > 1 ? parts.sublist(1).join(' ') : '',
    );
  }

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });

    final error = await context.read<AuthProvider>().updateProfile(
          firstName: _firstNameController.text.trim(),
          lastName: _lastNameController.text.trim(),
        );

    if (!mounted) return;
    setState(() => _saving = false);

    if (error != null) {
      setState(() => _error = error);
      return;
    }

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Ma\'lumotlar saqlandi')),
    );
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Ma\'lumotlarni tahrirlash')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(kSpace5),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AppTextField(
              controller: _firstNameController,
              label: 'Ism',
              hint: 'Ismingiz',
            ),
            const SizedBox(height: kSpace4),
            AppTextField(
              controller: _lastNameController,
              label: 'Familiya',
              hint: 'Familiyangiz',
            ),
            if (_error != null) ...[
              const SizedBox(height: kSpace3),
              // Xato MATNI kErrorDeep (6.47:1) — kError (3.91:1) faqat ikona.
              InlineErrorWidget(message: _error!),
            ],
            const SizedBox(height: kSpace6),
            AppButton(
              label: 'Saqlash',
              isLoading: _saving,
              onPressed: _saving ? null : _save,
            ),
          ],
        ),
      ),
    );
  }
}
