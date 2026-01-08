
import React, { useState, useEffect } from 'react';
import ProductCard from './components/ProductCard';
import ChatInterface from './components/ChatInterface';
import { Product } from './types';

const App: React.FC = () => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('./products.json')
      .then(res => res.json())
      .then(data => {
        const productList = data.products || (Array.isArray(data) ? data : []);
        setProducts(productList);
        setIsLoading(false);
      })
      .catch(err => {
        console.error("Failed to load products:", err);
        setIsLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-[#030712] text-gray-100 flex flex-col">
      {/* Navbar */}
      <nav className="sticky top-0 z-40 glass border-b border-white/5 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-900/40">
            <span className="font-orbitron font-bold text-xl text-white">G&T</span>
          </div>
          <div className="flex flex-col">
            <span className="font-orbitron font-bold text-lg leading-none tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 uppercase">
              Gadgets and Those
            </span>
            <span className="text-[10px] text-cyan-400 font-bold tracking-widest uppercase opacity-70">Official Hub</span>
          </div>
        </div>
        <div className="hidden md:flex gap-8 text-sm font-semibold text-gray-400">
          <a href="#" className="hover:text-cyan-400 transition-colors uppercase tracking-widest">Gadgets</a>
          <a href="#" className="hover:text-cyan-400 transition-colors uppercase tracking-widest">Those Things</a>
          <a href="#" className="hover:text-cyan-400 transition-colors uppercase tracking-widest">Deals</a>
        </div>
        <button 
          onClick={() => setIsChatOpen(true)}
          className="bg-white/5 hover:bg-white/10 px-5 py-2 rounded-full text-[10px] font-bold border border-white/10 transition-all flex items-center gap-2 group tracking-widest uppercase"
        >
          <span className="w-2 h-2 bg-cyan-500 rounded-full group-hover:animate-ping" />
          AI Discovery
        </button>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-24 pb-16 px-6 text-center overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-cyan-600/10 blur-[120px] -z-10 rounded-full" />
        <h1 className="text-5xl md:text-7xl font-orbitron font-bold mb-6 leading-tight uppercase tracking-tighter">
          Gadgets and Those <br />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-500">Things You didn't know You needed</span>
        </h1>
        <p className="max-w-2xl mx-auto text-gray-400 text-lg mb-10 leading-relaxed">
          Curated tech essentials from the <span className="text-white font-bold">@GadgetsAndThose</span> community. 
          Use our AI Discovery Scout to find exactly what your workspace is missing.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <button className="bg-cyan-600 hover:bg-cyan-500 px-8 py-4 rounded-full font-bold shadow-xl shadow-cyan-600/20 transition-all uppercase tracking-widest text-sm">
            Browse All Gear
          </button>
          <button 
             onClick={() => setIsChatOpen(true)}
             className="glass px-8 py-4 rounded-full font-bold hover:bg-white/10 transition-all border-cyan-500/20 uppercase tracking-widest text-sm"
          >
            Launch AI Chat
          </button>
        </div>
      </section>

      {/* Product Grid */}
      <main className="flex-1 max-w-7xl mx-auto px-6 py-16 w-full">
        <div className="flex justify-between items-end mb-12">
          <div>
            <h2 className="text-3xl font-orbitron font-bold mb-2 uppercase tracking-tighter text-cyan-50">Featured Selection</h2>
            <div className="h-1 w-24 bg-cyan-600 rounded-full" />
          </div>
          <p className="text-gray-500 text-xs font-bold uppercase tracking-widest hidden sm:block opacity-60">Verified Tech</p>
        </div>
        
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
            <span className="text-xs font-bold text-cyan-500 uppercase tracking-widest animate-pulse">Syncing Catalog...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {products.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="glass border-t border-white/5 py-12 px-6 text-center">
        <div className="mb-6 opacity-30">
          <div className="font-orbitron font-bold text-xl text-white tracking-widest uppercase mb-1">G&T HUB</div>
          <div className="text-[10px] font-bold tracking-[0.5em] text-cyan-500">EST 2024</div>
        </div>
        <p className="text-gray-600 text-[10px] font-bold tracking-widest uppercase mb-2">
          &copy; Gadgets and Those. All rights reserved.
        </p>
      </footer>

      {!isChatOpen && (
        <button 
          onClick={() => setIsChatOpen(true)}
          className="fixed bottom-8 right-8 w-16 h-16 bg-cyan-600 rounded-full shadow-2xl shadow-cyan-600/40 flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40 neon-glow border border-white/20"
        >
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </button>
      )}

      {isChatOpen && (
        <ChatInterface 
          products={products} 
          onClose={() => setIsChatOpen(false)} 
        />
      )}
    </div>
  );
};

export default App;
