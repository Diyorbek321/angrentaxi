import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/features/intercity/data/intercity_repository.dart';
import 'package:angren_taxi/features/intercity/intercity_messages.dart';
import 'package:angren_taxi/features/intercity/intercity_realtime.dart';
import 'package:angren_taxi/features/intercity/models/intercity_models.dart';
import 'package:angren_taxi/features/intercity/models/intercity_request_models.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/ag_map_fab.dart';
import 'package:angren_taxi/shared/widgets/app_button.dart';
import 'package:angren_taxi/shared/widgets/app_empty_state.dart';
import 'package:angren_taxi/shared/widgets/app_status_badge.dart';
import 'package:angren_taxi/shared/widgets/error_widget.dart';
import 'package:flutter/material.dart';

/// Haydovchi: yo'lovchi so'rovlari doskasi. Qabul qilinsa band haydovchining
/// oraliqdagi mos qatnoviga tushadi, mos qatnov bo'lmasa haydovchi tanlagan
/// vaqtga yangi qatnov ochiladi (qolgan joylar boshqa yo'lovchilarga ochiq).
///
/// Bir so'rovni bir necha haydovchi bir vaqtda bosishi mumkin — server
/// faqat bittasini o'tkazadi, qolganlari "boshqa haydovchi oldi" oladi.
/// Yo'lovchi ismi/telefoni bu yerda YO'Q: ular qabul qilgach band orqali.
class IntercityRequestBoardScreen extends StatefulWidget {
  const IntercityRequestBoardScreen({
    super.key,
    this.repository,
    this.socket,
    this.now,
  });

  final IntercityRepository? repository;
  final SocketService? socket;
  final DateTime Function()? now;

  @override
  State<IntercityRequestBoardScreen> createState() => _IntercityRequestBoardScreenState();
}

class _IntercityRequestBoardScreenState extends State<IntercityRequestBoardScreen> with IntercityRequestRealtime {
  late final IntercityRepository _repo = widget.repository ?? IntercityRepository();

  List<IntercityRequest>? _requests;
  List<IntercityTrip> _trips = const [];
  Object? _error;
  /// Tarmoq so'rovi ketayotgan so'rov (tugmada yuklanish belgisi).
  String? _busyId;

  /// Qabul oynasi ochiq — boshqa "Qabul qilish" bosilmasin (tez ikki bosish).
  bool _choosing = false;

  /// Ketma-ket socket hodisalarida eski javob yangisining ustiga yozilmasin.
  int _loadSeq = 0;

  DateTime _now() => (widget.now ?? DateTime.now)().toUtc();

  @override
  void initState() {
    super.initState();
    subscribeRequests(socket: widget.socket, driver: true);
    _load();
  }

  @override
  void dispose() {
    unsubscribeRequests();
    super.dispose();
  }

  @override
  void onRequestEvent(String? requestId) => _load();

  /// Doska asosiy; qatnovlar ro'yxati faqat qabul oynasi uchun yordamchi —
  /// u yiqilsa doska baribir ko'rinadi (server mos qatnovni o'zi topadi).
  Future<void> _load() async {
    final seq = ++_loadSeq;
    try {
      final requests = await _repo.requestBoard();
      if (!mounted || seq != _loadSeq) return;
      setState(() {
        _requests = requests;
        _error = null;
      });
    } catch (e) {
      if (mounted && seq == _loadSeq) setState(() => _error = e);
      return;
    }
    try {
      final trips = await _repo.myTrips();
      if (mounted && seq == _loadSeq) setState(() => _trips = trips);
    } catch (e) {
      debugPrint('[IntercityRequestBoard] myTrips failed: $e');
    }
  }

  Future<void> _accept(IntercityRequest request) async {
    // Oyna ochilishidan OLDIN: tez ikki bosish ikkita oyna ochmasin.
    setState(() => _choosing = true);
    final choice = await _chooseTarget(request);
    if (!mounted) return;
    setState(() => _choosing = false);
    if (choice == null) return;
    setState(() => _busyId = request.id);
    try {
      final l10n = context.l10n;
      // Oyna ochiq turganda vaqt o'tdi: server "hozir + 10 daq" ni qayta
      // tekshiradi — eskirgan vaqtni yubormasdan oldin aytamiz.
      final departure = choice.departureAt;
      if (departure != null && !request.departureFits(departure, _now())) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(l10n.icReqAcceptSlotPassed)));
        return;
      }
      final result = await _repo.acceptRequest(request.id, tripId: choice.tripId, departureAt: departure);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(result.tripCreated ? l10n.icReqAcceptedNewTrip : l10n.icReqAcceptedExisting)),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(intercityErrorMessage(e))));
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
    // Muvaffaqiyatda ham, xatoda ham (boshqa haydovchi oldi / joy tugadi) —
    // haqiqiy holat serverdan.
    if (mounted) await _load();
  }

  Future<_AcceptChoice?> _chooseTarget(IntercityRequest request) {
    final now = _now();
    final busy = [for (final trip in _trips) if (isLiveIntercityTrip(trip)) trip.departureAt];
    return showModalBottomSheet<_AcceptChoice>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _AcceptSheet(
        request: request,
        trips: intercityTripsForRequest(request, _trips, now),
        slots: intercityDepartureSlots(request, now, busy: busy),
        overlapsOnly: intercityDepartureSlots(request, now).isNotEmpty,
        earliest: request.earliestDeparture(now),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.icReqBoardTitle)),
      body: SafeArea(top: false, child: _body()),
    );
  }

  Widget _body() {
    final l10n = context.l10n;
    final requests = _requests;
    if (requests == null && _error != null) {
      return AppErrorState(message: intercityErrorMessage(_error), onRetry: _load);
    }
    if (requests == null) return const Center(child: CircularProgressIndicator());
    if (requests.isEmpty) {
      return RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          children: [
            const SizedBox(height: kSpace8),
            AppEmptyState(
              icon: Icons.campaign_outlined,
              title: l10n.icReqBoardEmpty,
              message: l10n.icReqBoardEmptyHint,
            ),
          ],
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        padding: const EdgeInsets.all(kSpace4),
        itemCount: requests.length,
        separatorBuilder: (_, __) => const SizedBox(height: kSpace3),
        itemBuilder: (_, i) => _BoardTile(
          request: requests[i],
          busy: _busyId == requests[i].id,
          onAccept: _busyId == null && !_choosing ? () => _accept(requests[i]) : null,
        ),
      ),
    );
  }
}

class _BoardTile extends StatelessWidget {
  const _BoardTile({required this.request, required this.busy, this.onAccept});

  final IntercityRequest request;
  final bool busy;
  final VoidCallback? onAccept;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final what = request.isWholeCar ? l10n.icKindWholeCar : l10n.icReqSeats(request.seats);
    return AgSurfaceCard(
      key: ValueKey('ic_board_${request.id}'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  intercityRouteLabel(request.originName, request.destinationName),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: kFontBodyLg, fontWeight: FontWeight.w700, color: kInk),
                ),
              ),
              const SizedBox(width: kSpace2),
              AppStatusBadge(
                label: intercityClassLabel(request.tripClass),
                tone: request.isComfort ? AppStatusTone.success : AppStatusTone.neutral,
                dense: true,
              ),
            ],
          ),
          const SizedBox(height: kSpace1),
          Text(
            '${formatTashkentWindow(request.windowStart, request.windowEnd)} · $what',
            style: const TextStyle(fontSize: kFontLabel, fontWeight: FontWeight.w600, color: kInk),
          ),
          const SizedBox(height: kSpace2),
          _Place(icon: Icons.trip_origin_rounded, text: request.pickup.address),
          const SizedBox(height: kSpace1),
          _Place(icon: Icons.flag_rounded, text: request.dropoff.address),
          const SizedBox(height: kSpace3),
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      Formatters.formatPrice(request.total),
                      key: ValueKey('ic_board_total_${request.id}'),
                      style: const TextStyle(fontSize: kFontH2, fontWeight: FontWeight.w800, color: kInk),
                    ),
                    if (request.bonus > 0)
                      Text(
                        l10n.icReqBoardBonus(Formatters.formatPrice(request.bonus)),
                        style: const TextStyle(fontSize: kFontCaption, fontWeight: FontWeight.w700, color: kSuccessDeep),
                      ),
                  ],
                ),
              ),
              SizedBox(
                width: 150,
                child: AppButton(
                  key: ValueKey('ic_board_accept_${request.id}'),
                  label: l10n.icReqAccept,
                  height: kControlHeightDriver,
                  isLoading: busy,
                  isEnabled: onAccept != null,
                  onPressed: onAccept,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Place extends StatelessWidget {
  const _Place({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) => Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 16, color: kInkMuted),
          const SizedBox(width: kSpace2),
          Expanded(
            child: Text(
              text,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: kFontLabel, color: kInkMuted),
            ),
          ),
        ],
      );
}

/// Haydovchi tanlovi: mavjud qatnov YOKI yangi qatnov jo'nash vaqti.
class _AcceptChoice {
  const _AcceptChoice.trip(String this.tripId) : departureAt = null;
  const _AcceptChoice.newTrip(DateTime this.departureAt) : tripId = null;

  final String? tripId;
  final DateTime? departureAt;
}

/// Mos qatnov bo'lsa — faqat o'shalar (server baribir mos qatnovga
/// qo'shadi, yangi vaqt so'rash chalg'itardi); bo'lmasa — jo'nash vaqti.
class _AcceptSheet extends StatefulWidget {
  const _AcceptSheet({
    required this.request,
    required this.trips,
    required this.slots,
    required this.overlapsOnly,
    required this.earliest,
  });

  final IntercityRequest request;
  final List<IntercityTrip> trips;
  final List<DateTime> slots;

  /// Oraliqda vaqt bor edi, lekin hammasi boshqa qatnov bilan to'qnashadi.
  final bool overlapsOnly;
  final DateTime earliest;

  @override
  State<_AcceptSheet> createState() => _AcceptSheetState();
}

/// Standart vaqt eng erta vaqtdan kamida shuncha keyin — haydovchi oynani
/// o'qib turguncha u "hozir + 10 daq" chegarasidan o'tib ketmasin.
const Duration _kSlotSlack = Duration(minutes: 5);

class _AcceptSheetState extends State<_AcceptSheet> {
  late final List<IntercityTrip> _roomy = [
    for (final trip in widget.trips)
      if (intercityTripHasRoomFor(widget.request, trip)) trip,
  ];
  late String? _tripId = _roomy.isEmpty ? null : _roomy.first.id;
  late DateTime? _departure = _defaultSlot();

  bool get _usesTrip => widget.trips.isNotEmpty;

  DateTime? _defaultSlot() {
    final threshold = widget.earliest.add(_kSlotSlack);
    for (final slot in widget.slots) {
      if (!slot.isBefore(threshold)) return slot;
    }
    return widget.slots.isEmpty ? null : widget.slots.first;
  }

  _AcceptChoice? get _choice {
    if (_usesTrip) return _tripId == null ? null : _AcceptChoice.trip(_tripId!);
    return _departure == null ? null : _AcceptChoice.newTrip(_departure!);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final request = widget.request;
    final choice = _choice;
    return SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.8),
        child: Padding(
          padding: const EdgeInsets.all(kSpace4),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                l10n.icReqAcceptTitle,
                style: const TextStyle(fontSize: kFontH2, fontWeight: FontWeight.w800, color: kInk),
              ),
              const SizedBox(height: kSpace1),
              Text(
                '${intercityRouteLabel(request.originName, request.destinationName)} · '
                '${formatTashkentWindow(request.windowStart, request.windowEnd)} · '
                '${Formatters.formatPrice(request.total)}',
                style: const TextStyle(fontSize: kFontLabel, color: kInkMuted),
              ),
              const SizedBox(height: kSpace3),
              Text(
                _usesTrip ? l10n.icReqAcceptPickTrip : l10n.icReqAcceptPickTime,
                style: const TextStyle(fontSize: kFontLabel, fontWeight: FontWeight.w700, color: kInk),
              ),
              const SizedBox(height: kSpace2),
              Flexible(child: SingleChildScrollView(child: _usesTrip ? _tripOptions() : _slotOptions(context))),
              const SizedBox(height: kSpace3),
              AppButton(
                key: const ValueKey('ic_board_accept_confirm'),
                label: l10n.icReqAcceptConfirm,
                height: kControlHeightDriver,
                isEnabled: choice != null,
                onPressed: choice == null ? null : () => Navigator.of(context).pop(choice),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Joyi yetmagan qatnov ham ko'rsatiladi (o'chiq): server uni baribir
  /// tanlaydi, shuning uchun bu so'rovni yangi qatnov bilan olib bo'lmaydi.
  Widget _tripOptions() {
    final l10n = context.l10n;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final trip in widget.trips)
          RadioListTile<String>(
            key: ValueKey('ic_board_trip_${trip.id}'),
            value: trip.id,
            groupValue: _tripId,
            onChanged: intercityTripHasRoomFor(widget.request, trip) ? (id) => setState(() => _tripId = id) : null,
            contentPadding: EdgeInsets.zero,
            title: Text(formatTashkentDayTime(trip.departureAt)),
            subtitle: Text(
              intercityTripHasRoomFor(widget.request, trip)
                  ? l10n.icDrvSeatsTaken(trip.seatsTaken, trip.seatsTotal)
                  : l10n.icReqAcceptNoRoom,
            ),
          ),
        if (_roomy.isEmpty) ...[
          const SizedBox(height: kSpace1),
          Text(
            l10n.icReqAcceptNoRoomHint,
            key: const ValueKey('ic_board_no_room'),
            style: const TextStyle(fontSize: kFontLabel, color: kErrorDeep),
          ),
        ],
      ],
    );
  }

  Widget _slotOptions(BuildContext context) {
    final l10n = context.l10n;
    if (widget.slots.isEmpty) {
      return Text(
        widget.overlapsOnly ? l10n.icReqAcceptOverlap : l10n.icReqAcceptTooLate,
        key: const ValueKey('ic_board_no_slots'),
        style: const TextStyle(fontSize: kFontLabel, color: kErrorDeep),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(l10n.icReqAcceptNewTripHint, style: const TextStyle(fontSize: kFontCaption, color: kInkMuted)),
        const SizedBox(height: kSpace2),
        Wrap(
          spacing: kSpace2,
          runSpacing: kSpace2,
          children: [
            for (final slot in widget.slots)
              ChoiceChip(
                key: ValueKey('ic_board_slot_${slot.toIso8601String()}'),
                label: Text(
                  tashkentDateKey(widget.request.windowStart) == tashkentDateKey(widget.request.windowEnd)
                      ? formatTashkentTime(slot)
                      : formatTashkentDayTime(slot),
                ),
                selected: slot == _departure,
                onSelected: (_) => setState(() => _departure = slot),
              ),
          ],
        ),
      ],
    );
  }
}
