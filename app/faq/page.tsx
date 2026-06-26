import customerFaq from '@/data/faq-customer.json';
import FaqAccordion from '@/app/_components/FaqAccordion';
import type { FaqCategory } from '@/types/faq';

export const metadata = {
  title: 'よくあるご質問',
};

export default function FaqPage() {
  const categories = customerFaq as FaqCategory[];

  return (
    <main className="max-w-2xl mx-auto px-4 py-8 min-h-screen bg-white">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">よくあるご質問</h1>
      </div>
      <FaqAccordion categories={categories} />
      <p className="mt-8 text-center text-xs text-gray-400">
        解決しない場合はLINEよりスタッフにお問い合わせください
      </p>
    </main>
  );
}
