'use server';
/**
 * @fileOverview محرك الترجمة الذكي لنظام NovaFlow.
 * يستخدم Gemini Flash لترجمة المصطلحات الهندسية والإدارية بدقة عالية.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const TranslateInputSchema = z.object({
  text: z.string().describe('النص المراد ترجمته'),
  targetLang: z.enum(['ar', 'en']).describe('اللغة المستهدفة'),
});

const TranslateOutputSchema = z.object({
  translatedText: z.string().describe('النص المترجم'),
});

export async function translateText(input: z.infer<typeof TranslateInputSchema>) {
  return translateFlow(input);
}

const translatePrompt = ai.definePrompt({
  name: 'translatePrompt',
  input: { schema: TranslateInputSchema },
  output: { schema: TranslateOutputSchema },
  prompt: `You are a professional technical translator for an ERP system. 
  Translate the following text to {{targetLang}}. 
  If the target is English, use professional engineering/business terminology.
  If the target is Arabic, use standard professional Arabic.
  Text: "{{text}}"`,
});

const translateFlow = ai.defineFlow(
  {
    name: 'translateFlow',
    inputSchema: TranslateInputSchema,
    outputSchema: TranslateOutputSchema,
  },
  async (input) => {
    if (!input.text.trim()) return { translatedText: '' };
    try {
      const { output } = await translatePrompt(input);
      // في حال نجاح الترجمة نرجع النص المترجم، وفي حال فشلها نرجع النص الأصلي كخيار آمن
      return output || { translatedText: input.text };
    } catch (error) {
      // معالجة الخطأ 503 أو أي خطأ شبكة بإرجاع النص الأصلي لمنع تعطل الواجهة
      return { translatedText: input.text };
    }
  }
);
