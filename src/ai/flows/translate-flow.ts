'use server';
/**
 * @fileOverview محرك الترجمة الذكي لنظام NovaFlow.
 * تم تحديثه لضمان الترجمة الإلزامية بين العربية والإنجليزية ومنع التكرار.
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
  prompt: `You are a high-precision technical translator for a professional Engineering ERP.
  
  TASK:
  Translate the input text strictly to {{targetLang}}.
  
  STRICT RULES:
  1. If targetLang is 'en', the output MUST be in English (Latin characters), using professional engineering/construction terminology.
  2. If targetLang is 'ar', the output MUST be in Standard Professional Arabic (Arabic script).
  3. NEVER return the original text in the same language. You MUST switch the language.
  4. Keep the output concise and suitable for a form field name.
  
  Text to translate: "{{text}}"`,
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
      // التحقق من أن النص المترجم مختلف فعلاً عن الأصلي لمنع التكرار
      if (output && output.translatedText.toLowerCase() !== input.text.toLowerCase()) {
        return output;
      }
      return { translatedText: '' }; // نرجع فارغ بدلاً من النص الأصلي لعدم تضليل المستخدم
    } catch (error) {
      return { translatedText: '' };
    }
  }
);
