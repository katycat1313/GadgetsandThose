
import React, { useState, useEffect, useRef } from 'react';
import { Message, ChatMode, Product } from '../types';
import { getSystemInstruction } from '../constants';

interface ChatInterfaceProps {
  products: Product[];
  onClose: () => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ products, onClose }) => {
  const [mode, setMode] = useState<ChatMode>('text');
  const [messages, setMessages] = useState<(Message & { recommendation?: Product; reason?: string })[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const voiceSessionRef = useRef<any>(null);
  const audioContextRef = useRef<{ input: AudioContext; output: AudioContext } | null>(null);


  useEffect(() => {
    const initChat = async () => {
      setIsTyping(true);
      try {
        const response = await fetch('/.netlify/functions/gemini', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: "Initiate discovery mode. Greet the user with the Deal of the Day and a scout-like welcome. Mention that you have " + products.length + " gadgets ready to discover."
          }),
        });

        if (!response.ok) throw new Error('API Error');
        const data = await response.json();

        // Extract content from Gemini response format
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        addMessage('assistant', text);
      } catch (e) {
        addMessage('assistant', "Hey! Gadget Scout here. What are we optimizing today?");
      } finally {
        setIsTyping(false);
      }
    };

    if (messages.length === 0 && products.length > 0) {
      initChat();
    }
  }, [products]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const addMessage = (role: 'user' | 'assistant', content: string, recommendation?: Product, reason?: string) => {
    setMessages(prev => [
      ...prev,
      { id: Date.now().toString(), role, content, timestamp: Date.now(), recommendation, reason }
    ]);
  };

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isTyping) return;

    const userMsg = inputText.trim();
    setInputText('');
    addMessage('user', userMsg);
    setIsTyping(true);

    try {
      const response = await fetch('/.netlify/functions/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userMsg }),
      });

      if (!response.ok) throw new Error('API Error');
      const data = await response.json();

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

      // Basic recommendation detection if the LLM includes an ID in the text
      // Note: The function logic handles RAG, so results are context-aware.
      addMessage('assistant', text);
    } catch (error) {
      console.error(error);
      addMessage('assistant', "I hit a snag in the comms. What was that again?");
    } finally {
      setIsTyping(false);
    }
  };

  const startVoiceSession = async () => {
    // Voice session requires a direct client-side API key which is currently causing security blocks.
    // Calling server-side functions for real-time audio is significantly more complex.
    // For now, we revert to text mode to ensure the site can build and deploy safely.
    alert("Voice Discovery is currently undergoing a security update. Please use Text Discovery for now!");
    setMode('text');
  };

  const stopVoiceSession = () => {
    if (voiceSessionRef.current) voiceSessionRef.current.close();
    if (audioContextRef.current) {
      audioContextRef.current.input.close();
      audioContextRef.current.output.close();
    }
    setIsVoiceActive(false);
  };

  const toggleMode = () => {
    if (mode === 'text') {
      startVoiceSession();
    } else {
      stopVoiceSession();
      setMode('text');
    }
  };

  useEffect(() => {
    return () => stopVoiceSession();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col md:right-8 md:bottom-8 md:inset-auto md:w-[480px] md:h-[650px] glass rounded-2xl shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="p-4 border-b border-white/10 flex justify-between items-center bg-gray-950/50 rounded-t-2xl">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${isVoiceActive ? 'bg-cyan-400 animate-pulse' : 'bg-blue-500'}`} />
          <div className="flex flex-col">
            <span className="font-orbitron text-[10px] font-bold tracking-widest text-white uppercase leading-none">G&T Scout Hub</span>
            <span className="text-[9px] text-cyan-400 font-bold tracking-[0.2em] uppercase opacity-70 mt-1">{mode} LINKED</span>
          </div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide bg-gradient-to-b from-transparent to-cyan-900/5">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            {msg.content && (
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm leading-relaxed ${msg.role === 'user'
                ? 'bg-blue-600 text-white rounded-br-none'
                : 'glass text-gray-200 rounded-bl-none border-blue-500/10'
                }`}>
                {msg.content}
              </div>
            )}

            {msg.recommendation && (
              <div className="mt-3 w-full max-w-[95%] glass rounded-xl overflow-hidden border-cyan-500/30 animate-in zoom-in-95 duration-500 shadow-xl shadow-cyan-900/10">
                <div className="bg-cyan-500/10 px-3 py-1.5 border-b border-cyan-500/20 flex justify-between items-center">
                  <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-widest">Scout's Recommendation</span>
                  <div className="flex gap-0.5">
                    {[1, 2, 3].map(i => <div key={i} className="w-1 h-1 bg-cyan-400 rounded-full" />)}
                  </div>
                </div>
                <div className="flex gap-4 p-4">
                  <div className="w-24 h-24 bg-gray-900 rounded-lg overflow-hidden flex-shrink-0 border border-white/5">
                    <img src={msg.recommendation.imageUrl} className="w-full h-full object-cover" alt="" />
                  </div>
                  <div className="flex-1 flex flex-col justify-center min-w-0">
                    <h5 className="text-base font-bold text-white truncate mb-1">{msg.recommendation.name}</h5>
                    <p className="text-[10px] text-gray-400 line-clamp-2 mb-2 italic">"{msg.reason || msg.recommendation.description}"</p>
                    <div className="flex justify-between items-center mt-auto">
                      <span className="text-base font-bold text-cyan-300 font-orbitron">${msg.recommendation.price}</span>
                      <a
                        href={msg.recommendation.affiliateUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-bold bg-cyan-600 px-4 py-2 rounded-lg text-white hover:bg-cyan-500 transition-all shadow-lg shadow-cyan-900/40 uppercase tracking-wider"
                      >
                        Secure Deal
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="glass rounded-2xl rounded-bl-none px-4 py-3 flex gap-1.5 border-white/5">
              <div className="w-2 h-2 bg-cyan-400/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-cyan-400/50 rounded-full animate-bounce" style={{ animationDelay: '200ms' }} />
              <div className="w-2 h-2 bg-cyan-400/50 rounded-full animate-bounce" style={{ animationDelay: '400ms' }} />
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-gray-950/90 border-t border-white/5 backdrop-blur-md rounded-b-2xl">
        <div className="flex items-center gap-3">
          {mode === 'text' ? (
            <form onSubmit={handleTextSubmit} className="flex-1 flex gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Ask your scout..."
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-500/50 transition-all placeholder:text-gray-600 text-white"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || isTyping}
                className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-30 p-3 rounded-xl transition-all shadow-lg shadow-cyan-600/20"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              </button>
            </form>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center py-1">
              <div className="flex gap-1.5 h-8 items-center">
                {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                  <div key={i} className="w-1 bg-cyan-400 rounded-full animate-grow" style={{ animationDelay: `${i * 100}ms` }} />
                ))}
              </div>
              <p className="text-[9px] text-cyan-400 mt-2 font-bold tracking-[0.3em] uppercase opacity-80">Listening to your setup goals...</p>
            </div>
          )}

          <button
            onClick={toggleMode}
            className={`p-4 rounded-xl transition-all border shadow-sm ${mode === 'voice'
              ? 'bg-red-500/10 border-red-500/30 text-red-500 hover:bg-red-500/20 shadow-red-900/10'
              : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:border-white/20'
              }`}
          >
            {mode === 'voice' ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes grow {
          0%, 100% { height: 0.4rem; opacity: 0.2; }
          50% { height: 1.6rem; opacity: 1; }
        }
        .animate-grow {
          animation: grow 0.8s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default ChatInterface;
