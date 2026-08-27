'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Send,
  Loader2,
  Trash2,
  Bot,
  User,
  Sparkles,
  ChevronDown,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { KNOWN_SYMBOLS } from '@/lib/stock-utils';
import { SectionHeader } from '@/components/shared/animated-counter';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

// ─── Animation variants ───────────────────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' as const } },
};

// ─── Suggested Questions ─────────────────────────────────────────────────────
function getSuggestions(symbol: string): string[] {
  return [
    `What is the current trend for ${symbol}?`,
    `Should I buy ${symbol} right now?`,
    `What are the key support and resistance levels?`,
    `How is the news sentiment for ${symbol}?`,
    `What does the RSI indicate for ${symbol}?`,
  ];
}

// ─── Component ────────────────────────────────────────────────────────────────
export function AIAssistantPage() {
  const { chatMessages, addChatMessage, clearChatMessages } = useAppStore();
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState('AAPL');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Send message
  const handleSend = useCallback(async (messageText?: string) => {
    const text = (messageText || input).trim();
    if (!text || isLoading) return;

    addChatMessage({ role: 'user', content: text });
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: selectedSymbol, question: text }),
      });
      const data = await res.json();

      if (data.error) {
        addChatMessage({ role: 'assistant', content: `Error: ${data.error}` });
        toast.error(data.error);
      } else if (data.answer) {
        addChatMessage({ role: 'assistant', content: data.answer });
      } else {
        addChatMessage({ role: 'assistant', content: 'Unable to get a response. The AI service may be temporarily unavailable.' });
      }
    } catch {
      addChatMessage({ role: 'assistant', content: 'Failed to reach the AI service. Please check your connection and try again.' });
      toast.error('AI service unavailable');
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [input, isLoading, selectedSymbol, addChatMessage]);

  // Handle key press
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // Clear chat
  const handleClear = useCallback(() => {
    clearChatMessages();
    toast.success('Chat cleared');
  }, [clearChatMessages]);

  const suggestions = getSuggestions(selectedSymbol);

  return (
    <motion.div
      className="space-y-6 max-w-4xl mx-auto"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <SectionHeader
        title="AI Assistant"
        subtitle="Ask questions about any stock — powered by real-time data and LLM analysis"
        action={
          <div className="flex items-center gap-2">
            <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
              <SelectTrigger className="w-[140px] bg-white/5 border-white/10 text-white h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KNOWN_SYMBOLS.map((s) => (
                  <SelectItem key={s.symbol} value={s.symbol}>
                    {s.symbol}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {chatMessages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-400 hover:text-red-400 hover:bg-red-500/10 h-9 px-2"
                onClick={handleClear}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        }
      />

      {/* ── Chat Area ──────────────────────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="glass-card flex flex-col" style={{ height: 'calc(100vh - 280px)', minHeight: '400px' }}>
          <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
            {/* Messages */}
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
              <div className="space-y-4">
                {chatMessages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full py-16 gap-4">
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 border border-indigo-500/20"
                    >
                      <Bot className="w-10 h-10 text-indigo-400" />
                    </motion.div>
                    <div className="text-center">
                      <p className="text-slate-300 font-medium mb-1">AI Market Assistant</p>
                      <p className="text-slate-500 text-sm mb-4">Ask anything about {selectedSymbol} or any stock</p>
                      <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                        {suggestions.map((s, i) => (
                          <motion.button
                            key={i}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 + i * 0.08 }}
                            onClick={() => handleSend(s)}
                            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
                          >
                            {s}
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <AnimatePresence>
                  {chatMessages.map((msg, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {msg.role === 'assistant' && (
                        <div className="shrink-0 mt-1">
                          <div className="w-7 h-7 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                            <Bot className="w-4 h-4 text-indigo-400" />
                          </div>
                        </div>
                      )}
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                          msg.role === 'user'
                            ? 'bg-indigo-500/15 border border-indigo-500/20'
                            : 'bg-white/[0.04] border border-white/[0.06]'
                        }`}
                      >
                        {msg.role === 'assistant' && (
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <Sparkles className="w-3 h-3 text-indigo-400" />
                            <span className="text-[10px] text-indigo-400 font-medium uppercase tracking-wider">AI Analysis</span>
                          </div>
                        )}
                        <p className={`text-sm leading-relaxed whitespace-pre-line ${msg.role === 'user' ? 'text-white' : 'text-slate-300'}`}>
                          {msg.content}
                        </p>
                      </div>
                      {msg.role === 'user' && (
                        <div className="shrink-0 mt-1">
                          <div className="w-7 h-7 rounded-lg bg-slate-700/50 flex items-center justify-center">
                            <User className="w-4 h-4 text-slate-300" />
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>

                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex gap-3"
                  >
                    <div className="shrink-0 mt-1">
                      <div className="w-7 h-7 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                        <Bot className="w-4 h-4 text-indigo-400" />
                      </div>
                    </div>
                    <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl px-4 py-3">
                      <div className="flex items-center gap-2 text-slate-400">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Analyzing {selectedSymbol}...</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="border-t border-white/5 p-4">
              <div className="flex gap-3">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Ask about ${selectedSymbol}...`}
                  disabled={isLoading}
                  className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 h-10"
                />
                <Button
                  onClick={() => handleSend()}
                  disabled={isLoading || !input.trim()}
                  className="gradient-button h-10 px-4 shrink-0"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <p className="text-[10px] text-slate-600 mt-2">
                AI responses are for informational purposes only and should not be considered financial advice.
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}