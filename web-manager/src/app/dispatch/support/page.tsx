'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { MessageCircle, MessagesSquare, Search, Send } from 'lucide-react';
import { clsx } from 'clsx';
import {
  getSupportMessages,
  sendSupportMessage,
  markSupportThreadRead,
  setSupportThreadStatus,
  SupportMessage,
  SupportThreadListItem,
} from '@/lib/api';
import { getSocket, subscribeToSocket, SOCKET_EVENTS } from '@/lib/socket';
import { useSupportThreads } from '@/hooks/useSupportThreads';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { Tabs } from '@/components/ui/Tabs';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { formatPhone, formatTime } from '@/lib/format';

type ThreadFilter = 'all' | 'open' | 'closed';

const THREAD_TABS: { value: ThreadFilter; label: string }[] = [
  { value: 'open', label: 'Ochiq' },
  { value: 'closed', label: 'Yopiq' },
  { value: 'all', label: 'Hammasi' },
];

export default function SupportPage() {
  const { toast } = useToast();
  const {
    threads,
    isLoading: threadsLoading,
    error: threadsError,
    refetch: refetchThreads,
  } = useSupportThreads();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [filter, setFilter] = useState<ThreadFilter>('open');
  const [search, setSearch] = useState('');
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;
  const bottomRef = useRef<HTMLDivElement>(null);

  const selectedThread: SupportThreadListItem | undefined = threads.find(
    (t) => t.id === selectedId
  );

  // Unread badge is bound to real per-thread counts — a permanently lit badge
  // trains the operator to ignore all badges (SKILL.md badge discipline).
  const totalUnread = threads.reduce((sum, t) => sum + t.unreadCount, 0);

  const visibleThreads = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return threads
      .filter((t) => (filter === 'all' ? true : t.status === filter))
      .filter((t) =>
        needle === ''
          ? true
          : t.userName.toLowerCase().includes(needle) || t.userPhone.includes(needle)
      )
      .sort((a, b) => {
        // Unread first — that is the operator's queue — then most recent.
        if ((a.unreadCount > 0) !== (b.unreadCount > 0)) return a.unreadCount > 0 ? -1 : 1;
        const at = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const bt = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return bt - at;
      });
  }, [threads, filter, search]);

  const selectThread = useCallback((id: string) => {
    // Room swap is fire-and-forget: socket.io buffers the emits if the socket
    // is still mid-handshake, so the selection can update immediately.
    const leaving = selectedIdRef.current;
    setSelectedId(id);
    const socket = getSocket();
    if (leaving) {
      socket.emit(SOCKET_EVENTS.LEAVE_SUPPORT_THREAD, { threadId: leaving });
    }
    socket.emit(SOCKET_EVENTS.JOIN_SUPPORT_THREAD, { threadId: id });
  }, []);

  const loadMessages = useCallback((threadId: string) => {
    setMessagesLoading(true);
    getSupportMessages(threadId)
      .then((data) => {
        setMessages(data.messages);
        setMessagesError(null);
      })
      .catch(() => {
        // Named, never swallowed — the operator must know the conversation is
        // incomplete rather than assume the customer wrote nothing.
        setMessages([]);
        setMessagesError('Xabarlarni yuklab boʻlmadi.');
      })
      .finally(() => setMessagesLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    loadMessages(selectedId);
    markSupportThreadRead(selectedId).then(refetchThreads).catch(() => {});
  }, [selectedId, refetchThreads, loadMessages]);

  useEffect(() => {
    const handleNewMessage = (message: SupportMessage) => {
      if (message.threadId !== selectedIdRef.current) return;
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
    };

    return subscribeToSocket((socket) => {
      socket.on(SOCKET_EVENTS.SUPPORT_MESSAGE_NEW, handleNewMessage);
      return () => {
        socket.off(SOCKET_EVENTS.SUPPORT_MESSAGE_NEW, handleNewMessage);
      };
    });
  }, []);

  // Keep the newest message in view as the conversation grows.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  const handleSend = async () => {
    if (!selectedId || !draft.trim()) return;
    setSending(true);
    try {
      const message = await sendSupportMessage(selectedId, draft.trim());
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
      setDraft('');
    } catch (err) {
      console.error('Failed to send support message:', err);
      toast({
        title: 'Xabar yuborilmadi',
        description: 'Matn saqlanib qoldi — qayta yuborib koʻring.',
        variant: 'error',
      });
    } finally {
      setSending(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!selectedThread) return;
    const nextStatus = selectedThread.status === 'open' ? 'closed' : 'open';
    setStatusSaving(true);
    try {
      await setSupportThreadStatus(selectedThread.id, nextStatus);
      await refetchThreads();
      toast({
        title: nextStatus === 'closed' ? 'Murojaat yopildi' : 'Murojaat qayta ochildi',
        description: selectedThread.userName,
        variant: 'success',
      });
    } catch (err) {
      console.error('Failed to change support thread status:', err);
      toast({ title: 'Murojaat holatini oʻzgartirib boʻlmadi', variant: 'error' });
    } finally {
      setStatusSaving(false);
    }
  };

  const hasThreadFilters = filter !== 'open' || search !== '';

  return (
    <div className="h-full flex bg-bg">
      {/* Thread list */}
      <aside className="w-72 lg:w-80 shrink-0 border-r border-line bg-surface flex flex-col">
        <div className="px-4 py-3 border-b border-line shrink-0">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-ink">Qoʻllab-quvvatlash</h2>
            {totalUnread > 0 && (
              <Badge variant="danger" size="sm">
                {totalUnread} oʻqilmagan
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted mt-0.5">Mijoz va haydovchi murojaatlari</p>
        </div>

        <div className="px-3 pt-3 pb-2 space-y-2 shrink-0">
          <Input
            placeholder="Ism yoki telefon"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftElement={<Search size={14} />}
            aria-label="Murojaatlarni qidirish"
          />
          <Tabs
            items={THREAD_TABS}
            value={filter}
            onChange={setFilter}
            size="sm"
            className="w-full"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
          {threadsError ? (
            <ErrorState
              compact
              message="Murojaatlar roʻyxatini yuklab boʻlmadi."
              onRetry={refetchThreads}
            />
          ) : threadsLoading ? (
            <div aria-busy="true" className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-ds-sm" />
              ))}
            </div>
          ) : visibleThreads.length === 0 ? (
            hasThreadFilters ? (
              <EmptyState
                compact
                icon={<Search size={20} />}
                title="Mos murojaat topilmadi"
                description="Qidiruv yoki holat filtrini oʻzgartiring."
                action={
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSearch('');
                      setFilter('open');
                    }}
                  >
                    Filtrlarni tozalash
                  </Button>
                }
              />
            ) : (
              <EmptyState
                compact
                tone="positive"
                icon={<MessageCircle size={20} />}
                title="Ochiq murojaat yoʻq"
                description="Yangi murojaat kelsa shu yerda koʻrinadi."
              />
            )
          ) : (
            visibleThreads.map((thread) => (
              <button
                key={thread.id}
                onClick={() => selectThread(thread.id)}
                aria-current={thread.id === selectedId ? 'true' : undefined}
                className={clsx(
                  'w-full text-left rounded-ds-sm border px-3 py-2.5 transition-colors',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
                  thread.id === selectedId
                    ? 'border-primary bg-primary/[0.08]'
                    : 'border-line hover:bg-surface-2'
                )}
              >
                <div className="flex items-center gap-2">
                  <Avatar name={thread.userName} size="xs" tone="muted" />
                  <span className="text-sm font-medium text-ink truncate">{thread.userName}</span>
                  {thread.unreadCount > 0 && (
                    <Badge variant="danger" size="sm" className="ml-auto shrink-0">
                      {thread.unreadCount}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 mt-1.5">
                  <span className="text-[11px] font-mono text-muted truncate">
                    {formatPhone(thread.userPhone)}
                  </span>
                  <span className="text-[11px] text-subtle shrink-0 tabular-nums">
                    {thread.lastMessageAt ? formatTime(thread.lastMessageAt) : ''}
                  </span>
                </div>
                <Badge
                  variant={thread.status === 'open' ? 'mint-soft' : 'default'}
                  size="sm"
                  className="mt-1.5"
                >
                  {thread.status === 'open' ? 'Ochiq' : 'Yopiq'}
                </Badge>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Conversation */}
      <section className="flex-1 flex flex-col min-w-0">
        {!selectedThread ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <EmptyState
              icon={<MessagesSquare size={22} />}
              title="Suhbat tanlanmagan"
              description="Chapdagi roʻyxatdan murojaatni tanlang."
            />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-line bg-surface px-5 py-3 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar name={selectedThread.userName} size="sm" tone="muted" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink truncate">
                    {selectedThread.userName}
                  </p>
                  <p className="text-xs text-muted truncate">
                    <span className="font-mono">{formatPhone(selectedThread.userPhone)}</span> ·{' '}
                    {selectedThread.userRole === 'driver' ? 'Haydovchi' : 'Yoʻlovchi'}
                  </p>
                </div>
              </div>
              <Button
                variant={selectedThread.status === 'open' ? 'secondary' : 'primary'}
                size="sm"
                onClick={handleToggleStatus}
                isLoading={statusSaving}
              >
                {selectedThread.status === 'open' ? 'Yopish' : 'Qayta ochish'}
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {messagesError ? (
                <ErrorState
                  compact
                  message={messagesError}
                  onRetry={() => {
                    if (selectedId) loadMessages(selectedId);
                  }}
                />
              ) : messagesLoading ? (
                <div className="space-y-3" aria-busy="true">
                  <Skeleton className="h-10 w-2/3 rounded-ds-md" />
                  <Skeleton className="h-10 w-1/2 rounded-ds-md ml-auto" />
                  <Skeleton className="h-10 w-3/5 rounded-ds-md" />
                </div>
              ) : messages.length === 0 ? (
                <EmptyState
                  compact
                  icon={<MessageCircle size={20} />}
                  title="Xabarlar yoʻq"
                  description="Suhbatni birinchi boʻlib boshlang."
                />
              ) : (
                messages.map((message) => {
                  const fromOperator =
                    message.senderRole === 'manager' || message.senderRole === 'admin';
                  return (
                    <div
                      key={message.id}
                      className={clsx('flex', fromOperator ? 'justify-end' : 'justify-start')}
                    >
                      <div
                        className={clsx(
                          'max-w-[72%] rounded-ds-md px-3.5 py-2.5 text-sm border',
                          fromOperator
                            ? 'bg-primary/12 border-primary/30 text-ink rounded-br-ds-xs'
                            : 'bg-surface border-line text-ink rounded-bl-ds-xs'
                        )}
                      >
                        <p className="whitespace-pre-wrap break-words">{message.body}</p>
                        <p className="text-[10px] text-subtle mt-1 text-right font-mono tabular-nums">
                          {formatTime(message.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            <div className="border-t border-line bg-surface p-3 shrink-0">
              <div className="flex items-center gap-2">
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Javob yozing…"
                  className="flex-1"
                  aria-label="Javob matni"
                />
                <Button
                  onClick={handleSend}
                  isLoading={sending}
                  disabled={!draft.trim()}
                  aria-label="Yuborish"
                >
                  <Send size={16} />
                </Button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
