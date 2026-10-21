import type { Messages } from '../uz';

export const audit: Messages['audit'] = {
  title: 'Журнал действий',
  description:
    'Ручная корректировка кошелька, отмена смены, смена ИНН и возврат по карте — кто, когда, сколько и почему',
  allActions: 'Все действия',
  allTargets: 'Все объекты',
  colDate: 'Дата',
  colAction: 'Действие',
  colTarget: 'Объект',
  colAmount: 'Сумма',
  colNote: 'Комментарий',
  colActor: 'Исполнитель',
  loadFailed: 'Не удалось загрузить журнал действий',
  emptyTitle: 'Журнал пуст',
  emptyDesc: 'Запись появится здесь после ручной корректировки кошелька или отмены смены.',
  actionType: 'Тип действия',
  targetType: 'Тип объекта',
  targetId: 'ID объекта',
  targetIdPlaceholder: 'ID объекта (полный UUID)',
  targetIdError: 'Введите полный UUID',
  actor: {
    deletedUser: 'Пользователь удалён',
    system: 'Система',
  },
  roleLabels: {
    admin: 'Админ',
    manager: 'Менеджер',
    driver: 'Водитель',
    passenger: 'Пассажир',
    market: 'Магазин',
    restaurant: 'Ресторан',
  },
};
