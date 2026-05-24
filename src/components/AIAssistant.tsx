import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, Sparkles, MessageSquare, X } from 'lucide-react';

interface Message {
  role: 'user' | 'model';
  text: string;
}

export default function AIAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: 'Welcome to the Chercher Secondary School Enrollment Support. I am your AI assistant. How can I help you with your registration, payment, or class assignment today?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const faqTriggers = [
    { label: "How are classes assigned?", question: "How does the school assign classes to approved students?" },
    { label: "Payment CBE account", question: "What is the bank account number for CBE payments?" },
    { label: "What uploads are needed?", question: "Which documents are required for uploading during registration?" },
    { label: "Tell me about the school", question: "Can you provide general information about Chercher Secondary School?" }
  ];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    const userMsg: Message = { role: 'user', text: textToSend };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/ai/registration-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          history: messages.slice(1) // skip the intro message for neat context flow
        })
      });
      const data = await response.json();
      if (data.success) {
        setMessages(prev => [...prev, { role: 'model', text: data.text }]);
      } else {
        setMessages(prev => [...prev, { role: 'model', text: `Sorry, I met an error processing that: ${data.message}` }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'model', text: 'Sorry, I am having trouble reaching the school server right now. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Chat Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 bg-amber-600 hover:bg-amber-700 text-white p-4 rounded-full shadow-2xl flex items-center gap-2 hover:scale-105 transition-all text-sm font-semibold border border-amber-500/20"
        id="btn-ai-chat-trigger"
      >
        <Bot className="w-5 h-5 animate-pulse" />
        <span>AI Support</span>
      </button>

      {/* Floating Chat Modal */}
      {isOpen && (
        <div className="fixed inset-y-0 right-0 md:right-6 md:bottom-24 md:top-auto md:w-96 md:h-[550px] bg-slate-900 border border-slate-800 rounded-none md:rounded-2xl shadow-3xl flex flex-col z-50 overflow-hidden match-modal-view animate-in fade-in slide-in-from-bottom-5 duration-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-amber-700 to-amber-900 p-4 border-b border-white/10 flex items-center justify-between text-white">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-amber-300" />
              <div>
                <h3 className="font-semibold text-sm">Chercher School AI Copilot</h3>
                <p className="text-[10px] text-amber-200">Enrolling & Placement Support</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white hover:text-amber-200 p-1 hover:bg-white/10 rounded-full transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages Body */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-950/70">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex gap-2 max-w-[85%] ${m.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
              >
                <div className={`p-1.5 rounded-full flex items-center justify-center ${m.role === 'user' ? 'bg-amber-600/20 text-amber-300' : 'bg-slate-800 text-slate-300'}`}>
                  {m.role === 'user' ? <MessageSquare className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                </div>
                <div className={`p-3 rounded-2xl text-xs leading-relaxed ${m.role === 'user' ? 'bg-amber-700 text-white rounded-tr-none' : 'bg-slate-800/80 text-slate-200 border border-slate-700/30 rounded-tl-none'}`}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-2 max-w-[85%] mr-auto">
                <div className="p-1.5 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center">
                  <Bot className="w-3.5 h-3.5" />
                </div>
                <div className="p-3 bg-slate-850 rounded-2xl text-xs text-slate-400 flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* FAQ Fast Buttons */}
          <div className="p-2 border-t border-slate-800 bg-slate-900/90 whitespace-nowrap overflow-x-auto scrollbar-none flex gap-1.5">
            {faqTriggers.map((faq, index) => (
              <button
                key={index}
                onClick={() => handleSend(faq.question)}
                className="inline-flex items-center gap-1 bg-slate-800/95 hover:bg-slate-755 text-slate-300 border border-slate-700/50 rounded-full px-3 py-1.5 text-[10px] hover:text-white transition-all cursor-pointer"
              >
                <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                {faq.label}
              </button>
            ))}
          </div>

          {/* Input Footer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(input);
            }}
            className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me a question..."
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-600 transition-all placeholder:text-slate-600"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white p-2 rounded-lg transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
