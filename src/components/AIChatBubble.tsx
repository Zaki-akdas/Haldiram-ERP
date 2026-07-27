'use client';

import { useState, useRef, useEffect } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const knowledgeBase: Record<string, string> = {
  'hello|hi|hey': 'Hello! 👋 I\'m your SalesSettle AI assistant. How can I help you today?\n\n**Quick topics:**\n- GSTIN validation\n- PDF extraction\n- Settlement process\n- Report generation',
  
  'gstin|gst number|gst validation': '**GSTIN Validation**\n\nA valid GSTIN has 15 characters:\n- 2 digits: State code (01-37)\n- 5 letters: PAN first 5 chars\n- 4 digits: PAN entity number\n- 1 letter: Entity type\n- 1 char: Z (default)\n- 1 char: Checksum\n\n*Example:* 23AMFPV5397L1ZB\n\nI automatically validate GSTIN checksum during PDF extraction!',
  
  'pdf|invoice|extract': '**PDF Invoice Extraction**\n\nI can extract:\n- Seller & buyer details\n- GSTIN, PAN, phone numbers\n- Invoice number & date\n- Line items with ERP IDs\n- GST calculations\n- Totals & amount in words\n\n**Tips:**\n1. Text-based PDFs work best (~85% accuracy)\n2. Excel files are most accurate (~99%)\n3. Image-based PDFs need OCR (~60% accuracy)',
  
  'settlement|payment|collect': '**Settlement Process**\n\n1. Go to **Orders** or **Settlements**\n2. Click on an order with pending balance\n3. Enter payment amount\n4. Select payment mode (Cash/UPI/Bank)\n5. Add reference number if applicable\n6. Submit to record settlement\n\n*Note:* Partial settlements are supported!',
  
  'report|analytics|data': '**Reports Available**\n\n📊 **Sales Report** - Daily/weekly/monthly sales\n💰 **Collections** - Payment breakdown by mode\n👥 **Customer Report** - Revenue per customer\n👔 **Salesperson Report** - Performance metrics\n\nAccess via **Reports** in sidebar (Admin/Manager only)',
  
  'order|create order|new order': '**Creating Orders**\n\n1. Go to **Orders** > **New Order**\n2. Select customer\n3. Add products with quantities\n4. Review GST calculations\n5. Submit order\n\n*Or* import from PDF/Excel via **PDF Invoices**!',
  
  'customer|add customer': '**Customer Management**\n\nAdd new customers with:\n- Name & contact details\n- GSTIN (auto-validated)\n- Address & beat assignment\n- Credit limit\n\nSalespersons see only their assigned customers.',
  
  'product|inventory': '**Product Management**\n\nManage products with:\n- ERP ID for tracking\n- MRP & base price\n- GST rate & HSN code\n- Stock quantity\n- Category grouping',
  
  'role|permission|access': '**User Roles**\n\n👤 **Admin** - Full access to all features\n👔 **Manager** - View all data, manage team\n🧑‍💼 **Salesperson** - Own customers & orders only\n\nSalespersons use **Customer Bills** instead of **PDF Invoices**.',
  
  'help|support|guide': '**Need Help?**\n\nI can assist with:\n- 📄 PDF extraction tips\n- ✅ GSTIN/PAN validation\n- 💰 Settlement recording\n- 📊 Understanding reports\n- 🔐 Role permissions\n\nJust ask your question!',
};

function getAIResponse(message: string): string {
  const lowerMsg = message.toLowerCase();
  
  for (const [pattern, response] of Object.entries(knowledgeBase)) {
    const keywords = pattern.split('|');
    if (keywords.some(kw => lowerMsg.includes(kw))) {
      return response;
    }
  }
  
  return "I'm not sure about that specific topic. Here's what I can help with:\n\n- **GSTIN validation** - Ask about GST numbers\n- **PDF extraction** - Invoice parsing tips\n- **Settlements** - Payment recording\n- **Reports** - Analytics & data\n- **Roles** - User permissions\n\nTry asking about any of these topics!";
}

export default function AIChatBubble() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hi! 👋 I\'m your SalesSettle AI assistant. Ask me about GSTIN validation, PDF extraction, settlements, or reports!',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    // Simulate AI thinking
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));

    const aiResponse: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: getAIResponse(input),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, aiResponse]);
    setIsTyping(false);
  };

  // Format message content with basic markdown
  const formatContent = (content: string) => {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br/>');
  };

  return (
    <>
      {/* Chat bubble button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`
          fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full
          bg-gradient-to-r from-emerald-500 to-teal-500
          text-white text-2xl shadow-lg
          hover:scale-110 transition-transform
          ${isOpen ? 'hidden' : 'flex'}
          items-center justify-center
        `}
        title="AI Assistant"
      >
        🤖
      </button>

      {/* Chat window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col" style={{ height: '500px', maxHeight: 'calc(100vh - 6rem)' }}>
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🤖</span>
              <div>
                <h3 className="font-semibold">AI Assistant</h3>
                <p className="text-xs text-emerald-100">Always here to help</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-white/20 rounded-lg transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`
                    max-w-[80%] rounded-2xl px-4 py-2 text-sm
                    ${msg.role === 'user'
                      ? 'bg-emerald-500 text-white rounded-br-sm'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-sm'
                    }
                  `}
                  dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }}
                />
              </div>
            ))}
            
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-slate-100 dark:bg-slate-700 rounded-2xl px-4 py-2 rounded-bl-sm">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="p-4 border-t border-slate-200 dark:border-slate-700">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me anything..."
                className="flex-1 px-4 py-2 rounded-full border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                disabled={isTyping}
              />
              <button
                type="submit"
                disabled={!input.trim() || isTyping}
                className="px-4 py-2 bg-emerald-500 text-white rounded-full text-sm font-medium hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Send
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
