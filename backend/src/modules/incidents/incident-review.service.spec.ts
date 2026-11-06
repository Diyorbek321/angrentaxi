import { IncidentReviewService } from './incident-review.service';
import { IncidentStatus } from '../../database/entities/incident.entity';

describe('IncidentReviewService', () => {
  const now = new Date('2026-11-04T12:00:00Z');
  const incident = {
    id: 'i1',
    reporterUserId: 'pax',
    subjectUserId: 'drv',
    orderVertical: 'taxi',
    orderId: 'o1',
    status: IncidentStatus.OPEN,
    photoKeys: ['incident-photos/secret.jpg'],
    createdAt: new Date('2026-11-04T09:00:00Z'),
    assignedManagerId: null,
  };

  function build() {
    const repo = {
      findAndCount: jest.fn(async () => [[incident], 1]),
      findOne: jest.fn(async () => incident),
      find: jest.fn(async () => [incident, { id: 'old', category: 'rude' }]),
      count: jest.fn(async () => 2),
      createQueryBuilder: jest.fn(),
    };
    const dataSource = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FROM users u')) {
          return [
            { id: 'drv', first_name: 'Ali', role: 'driver', status: 'active', driver_rating: '4.10', passenger_rating: null, passenger_rating_count: 0 },
            { id: 'pax', first_name: 'Vali', role: 'passenger', status: 'active', passenger_rating: '3.50', passenger_rating_count: 4 },
          ];
        }
        if (sql.includes('COUNT(*)')) return [{ strikes: 2 }];
        if (sql.includes('FROM orders')) return [{ id: 'o1', passenger_id: 'pax', driver_id: 'drv', status: 'completed', completed_at: now }];
        if (sql.includes('FROM ratings')) return [{ id: 'r1', fromRole: 'passenger', score: 1, comment: 'Yomon' }];
        return [];
      }),
    };
    return { service: new IncidentReviewService(repo as never, dataSource as never), repo, dataSource };
  }

  it("ro'yxat: SLA soati, ishtirokchilar va baholari, foto kaliti yashirin", async () => {
    const { items } = await build().service.list({ status: 'active' }, now);
    expect(items[0]).toMatchObject({
      ageHours: 3,
      photoKeys: ['0'],
      subject: { name: 'Ali', driverRating: 4.1 },
      reporter: { passengerRating: 3.5, passengerRatingCount: 4 },
    });
  });

  it("tafsilot: baholar dalili va zinapoya taklifi (2 + shu = 3 → to'xtatish)", async () => {
    const detail = await build().service.detail('i1', now);
    expect(detail.evidence.ratings).toHaveLength(1);
    expect(detail.strikes).toMatchObject({ confirmed: 2, suggestion: 'suspension' });
    expect(detail.subjectHistory.map((h) => h.id)).toEqual(['old']);
    expect(detail.order).toMatchObject({ rideOrderId: 'o1', driverUserId: 'drv' });
  });

  it('ochiq soni', async () => {
    await expect(build().service.openCount()).resolves.toEqual({ count: 2, escalated: 2 });
  });
});
