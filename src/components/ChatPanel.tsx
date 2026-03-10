"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatDate } from "@/lib/utils";

interface Action {
  jsa_rid: number;
  activity_description: string;
  action_type: "move_start" | "change_duration" | "set_status";
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
  selectedJsaRid: number | null;
  onStageEdit: (jsaRid: number, moveType: "move_start" | "change_duration", value: string | number) => Promise<void>;
  onStatusUpdate: (jsaRid: number, status: string, note: string) => Promise<void>;
}

const EXAMPLES = [
  "Push drywall back 3 days",
  "Extend framing by a week",
  "When does settlement happen?",
  "Mark install windows as complete",
  "What activities are late?",
];

export function ChatPanel({ open, onClose, scheduleRid, selectedJsaRid, onStageEdit, onStatusUpdate }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [stagingAction, setStagingAction] = useState<{ msgId: number; actionIdx: number } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(1);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  // Build conversation history for context
  const getHistory = useCallback(() => {
    return messages
      .filter((m) => !m.loading)
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.role === "user" ? m.content : (m.response ? JSON.stringify(m.response) : m.content),
      }));
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
    setStagingAction({ msgId, actionIdx: 0 });
    try {
      for (let i = 0; i < actions.length; i++) {
        setStagingAction({ msgId, actionIdx: i });
        const action = actions[i];
        if (action.action_type === "set_status") {
          await onStatusUpdate(action.jsa_rid, action.value as string, `AI chat: ${action.explanation}`);
        } else {
          await onStageEdit(action.jsa_rid, action.action_type, action.value);
        }
      }
      // Mark message as staged
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, content: m.content + " ✅" } : m)),
      );
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Failed to stage";
      setMessages((prev) => [...prev, { id: nextId.current++, role: "assistant", content: `Error staging: ${errMsg}`, response: { type: "error", message: errMsg } }]);
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
      {/* Mobile: full-screen overlay */}
      <div className="fixed inset-0 z-40 flex flex-col bg-white dark:bg-gray-950 sm:hidden">
        <MobileHeader onClose={onClose} onClear={clearChat} messageCount={messages.length} />
        <ChatBody
          messages={messages}
          sending={sending}
          stagingAction={stagingAction}
          messagesEndRef={messagesEndRef}
          onStage={handleStage}
          onExample={send}
          onOptionClick={send}
        />
        <ChatInput input={input} setInput={setInput} onKeyDown={handleKeyDown} onSend={() => send()} sending={sending} inputRef={inputRef} />
      </div>

      {/* Desktop: slide-out panel */}
      <div className="fixed inset-y-0 right-0 z-40 hidden w-96 flex-col border-l border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-950 sm:flex">
        <DesktopHeader onClose={onClose} onClear={clearChat} messageCount={messages.length} />
        <ChatBody
          messages={messages}
          sending={sending}
          stagingAction={stagingAction}
          messagesEndRef={messagesEndRef}
          onStage={handleStage}
          onExample={send}
          onOptionClick={send}
        />
        <ChatInput input={input} setInput={setInput} onKeyDown={handleKeyDown} onSend={() => send()} sending={sending} inputRef={inputRef} />
      </div>
    </>
  );
}

/* ── Sub-components ── */

function MobileHeader({ onClose, onClear, messageCount }: { onClose: () => void; onClear: () => void; messageCount: number }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
      <div className="flex items-center gap-2">
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          ← Back
        </button>
        <h2 className="text-sm font-semibold">Schedule Assistant</h2>
      </div>
      {messageCount > 0 && (
        <button onClick={onClear} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">Clear</button>
      )}
    </div>
  );
}

function DesktopHeader({ onClose, onClear, messageCount }: { onClose: () => void; onClear: () => void; messageCount: number }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
      <h2 className="text-sm font-semibold">💬 Schedule Assistant</h2>
      <div className="flex items-center gap-2">
        {messageCount > 0 && (
          <button onClick={onClear} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">Clear</button>
        )}
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">✕</button>
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
                    {a.action_type === "move_start" && <>Move start → {formatDate(a.value as string)}</>}
                    {a.action_type === "change_duration" && <>Duration → {a.value} days</>}
                    {a.action_type === "set_status" && <>Status → {a.value as string}</>}
                  </div>
                  <div className="mt-0.5 text-gray-400 dark:text-gray-500">{a.explanation}</div>
                </div>
              ))}
            </div>
            {!msg.content.endsWith("✅") && (
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => onStage(msg.id, r.actions!)}
                  disabled={!!stagingAction}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {stagingAction?.msgId === msg.id ? `Staging ${stagingAction.actionIdx + 1}/${r.actions!.length}…` : "Stage Changes"}
                </button>
              </div>
            )}
            {msg.content.endsWith("✅") && (
              <p className="text-xs font-medium text-green-600 dark:text-green-400">✅ Changes staged — review in the staging toolbar</p>
            )}
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
  input, setInput, onKeyDown, onSend, sending, inputRef,
}: {
  input: string;
  setInput: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onSend: () => void;
  sending: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="border-t border-gray-200 p-3 dark:border-gray-800">
      <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-900">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Describe a change or ask a question…"
          disabled={sending}
          className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none dark:text-gray-200 dark:placeholder-gray-500"
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
