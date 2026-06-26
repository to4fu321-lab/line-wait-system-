'use client';

import { useState } from 'react';
import staffFaq from '@/data/faq-staff.json';
import FaqAccordion from '@/app/_components/FaqAccordion';
import HelpTooltip from '@/app/_components/HelpTooltip';
import type { FaqCategory } from '@/types/faq';

export default function StaffQaPage() {
  const [query, setQuery] = useState('');
  const categories = staffFaq as FaqCategory[];

  const filtered: FaqCategory[] = query.trim()
    ? categories
        .map((cat) => ({
          ...cat,
          items: cat.items.filter(
            (item) =>
              item.question.includes(query) ||
              item.answer.includes(query)
          ),
        }))
        .filter((cat) => cat.items.length > 0)
    : categories;

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-4">
        <h1 className="text-xl font-bold text-gray-900">スタッフ向けQ&amp;A</h1>
        <HelpTooltip text="業務に関するよくある質問です。キーワードで絞り込めます。" />
      </div>
      <div className="mb-6 flex items-center gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="キーワードで検索..."
          className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <HelpTooltip text="質問・回答に含まれるキーワードで絞り込めます" />
      </div>
      {filtered.length === 0 ? (
        <p className="text-center text-gray-500 py-8">
          該当するQ&amp;Aが見つかりませんでした
        </p>
      ) : (
        <FaqAccordion categories={filtered} />
      )}
    </main>
  );
}
