"use client";

import { useCallback, useEffect, useRef, useState } from "react";
function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const currentYear = new Date().getFullYear();
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (d.getFullYear() !== currentYear) opts.year = "numeric";
  return d.toLocaleDateString("en-US", opts);
}

interface Action {
  jsa_rid: number;
  activity_description: string;
  action_type: "move_start" | "change_duration" | "set_status";
  current_value?: string | number;
  value: string | number;
  explanation: string;
}

interface AIResponse {
  type: "action" | "answer" | "clarification" | "error";
  interpretation?: string;
  actions?: Action[];
  answer?: string;
  message?: string;
  options?: string[];
  _meta?: { model: string; duration_ms: number; tokens?: { input: number; output: number } | null };
}

interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  response?: AIResponse;
  loading?: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  scheduleRid: number;
  jobLabel: string;
  selectedJsaRid: number | null;
  selectedActivityName?: string | null;
  onStageEdit: (jsaRid: number, moveType: "move_start" | "change_duration", value: string | number) => Promise<void>;
  onStatusUpdate: (jsaRid: number, status: string, note: string) => Promise<void>;
  onRefresh: () => void;
}

const EXAMPLES = [
  "Push drywall back 3 days",
  "Extend framing by a week",
  "When does settlement happen?",
  "Mark install windows as complete",
  "What activities are late?",
];

export function ChatPanel({ open, onClose, scheduleRid, jobLabel, selectedJsaRid, selectedActivityName, onStageEdit, onStatusUpdate, onRefresh }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [stagingAction, setStagingAction] = useState<{ msgId: number; actionIdx: number } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputWrapRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  // Build conversation history for context — summarize assistant responses for readability
  const getHistory = useCallback(() => {
    return messages
      .filter((m) => !m.loading)
      .map((m) => {
        if (m.role === "user") return { role: "user" as const, content: m.content };
        const r = m.response;
        if (!r) return { role: "assistant" as const, content: m.content };
        let summary = "";
        if (r.type === "action" && r.actions) {
          summary = (r.interpretation ?? "") + " Actions: " + r.actions.map((a) =>
            `${a.activity_description}: ${a.action_type}=${a.value}`
          ).join("; ");
          if (m.content.endsWith("✅")) summary += " [Applied]";
        } else if (r.type === "answer") {
          summary = r.answer ?? "";
        } else if (r.type === "clarification") {
          summary = r.message ?? "";
        } else if (r.type === "error") {
          summary = "Error: " + (r.message ?? "");
        }
        return { role: "assistant" as const, content: summary };
      });
  }, [messages]);

  async function send(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;
    setInput("");

    const userMsg: ChatMessage = { id: nextId.current++, role: "user", content: msg };
    const loadingMsg: ChatMessage = { id: nextId.current++, role: "assistant", content: "", loading: true };
    setMessages((prev) => [...prev, userMsg, loadingMsg]);
    setSending(true);

    try {
      const res = await fetch("/api/ai/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          schedule_rid: scheduleRid,
          selected_jsa_rid: selectedJsaRid,
          conversation_history: getHistory(),
        }),
      });

      const data: AIResponse = await res.json();
      setMessages((prev) =>
        prev.map((m) => (m.id === loadingMsg.id ? { ...m, loading: false, content: data.interpretation ?? data.message ?? data.answer ?? "", response: data } : m)),
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m.id === loadingMsg.id ? { ...m, loading: false, content: "Something went wrong. Please try again.", response: { type: "error", message: "Network error" } } : m)),
      );
    } finally {
      setSending(false);
    }
  }

  async function handleStage(msgId: number, actions: Action[]) {
    const moveActions = actions.filter((a) => a.action_type !== "set_status");
    const statusActions = actions.filter((a) => a.action_type === "set_status");

    setStagingAction({ msgId, actionIdx: 0 });
    try {
      // Stage move actions
      for (let i = 0; i < moveActions.length; i++) {
        setStagingAction({ msgId, actionIdx: i });
        const action = moveActions[i];
        await onStageEdit(action.jsa_rid, action.action_type as "move_start" | "change_duration", action.value);
      }

      // Apply status changes immediately
      for (let i = 0; i < statusActions.length; i++) {
        setStagingAction({ msgId, actionIdx: moveActions.length + i });
        const action = statusActions[i];
        await onStatusUpdate(action.jsa_rid, action.value as string, `AI chat: ${action.explanation}`);
      }

      // Refresh schedule if status changed to reflect it immediately
      if (statusActions.length > 0) onRefresh();

      // Mark message as done
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, content: m.content + " ✅" } : m)),
      );
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Failed";
      setMessages((prev) => [...prev, { id: nextId.current++, role: "assistant", content: `Error: ${errMsg}`, response: { type: "error", message: errMsg } }]);
    } finally {
      setStagingAction(null);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function clearChat() {
    setMessages([]);
    nextId.current = 1;
  }

  if (!open) return null;

  return (
    <>
      {/* Mobile: uses height 100% of body, not fixed, so iOS keyboard adjusts naturally */}
      <div className="fixed inset-0 z-40 sm:hidden" role="dialog" aria-modal="true">
        <div className="flex h-full flex-col bg-white dark:bg-gray-950">
          <MobileHeader onClose={onClose} onClear={clearChat} messageCount={messages.length} jobLabel={jobLabel} />
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto">
              <ChatBody
                messages={messages}
                sending={sending}
                stagingAction={stagingAction}
                messagesEndRef={messagesEndRef}
                onStage={handleStage}
                onExample={send}
                onOptionClick={send}
              />
            </div>
            <div className="sticky bottom-0 bg-white dark:bg-gray-950">
              <ChatInput input={input} setInput={setInput} onKeyDown={handleKeyDown} onSend={() => send()} sending={sending} inputRef={inputRef} wrapRef={inputWrapRef} selectedActivityName={selectedActivityName} />
            </div>
          </div>
        </div>
      </div>

      {/* Desktop: slide-out panel */}
      <div className="fixed inset-y-0 right-0 z-40 hidden w-96 flex-col border-l border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-950 sm:flex">
        <DesktopHeader onClose={onClose} onClear={clearChat} messageCount={messages.length} jobLabel={jobLabel} />
        <ChatBody
          messages={messages}
          sending={sending}
          stagingAction={stagingAction}
          messagesEndRef={messagesEndRef}
          onStage={handleStage}
          onExample={send}
          onOptionClick={send}
        />
        <ChatInput input={input} setInput={setInput} onKeyDown={handleKeyDown} onSend={() => send()} sending={sending} inputRef={inputRef} selectedActivityName={selectedActivityName} />
      </div>
    </>
  );
}

/* ── Sub-components ── */

function MobileHeader({ onClose, onClear, messageCount, jobLabel }: { onClose: () => void; onClear: () => void; messageCount: number; jobLabel: string }) {
  return (
    <div className="flex items-center justify-between bg-blue-600 px-4 py-3 text-white">
      <div className="flex items-center gap-2">
        <button onClick={onClose} className="text-blue-100 hover:text-white">
          ← Back
        </button>
        <div>
          <h2 className="text-sm font-semibold">✨ Schedule Assistant</h2>
          <p className="text-[11px] text-blue-200">{jobLabel}</p>
        </div>
      </div>
      {messageCount > 0 && (
        <button onClick={onClear} className="text-xs text-blue-200 hover:text-white">Clear</button>
      )}
    </div>
  );
}

function DesktopHeader({ onClose, onClear, messageCount, jobLabel }: { onClose: () => void; onClear: () => void; messageCount: number; jobLabel: string }) {
  return (
    <div className="flex items-center justify-between bg-blue-600 px-4 py-3 text-white">
      <div>
        <h2 className="text-sm font-semibold">✨ Schedule Assistant</h2>
        <p className="text-[11px] text-blue-200">{jobLabel}</p>
      </div>
      <div className="flex items-center gap-2">
        {messageCount > 0 && (
          <button onClick={onClear} className="text-xs text-blue-200 hover:text-white">Clear</button>
        )}
        <button onClick={onClose} className="text-blue-100 hover:text-white">✕</button>
      </div>
    </div>
  );
}

function ChatBody({
  messages, sending, stagingAction, messagesEndRef, onStage, onExample, onOptionClick,
}: {
  messages: ChatMessage[];
  sending: boolean;
  stagingAction: { msgId: number; actionIdx: number } | null;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onStage: (msgId: number, actions: Action[]) => void;
  onExample: (text: string) => void;
  onOptionClick: (text: string) => void;
}) {
  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="text-3xl">💬</div>
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Schedule Assistant</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Describe what you want to change, or ask a question</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => onExample(ex)}
              disabled={sending}
              className="rounded-full border border-gray-200 px-3 py-1.5 text-xs text-gray-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-gray-700 dark:text-gray-400 dark:hover:border-blue-800 dark:hover:bg-blue-950 dark:hover:text-blue-300"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="space-y-3">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} stagingAction={stagingAction} onStage={onStage} onOptionClick={onOptionClick} />
        ))}
      </div>
      <div ref={messagesEndRef} />
    </div>
  );
}

function MessageBubble({
  msg, stagingAction, onStage, onOptionClick,
}: {
  msg: ChatMessage;
  stagingAction: { msgId: number; actionIdx: number } | null;
  onStage: (msgId: number, actions: Action[]) => void;
  onOptionClick: (text: string) => void;
}) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-blue-600 px-3.5 py-2 text-sm text-white">
          {msg.content}
        </div>
      </div>
    );
  }

  if (msg.loading) {
    return (
      <div className="flex justify-start">
        <div className="rounded-2xl rounded-bl-sm bg-gray-100 px-3.5 py-2 text-sm text-gray-500 dark:bg-gray-900 dark:text-gray-400">
          <span className="inline-flex gap-1">
            <span className="animate-bounce">·</span>
            <span className="animate-bounce" style={{ animationDelay: "0.1s" }}>·</span>
            <span className="animate-bounce" style={{ animationDelay: "0.2s" }}>·</span>
          </span>
        </div>
      </div>
    );
  }

  const r = msg.response;
  if (!r) return null;

  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] space-y-2 rounded-2xl rounded-bl-sm bg-gray-100 px-3.5 py-2.5 text-sm dark:bg-gray-900">
        {/* Action response */}
        {r.type === "action" && r.actions && (
          <>
            <p className="text-gray-700 dark:text-gray-300">{r.interpretation}</p>
            <div className="space-y-1.5">
              {r.actions.map((a, i) => (
                <div key={i} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs dark:border-gray-800 dark:bg-gray-950">
                  <div className="font-medium text-gray-800 dark:text-gray-200">{a.activity_description}</div>
                  <div className="mt-0.5 text-gray-500 dark:text-gray-400">
                    {a.action_type === "move_start" && (
                      <>Move start: {a.current_value ? <>{formatShortDate(a.current_value as string)} → </> : ""}{formatShortDate(a.value as string)}</>
                    )}
                    {a.action_type === "change_duration" && (
                      <>Duration: {a.current_value ? <>{a.current_value}d → </> : ""}{a.value}d</>
                    )}
                    {a.action_type === "set_status" && (
                      <>Status: {a.current_value ? <>{a.current_value} → </> : ""}{a.value as string}</>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {!msg.content.endsWith("✅") && (() => {
              const hasMoves = r.actions!.some((a) => a.action_type !== "set_status");
              const hasStatus = r.actions!.some((a) => a.action_type === "set_status");
              const label = hasMoves && hasStatus ? "Apply All" : hasMoves ? "Stage Changes" : "Apply";
              return (
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => onStage(msg.id, r.actions!)}
                    disabled={!!stagingAction}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {stagingAction?.msgId === msg.id ? `Applying ${stagingAction.actionIdx + 1}/${r.actions!.length}…` : label}
                  </button>
                </div>
              );
            })()}
            {msg.content.endsWith("✅") && (() => {
              const hasMoves = r.actions!.some((a) => a.action_type !== "set_status");
              const hasStatus = r.actions!.some((a) => a.action_type === "set_status");
              if (hasMoves && hasStatus) return <p className="text-xs font-medium text-green-600 dark:text-green-400">✅ Status updated, schedule changes staged</p>;
              if (hasStatus) return <p className="text-xs font-medium text-green-600 dark:text-green-400">✅ Status updated</p>;
              return <p className="text-xs font-medium text-green-600 dark:text-green-400">✅ Changes staged — review in the staging toolbar</p>;
            })()}
          </>
        )}

        {/* Answer response */}
        {r.type === "answer" && (
          <p className="text-gray-700 dark:text-gray-300">{r.answer}</p>
        )}

        {/* Clarification response */}
        {r.type === "clarification" && (
          <>
            <p className="text-gray-700 dark:text-gray-300">{r.message}</p>
            {r.options && r.options.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {r.options.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => onOptionClick(opt)}
                    className="rounded-full border border-gray-300 px-2.5 py-1 text-xs text-gray-600 hover:border-blue-300 hover:bg-blue-50 dark:border-gray-700 dark:text-gray-400 dark:hover:border-blue-800 dark:hover:bg-blue-950"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* Error response */}
        {r.type === "error" && (
          <p className="text-red-600 dark:text-red-400">{r.message}</p>
        )}

        {/* Meta info */}
        {r._meta && (
          <p className="text-[10px] text-gray-400 dark:text-gray-600">
            {r._meta.model} · {(r._meta.duration_ms / 1000).toFixed(1)}s
            {r._meta.tokens && <> · {r._meta.tokens.input + r._meta.tokens.output} tokens</>}
          </p>
        )}
      </div>
    </div>
  );
}

function ChatInput({
  input, setInput, onKeyDown, onSend, sending, inputRef, wrapRef, selectedActivityName,
}: {
  input: string;
  setInput: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onSend: () => void;
  sending: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  wrapRef?: React.RefObject<HTMLDivElement | null>;
  selectedActivityName?: string | null;
}) {
  function handleFocus() {
    setTimeout(() => {
      wrapRef?.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      inputRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 300);
  }

  return (
    <div ref={wrapRef} className="shrink-0 border-t border-gray-200 dark:border-gray-800">
      {selectedActivityName && (
        <div className="flex items-center gap-1.5 px-3 pt-2 text-[11px] text-gray-500 dark:text-gray-400">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
          Focused: <span className="font-medium text-gray-700 dark:text-gray-300">{selectedActivityName}</span>
        </div>
      )}
      <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 mx-3 my-2 mb-[max(0.5rem,env(safe-area-inset-bottom))] px-3 py-2 dark:border-gray-800 dark:bg-gray-900">
        <input
          ref={inputRef}
          type="text"
          inputMode="text"
          enterKeyHint="send"
          autoComplete="off"
          autoCorrect="on"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={handleFocus}
          placeholder="Describe a change or ask a question…"
          disabled={sending}
          className="flex-1 bg-transparent text-base text-gray-800 placeholder-gray-400 outline-none dark:text-gray-200 dark:placeholder-gray-500"
        />
        <button
          onClick={onSend}
          disabled={sending || !input.trim()}
          className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-30"
        >
          →
        </button>
      </div>
    </div>
  );
}
