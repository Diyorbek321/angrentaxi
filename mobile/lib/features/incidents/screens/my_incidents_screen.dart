import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/features/incidents/incident_labels.dart';
import 'package:angren_taxi/features/incidents/incidents_service.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/incident.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/app_empty_state.dart';
import 'package:angren_taxi/shared/widgets/error_widget.dart';
import 'package:flutter/material.dart';

/// "Murojaatlarim": men qoldirgan shikoyatlar va menga nisbatan choralar
/// (ogohlantirish, to'xtatish, blok, jarima) — e'tiroz tugmasi bilan.
class MyIncidentsScreen extends StatefulWidget {
  const MyIncidentsScreen({super.key, this.service, this.initialTab = 0});

  final IncidentsService? service;

  /// 0 — shikoyatlarim, 1 — menga nisbatan (masalan to'xtatish xabaridan).
  final int initialTab;

  @override
  State<MyIncidentsScreen> createState() => _MyIncidentsScreenState();
}

class _MyIncidentsScreenState extends State<MyIncidentsScreen> {
  late final IncidentsService _service = widget.service ?? IncidentsService(sl<ApiClient>());
  List<ReporterIncident> _mine = const [];
  IncidentAboutMe _aboutMe = const IncidentAboutMe();
  bool _loading = true;
  String? _error;
  String? _busyId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final results = await Future.wait([_service.mine(), _service.aboutMe()]);
      if (!mounted) return;
      setState(() {
        _mine = results[0] as List<ReporterIncident>;
        _aboutMe = results[1] as IncidentAboutMe;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = extractErrorMessage(e);
        _loading = false;
      });
    }
  }

  Future<void> _appeal(SubjectIncident item) async {
    final l10n = context.l10n;
    final note = await showDialog<String>(context: context, builder: (_) => const _AppealDialog());
    if (!mounted || note == null || note.length < 3) return;
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _busyId = item.id);
    try {
      await _service.appeal(item.id, note);
      if (!mounted) return;
      setState(() {
        _aboutMe = IncidentAboutMe(
          suspension: _aboutMe.suspension,
          items: [for (final i in _aboutMe.items) i.id == item.id ? i.appealed(DateTime.now()) : i],
        );
        _busyId = null;
      });
      messenger.showSnackBar(SnackBar(content: Text(l10n.incAppealSent)));
    } catch (e) {
      if (!mounted) return;
      setState(() => _busyId = null);
      messenger.showSnackBar(SnackBar(content: Text(extractErrorMessage(e))));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return DefaultTabController(
      length: 2,
      initialIndex: widget.initialTab.clamp(0, 1),
      child: Scaffold(
        appBar: AppBar(
          title: Text(l10n.incMyTitle),
          bottom: TabBar(tabs: [Tab(text: l10n.incTabMine), Tab(text: l10n.incTabAboutMe)]),
        ),
        body: SafeArea(
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : _error != null
                  ? AppErrorState(message: _error!, onRetry: _load)
                  : TabBarView(children: [_mineTab(l10n), _aboutMeTab(l10n)]),
        ),
      ),
    );
  }

  Widget _mineTab(AppLocalizations l10n) {
    if (_mine.isEmpty) {
      return AppEmptyState(
        icon: Icons.support_agent_rounded,
        title: l10n.incEmptyMine,
        message: l10n.incEmptyMineBody,
      );
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        padding: const EdgeInsets.all(kSpace4),
        itemCount: _mine.length,
        separatorBuilder: (_, __) => const SizedBox(height: kSpace3),
        itemBuilder: (_, i) => _ReporterCard(item: _mine[i]),
      ),
    );
  }

  Widget _aboutMeTab(AppLocalizations l10n) {
    final suspension = _aboutMe.suspension;
    if (_aboutMe.items.isEmpty && suspension == null) {
      return AppEmptyState(
        icon: Icons.verified_user_outlined,
        title: l10n.incEmptyAboutMe,
        message: l10n.incEmptyAboutMeBody,
      );
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(kSpace4),
        children: [
          if (suspension != null) ...[
            SuspensionBanner(suspension: suspension),
            const SizedBox(height: kSpace3),
          ],
          for (final item in _aboutMe.items) ...[
            _SubjectCard(item: item, busy: _busyId == item.id, onAppeal: () => _appeal(item)),
            const SizedBox(height: kSpace3),
          ],
        ],
      ),
    );
  }
}

/// Dialog o'z kontrollerini o'zi boshqaradi — yopilish animatsiyasi paytida
/// tashqarida dispose qilingan kontroller ishlatilmasin.
class _AppealDialog extends StatefulWidget {
  const _AppealDialog();

  @override
  State<_AppealDialog> createState() => _AppealDialogState();
}

class _AppealDialogState extends State<_AppealDialog> {
  final TextEditingController _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return AlertDialog(
      title: Text(l10n.incAppealTitle),
      content: TextField(
        key: const ValueKey('incident-appeal-note'),
        controller: _controller,
        autofocus: true,
        maxLength: 1000,
        maxLines: 4,
        decoration: InputDecoration(hintText: l10n.incAppealHint),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.of(context).pop(), child: Text(l10n.incCancel)),
        FilledButton(
          onPressed: () => Navigator.of(context).pop(_controller.text.trim()),
          child: Text(l10n.incSubmit),
        ),
      ],
    );
  }
}

BoxDecoration _cardDecoration() => BoxDecoration(
      color: kSurface,
      borderRadius: BorderRadius.circular(kRadiusMd),
      border: Border.all(color: kLine),
    );

const _muted = TextStyle(color: kInkMuted, fontSize: kFontLabel);

class _Header extends StatelessWidget {
  const _Header({required this.category, required this.status, required this.date});

  final String category;
  final IncidentStatus status;
  final DateTime? date;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Row(
      children: [
        Expanded(
          child: Text(
            incidentCategoryLabel(l10n, category),
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: kFontBodyLg),
          ),
        ),
        Text(incidentStatusLabel(l10n, status), style: const TextStyle(fontWeight: FontWeight.w600)),
        if (date != null) ...[
          const SizedBox(width: kSpace2),
          Text(Formatters.formatDate(date!), style: _muted),
        ],
      ],
    );
  }
}

class _ReporterCard extends StatelessWidget {
  const _ReporterCard({required this.item});

  final ReporterIncident item;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Container(
      padding: const EdgeInsets.all(kSpace4),
      decoration: _cardDecoration(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _Header(category: item.category, status: item.status, date: item.createdAt),
          const SizedBox(height: kSpace2),
          Text(item.description),
          if (item.photoCount > 0) ...[
            const SizedBox(height: kSpace1),
            Text(l10n.incPhotoCount(item.photoCount), style: _muted),
          ],
          if (item.resolutionNote != null) ...[
            const SizedBox(height: kSpace2),
            Text(l10n.incResolution(item.resolutionNote!), style: const TextStyle(fontWeight: FontWeight.w600)),
          ],
          if (item.refundAmount > 0) ...[
            const SizedBox(height: kSpace1),
            Text(
              l10n.incRefunded(Formatters.formatSom(item.refundAmount)),
              style: const TextStyle(color: kPrimary, fontWeight: FontWeight.w700),
            ),
          ],
        ],
      ),
    );
  }
}

class _SubjectCard extends StatelessWidget {
  const _SubjectCard({required this.item, required this.busy, required this.onAppeal});

  final SubjectIncident item;
  final bool busy;
  final VoidCallback onAppeal;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final appeal = item.appeal;
    return Container(
      padding: const EdgeInsets.all(kSpace4),
      decoration: _cardDecoration(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _Header(category: item.category, status: item.status, date: item.resolvedAt),
          if (item.safetySuspended && item.status != IncidentStatus.resolved) ...[
            const SizedBox(height: kSpace2),
            Text(l10n.incSafetySuspended, style: const TextStyle(color: kErrorDeep)),
          ],
          for (final s in item.sanctions) ...[
            const SizedBox(height: kSpace1),
            Text('• ${incidentSanctionLabel(l10n, s)}'),
          ],
          if (item.resolutionNote != null) ...[
            const SizedBox(height: kSpace2),
            Text(l10n.incReason(item.resolutionNote!), style: _muted),
          ],
          if (appeal.pending) ...[
            const SizedBox(height: kSpace2),
            Text(l10n.incAppealPending, style: const TextStyle(fontWeight: FontWeight.w600)),
          ],
          if (appeal.decision != null) ...[
            const SizedBox(height: kSpace2),
            Text(
              appeal.decision == 'overturned' ? l10n.incAppealOverturned : l10n.incAppealUpheld,
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ],
          if (appeal.canAppeal) ...[
            const SizedBox(height: kSpace3),
            if (appeal.deadline != null)
              Text(l10n.incAppealDeadline(Formatters.formatDateTime(appeal.deadline!)), style: _muted),
            const SizedBox(height: kSpace2),
            OutlinedButton(
              key: ValueKey('incident-appeal-${item.id}'),
              onPressed: busy ? null : onAppeal,
              style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(kMinTapTarget)),
              child: Text(l10n.incAppealAction),
            ),
          ],
        ],
      ),
    );
  }
}

/// To'xtatish: muddat va sabab — ham "Murojaatlarim" da, ham onlayn
/// chiqish rad etilganda.
class SuspensionBanner extends StatelessWidget {
  const SuspensionBanner({super.key, required this.suspension});

  final AccountSuspension suspension;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Container(
      padding: const EdgeInsets.all(kSpace4),
      decoration: BoxDecoration(color: kErrorLight, borderRadius: BorderRadius.circular(kRadiusMd)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            l10n.incSuspendedBanner(Formatters.formatDateTime(suspension.until)),
            style: const TextStyle(color: kErrorDeep, fontWeight: FontWeight.w800),
          ),
          if (suspension.reason != null) ...[
            const SizedBox(height: kSpace1),
            Text(l10n.incReason(suspension.reason!), style: const TextStyle(color: kErrorDeep)),
          ],
        ],
      ),
    );
  }
}
