
import React from 'react';
import { Product } from '../types';

interface ProductCardProps {
  product: Product;
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  return (
    <div className="group relative glass rounded-3xl overflow-hidden transition-all duration-500 hover:-translate-y-2 hover:neon-glow border-white/5 hover:border-cyan-500/30">
      <div className="aspect-[4/5] overflow-hidden bg-gray-950 relative">
        <img 
          src={product.imageUrl} 
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-70 group-hover:opacity-100"
        />
        <div className="absolute top-4 left-4">
          <span className="px-3 py-1 bg-black/60 backdrop-blur-md rounded-full text-[9px] font-bold tracking-widest text-cyan-400 border border-cyan-500/20 uppercase font-orbitron">
            {product.category}
          </span>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-transparent to-transparent opacity-80" />
      </div>
      
      <div className="p-7 relative">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold font-orbitron tracking-tight text-white group-hover:text-cyan-400 transition-colors">
            {product.name}
          </h3>
          <span className="text-xl font-bold text-white font-orbitron">
            ${product.price}
          </span>
        </div>
        
        <p className="text-gray-400 text-sm mb-6 line-clamp-2 leading-relaxed font-medium">
          {product.description}
        </p>
        
        <div className="flex flex-wrap gap-2 mb-8">
          {product.features.slice(0, 3).map(feature => (
            <span key={feature} className="px-2.5 py-1 bg-white/5 rounded-lg text-[9px] font-bold text-gray-500 uppercase tracking-wider border border-white/5">
              {feature}
            </span>
          ))}
        </div>
        
        <a 
          href={product.affiliateUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="relative overflow-hidden w-full flex items-center justify-center gap-2 py-4 bg-white/5 hover:bg-cyan-600 text-white font-bold rounded-2xl transition-all duration-300 border border-white/10 hover:border-cyan-500 shadow-sm uppercase tracking-widest text-[10px]"
        >
          Secure Hardware
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
        </a>
      </div>
    </div>
  );
};

export default ProductCard;
