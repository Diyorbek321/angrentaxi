import type { Messages } from '../uz';

export const legalDocs: Messages['legalDocs'] = {
  title: 'Правовые документы',
  description:
    'Текущие редакции оферт и политики конфиденциальности и число принявших их. Тексты — ЧЕРНОВИК (нужна проверка юриста). Версия меняется в LEGAL_VERSIONS в коде.',
  loadError: 'Не удалось загрузить данные о документах',
  emptyTitle: 'Нет данных',
  names: {
    terms: 'Оферта для пользователей',
    'driver-terms': 'Оферта для водителей',
    'vendor-terms': 'Условия для продавцов',
    privacy: 'Политика конфиденциальности',
  },
  col: {
    document: 'Документ',
    version: 'Текущая редакция',
    accepted: 'Приняли',
    required: 'Требуется',
    share: 'Доля',
    older: 'На старой редакции',
    lastAccepted: 'Последнее согласие',
    open: 'Текст',
  },
  openUz: 'Узбекский',
  openRu: 'Русский',
  noUsers: '—',
  draft: 'ЧЕРНОВИК',
};
