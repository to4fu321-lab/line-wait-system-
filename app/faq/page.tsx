import customerFaq from '@/data/faq-customer.json';
import FaqAccordion from '@/app/_components/FaqAccordion';
import HelpTooltip from '@/app/_components/HelpTooltip';
import type { FaqCategory } from '@/types/faq';

export const metadata = {
  title: 'よくあるご質問',
};

export default function FaqPage() {
  const categories = customerFaq as FaqCategory[];

  return (
    <main className="max-w-2xl mx-auto px-4 py-8 min-h-screen bg-white">
      <div className="flex items-center gap-2 mb-6">
        <h1 className="text-xl font-bold text-gray-900">よくあるご質問</h1>
        <HelpTooltip text="お客様からよく寄せられる質問をまとめています。カテゴリをタップして回答を表示できます。" />
      </div>
      <FaqAccordion categories={categories} />
      <p className="mt-8 text-center text-xs text-gray-400">
        解決しない場合はLINEよりスタッフにお問い合わせください
      </p>
    </main>
  );
}
