import 'package:flutter/material.dart';
import 'package:geocoding/geocoding.dart';
import 'package:provider/provider.dart';
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/features/passenger/order_provider.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:angren_taxi/shared/widgets/loading_widget.dart';

class _AddressSuggestion {
  const _AddressSuggestion({
    required this.address,
    required this.lat,
    required this.lng,
  });

  final String address;
  final double lat;
  final double lng;
}

class DestinationScreen extends StatefulWidget {
  const DestinationScreen({super.key});

  @override
  State<DestinationScreen> createState() => _DestinationScreenState();
}

class _DestinationScreenState extends State<DestinationScreen> {
  final _searchController = TextEditingController();
  final FocusNode _focusNode = FocusNode();

  List<_AddressSuggestion> _suggestions = [];
  bool _isSearching = false;
  String? _searchError;

  @override
  void initState() {
    super.initState();
    _focusNode.requestFocus();
  }

  @override
  void dispose() {
    _searchController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  Future<void> _onSearchChanged(String query) async {
    if (query.length < 3) {
      setState(() {
        _suggestions = [];
        _searchError = null;
      });
      return;
    }

    setState(() {
      _isSearching = true;
      _searchError = null;
    });

    try {
      final locations = await locationFromAddress(
        '$query, Angren, Uzbekistan',
      ).timeout(const Duration(seconds: 5));

      if (!mounted) return;

      final suggestions = <_AddressSuggestion>[];
      for (final loc in locations.take(5)) {
        final placemarks = await placemarkFromCoordinates(
          loc.latitude,
          loc.longitude,
        );
        if (placemarks.isNotEmpty) {
          final p = placemarks.first;
          final addr = [
            p.street,
            p.subLocality,
            p.locality,
          ].where((e) => e != null && e.isNotEmpty).join(', ');
          suggestions.add(
            _AddressSuggestion(
              address: addr.isEmpty ? query : addr,
              lat: loc.latitude,
              lng: loc.longitude,
            ),
          );
        }
      }

      if (mounted) {
        setState(() {
          _suggestions = suggestions;
          _isSearching = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isSearching = false;
          _searchError = 'Manzilni topib bo\'lmadi';
          _suggestions = [];
        });
      }
    }
  }

  void _selectSuggestion(_AddressSuggestion suggestion) {
    final orderProvider = context.read<OrderProvider>();
    orderProvider.setPendingDropoff(
      OrderLocation(
        address: suggestion.address,
        lat: suggestion.lat,
        lng: suggestion.lng,
      ),
    );
    Navigator.of(context).pushNamed('/passenger/tariff');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Manzilni kiriting'),
        backgroundColor: Colors.white,
        foregroundColor: kTextPrimary,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: Column(
        children: [
          _buildSearchField(),
          const Divider(height: 1),
          Expanded(child: _buildContent()),
        ],
      ),
    );
  }

  Widget _buildSearchField() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          const Icon(Icons.search, color: kTextSecondary),
          const SizedBox(width: 12),
          Expanded(
            child: TextField(
              controller: _searchController,
              focusNode: _focusNode,
              decoration: const InputDecoration(
                hintText: 'Ko\'cha, mahalla, joy nomi...',
                border: InputBorder.none,
                isDense: true,
              ),
              textInputAction: TextInputAction.search,
              onChanged: _onSearchChanged,
            ),
          ),
          if (_searchController.text.isNotEmpty)
            IconButton(
              icon: const Icon(Icons.clear, color: kTextSecondary),
              onPressed: () {
                _searchController.clear();
                setState(() {
                  _suggestions = [];
                  _searchError = null;
                });
              },
            ),
        ],
      ),
    );
  }

  Widget _buildContent() {
    if (_isSearching) {
      return const LoadingWidget(message: 'Qidirilmoqda...');
    }

    if (_searchError != null) {
      return Center(
        child: Text(
          _searchError!,
          style: const TextStyle(color: kTextSecondary),
        ),
      );
    }

    if (_suggestions.isEmpty && _searchController.text.length >= 3) {
      return const Center(
        child: Text(
          'Natija topilmadi',
          style: TextStyle(color: kTextSecondary),
        ),
      );
    }

    if (_suggestions.isEmpty) {
      return _buildRecentPlaces();
    }

    return _buildSuggestionsList();
  }

  Widget _buildSuggestionsList() {
    return ListView.separated(
      itemCount: _suggestions.length,
      separatorBuilder: (_, __) => const Divider(height: 1, indent: 56),
      itemBuilder: (context, index) {
        final suggestion = _suggestions[index];
        return ListTile(
          leading: Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: kSurfaceGrey,
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(Icons.location_on_outlined, color: kTextSecondary),
          ),
          title: Text(
            suggestion.address,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          onTap: () => _selectSuggestion(suggestion),
        );
      },
    );
  }

  Widget _buildRecentPlaces() {
    final recentPlaces = <(String, IconData, double, double)>[
      ('Angren bozori', Icons.shopping_basket_outlined, 40.1521, 69.1418),
      ('Angren shifoxonasi', Icons.local_hospital_outlined, 40.1467, 69.1339),
      ('Temir yo\'l stansiyasi', Icons.train_outlined, 40.1305, 69.1490),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Text(
            'Mashhur joylar',
            style: TextStyle(
              fontWeight: FontWeight.w600,
              color: kTextSecondary,
              fontSize: 13,
            ),
          ),
        ),
        ...recentPlaces.map(
          (place) => ListTile(
            leading: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: kSurfaceGrey,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(place.$2, color: kTextSecondary, size: 20),
            ),
            title: Text(place.$1),
            subtitle: const Text('Angren', style: TextStyle(fontSize: 12)),
            onTap: () => _selectSuggestion(
              _AddressSuggestion(
                address: place.$1,
                lat: place.$3,
                lng: place.$4,
              ),
            ),
          ),
        ),
      ],
    );
  }
}
