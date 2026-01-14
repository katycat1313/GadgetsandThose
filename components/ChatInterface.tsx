
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration, Chat } from '@google/genai';
import { Message, ChatMode, Product } from '../types';
import { getSystemInstruction } from '../constants';
import { decode, decodeAudioData, createPcmBlob } from '../utils/audio';

interface ChatInterfaceProps {
  products: Product[];
  onClose: () => void;
}

const recommendProductTool: FunctionDeclaration = {
  name: 'recommend_product',
  parameters: {
    type: Type.OBJECT,
    description: 'Call this function to visually recommend a specific gadget to the user with a specific reason.',
    properties: {
      productId: {
        type: Type.STRING,
        description: 'The unique ID of the product from the catalog.',
      },
      reasoning: {
        type: Type.STRING,
        description: 'Contextual reasoning for why this gadget fits the user\'s specific situation.',
      }
    },
    required: ['productId', 'reasoning'],
  },
};

/**
 * A simple, "human-like" search function to find relevant products.
 * Instead of complex embeddings, this uses a weighted keyword search, which is fast,
 * easy to understand, and feels more like how a person might quickly scan a catalog.
 */
const findRelevantProducts = (query: string, allProducts: Product[]): Product[] => {
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  if (queryWords.length === 0) return [];

  const scores: { [id: string]: number } = {};

  allProducts.forEach(product => {
    let score = 0;
    
    // Check for matches in different fields and apply a "human" weight.
    // A match in the name is a strong signal, whereas a match in the description is less so.
    queryWords.forEach(word => {
      if (product.name.toLowerCase().includes(word)) score += 5; // Strong match
      if (product.category.toLowerCase().includes(word)) score += 3; // Good match
      if (product.features.join(' ').toLowerCase().includes(word)) score += 2; // Okay match
      if (product.description.toLowerCase().includes(word)) score += 1; // Weak match
    });

    if (score > 0) {
      scores[product.id] = score;
    }
  });

  // Sort by the highest score and return the top 3.
  const sortedProductIds = Object.keys(scores).sort((a, b) => scores[b] - scores[a]);
  
  return sortedProductIds
    .slice(0, 3)
    .map(id => allProducts.find(p => p.id === id))
    .filter((p): p is Product => !!p);
};

const ChatInterface: React.FC<ChatInterfaceProps> = ({ products, onClose }) => {
  const [mode, setMode] = useState<ChatMode>('text');
  const [messages, setMessages] = useState<(Message & { recommendation?: Product; reason?: string })[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const chatSessionRef = useRef<Chat | null>(null);
  const audioContextRef = useRef<{ input: AudioContext; output: AudioContext } | null>(null);
  const voiceSessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  useEffect(() => {
    const initChat = async () => {
      const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
      const chat = ai.chats.create({
        model: 'gemini-2.0-flash-latest',
        config: {
          systemInstruction: getSystemInstruction(products),
          tools: [{ functionDeclarations: [recommendProductTool] }],
        },
      });
      chatSessionRef.current = chat;

      setIsTyping(true);
      try {
        const response = await chat.sendMessage({ 
          message: "Initiate discovery mode. Greet the user with the Deal of the Day and a scout-like welcome. Mention that you have " + products.length + " gadgets ready to discover." 
        });
        processAiResponse(response);
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

  const processAiResponse = (response: any) => {
    let recommendation: Product | undefined;
    let reason: string | undefined;
    
    const calls = response.functionCalls;
    if (calls && calls.length > 0) {
      const call = calls[0];
      if (call.name === 'recommend_product') {
        const args = call.args as any;
        recommendation = products.find(p => p.id === args.productId);
        reason = args.reasoning;
      }
    }

    const text = response.text || (recommendation ? "" : "");
    if (text || recommendation) {
      addMessage('assistant', text, recommendation, reason);
    }
  };

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isTyping) return;

    const userMsg = inputText.trim();
    setInputText('');
    addMessage('user', userMsg);
    setIsTyping(true);

    try {
      // Lazy-initialize the chat session on the first message.
      if (!chatSessionRef.current) {
        const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
        chatSessionRef.current = ai.chats.create({
          model: 'gemini-2.0-flash-latest',
          config: {
            systemInstruction: getSystemInstruction(products),
            tools: [{ functionDeclarations: [recommendProductTool] }],
          }
        });
      }

      // Find relevant products to give the AI more context.
      const relevantProducts = findRelevantProducts(userMsg, products);
      let augmentedUserMessage = userMsg;

      // If we found any relevant products, we'll augment the user's prompt
      // with this context. This helps the AI make smarter recommendations
      // without having to re-initialize the whole chat with a new system prompt.
      if (relevantProducts.length > 0) {
        const productContext = relevantProducts
          .map(p => `- ID: ${p.id}, Name: ${p.name}, Desc: ${p.description}`)
          .join('\n');
        
        augmentedUserMessage = `Based on my query, I found these potentially relevant products in your catalog:\n${productContext}\n\nPlease consider this context when answering my query: "${userMsg}"`;
      }

      const response = await chatSessionRef.current.sendMessage({ message: augmentedUserMessage });
      processAiResponse(response);
    } catch (error) {
      console.error(error);
      addMessage('assistant', "I hit a snag in the comms. What was that again?");
    } finally {
      setIsTyping(false);
    }
  };

  const startVoiceSession = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
      
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = { input: inputCtx, output: outputCtx };

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createPcmBlob(inputData);
              sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.toolCall) {
              for (const fc of message.toolCall.functionCalls) {
                if (fc.name === 'recommend_product') {
                  const args = fc.args as any;
                  const prod = products.find(p => p.id === args.productId);
                  if (prod) {
                    addMessage('assistant', args.reasoning, prod, args.reasoning);
                  }
                  sessionPromise.then(s => s.sendToolResponse({
                    functionResponses: { id: fc.id, name: fc.name, response: { result: "displayed" } }
                  }));
                }
              }
            }

            const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData) {
              const { output } = audioContextRef.current!;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, output.currentTime);
              const buffer = await decodeAudioData(decode(audioData), output, 24000, 1);
              const source = output.createBufferSource();
              source.buffer = buffer;
              source.connect(output.destination);
              source.onended = () => audioSourcesRef.current.delete(source);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              audioSourcesRef.current.add(source);
            }

            if (message.serverContent?.interrupted) {
              audioSourcesRef.current.forEach(s => s.stop());
              audioSourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onerror: (e) => console.error('Voice Error:', e),
          onclose: () => setIsVoiceActive(false)
        },
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: getSystemInstruction(products),
          tools: [{ functionDeclarations: [recommendProductTool] }],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }
          }
        }
      });

      voiceSessionRef.current = await sessionPromise;
      setIsVoiceActive(true);
    } catch (err) {
      console.error('Failed to start voice:', err);
      setMode('text');
    }
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
      setMode('voice');
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
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm leading-relaxed ${
                msg.role === 'user' 
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
                    {[1,2,3].map(i => <div key={i} className="w-1 h-1 bg-cyan-400 rounded-full" />)}
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
                {[1,2,3,4,5,6,7,8].map(i => (
                   <div key={i} className="w-1 bg-cyan-400 rounded-full animate-grow" style={{ animationDelay: `${i * 100}ms` }} />
                ))}
              </div>
              <p className="text-[9px] text-cyan-400 mt-2 font-bold tracking-[0.3em] uppercase opacity-80">Listening to your setup goals...</p>
            </div>
          )}

          <button 
            onClick={toggleMode}
            className={`p-4 rounded-xl transition-all border shadow-sm ${
              mode === 'voice' 
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
