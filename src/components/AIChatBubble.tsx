'use client';

import { useState, useRef, useEffect } from 'react';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

export default function AIChatBubble() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hi! I am your AI assistant. How can I help you with the ERP today?' }
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim()) return;

    const userMsg = inputValue.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInputValue('');

    // Simulate AI response delay
    setTimeout(() => {
      const lowerInput = userMsg.toLowerCase();
      let reply = 'I can help with: GST/GSTIN validation, PDF extraction, settlements, reports, orders, customers, products, and role permissions. What would you like to know?';

      if (lowerInput.includes('gstin') || lowerInput.includes('gst')) {
        reply = 'GSTIN is a 15-character alphanumeric ID. Format: 2-digit state code + 10-digit PAN + entity code + Z + check digit. You can validate GSTINs in the customer form.';
      } else if (lowerInput.includes('pdf') || lowerInput.includes('extract')) {
        reply = 'Upload PDF, Excel, or CSV invoices in the Invoices section. Choose Fast mode for regex extraction or AI mode for intelligent parsing. Supported AI providers include Gemini, Azure OpenAI, and Ollama.';
      } else if (lowerInput.includes('settlement') || lowerInput.includes('collection')) {
        reply = 'Record payments in the order detail page or Collections section. Supported modes: Cash (with denomination calculator), Online, Cheque, and Split payments.';
      } else if (lowerInput.includes('report')) {
        reply = 'Reports are available under the Reports section: Sales analytics, Collections summary, Customer insights, and Salesperson performance. Use date range filters for specific periods.';
      } else if (lowerInput.includes('order')) {
        reply = 'Create orders from Orders → New Order. Select a customer, add products with quantities, and the system auto-calculates GST and totals. Track status: Pending → Confirmed → Delivered.';
      } else if (lowerInput.includes('customer')) {
        reply = 'Manage customers in the Customers section. Each customer can have GSTIN, PAN, credit limit, and assigned salesperson. Salespersons only see their assigned customers.';
      } else if (lowerInput.includes('product')) {
        reply = 'Products are managed by admins and managers. Each product has ERP ID, pricing (MRP + base price), GST rate, HSN code, and stock quantity.';
      } else if (lowerInput.includes('role') || lowerInput.includes('permission')) {
        reply = 'Three roles: Admin (full access), Manager (most features, no user creation), Salesperson (own orders/customers only). Role determines sidebar items and data visibility.';
      }

      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    }, 600);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {isOpen && (
        <div className="glass-card mb-4 flex h-[28rem] w-80 sm:w-96 flex-col overflow-hidden rounded-2xl shadow-xl animate-fade-in border border-border">
          {/* Header */}
          <div className="flex items-center justify-between bg-primary/5 dark:bg-primary/10 border-b border-border p-4">
            <div className="flex items-center">
              <div className="mr-2 rounded-full bg-primary/20 p-1.5 text-primary">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="font-semibold text-text-primary">AI Assistant</h3>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="rounded-full p-1 text-text-secondary hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div 
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-gradient-to-r from-primary to-primary-light text-white rounded-br-none' 
                      : 'bg-gray-100 dark:bg-gray-800 text-text-primary rounded-bl-none border border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-border p-3 bg-white/50 dark:bg-surface-dark/50">
            <form onSubmit={handleSend} className="flex items-center gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask about the ERP..."
                className="input-field rounded-full py-2 px-4 text-sm bg-gray-50 dark:bg-gray-900 border-none shadow-inner"
              />
              <button 
                type="submit"
                disabled={!inputValue.trim()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-dark transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-primary to-accent shadow-lg text-white hover:shadow-xl hover:scale-105 transition-all duration-300 ${!isOpen ? 'animate-pulse' : ''}`}
      >
        {isOpen ? (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
        )}
      </button>
    </div>
  );
}
