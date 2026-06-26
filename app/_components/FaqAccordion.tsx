'use client';

import { useState } from 'react';
import type { FaqCategory } from '@/types/faq';

type Props = {
  categories: FaqCategory[];
};

export default function FaqAccordion({ categories }: Props) {
  const [openKey, setOpenKey] = useState<string | null>(null);

  if (!categories || categories.length === 0) {
    return (
      <p className="text-center text-gray-500 py-8">現在Q&amp;Aを準備中です</p>
    );
  }

  return (
    <div className="space-y-6">
      {categories.map((cat) => (
        <div key={cat.category}>
          <h2 className="text-base font-bold mb-2 text-gray-700 px-1">
            {cat.category}
          </h2>
          <div className="divide-y divide-gray-200 border border-gray-200 rounded-lg overflow-hidden">
            {cat.items.map((item, i) => {
              const key = `${cat.category}-${i}`;
              const isOpen = openKey === key;
              return (
                <div key={key}>
                  <button
                    type="button"
                    className="w-full text-left px-4 py-3 flex justify-between items-center hover:bg-gray-50 transition-colors"
                    onClick={() => setOpenKey(isOpen ? null : key)}
                    aria-expanded={isOpen}
                  >
                    <span className="font-medium text-gray-800 text-sm">
                      {item.question}
                    </span>
                    <span className="ml-2 text-gray-400 flex-shrink-0 text-xs">
                      {isOpen ? '▲' : '▼'}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="px-4 py-3 bg-gray-50 text-gray-600 text-sm whitespace-pre-line border-t border-gray-200">
                      {item.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
