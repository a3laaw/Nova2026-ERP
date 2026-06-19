'use server';
/**
 * @fileOverview محرك الترجمة الذكي لنظام NovaFlow.
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
  if (!input.text.trim()) return { translatedText: '' };
  try {
    const { output } = await translatePrompt(input);
    if (!output || !output.translatedText) {
      return { translatedText: '' };
    }
    return { translatedText: output.translatedText.trim() };
  } catch (error) {
    console.error("Translation flow error:", error);
    return { translatedText: '' };
  }
}

const translatePrompt = ai.definePrompt({
  name: 'translatePrompt',
  input: { schema: TranslateInputSchema },
  output: { schema: TranslateOutputSchema },
  prompt: `You are a high-precision professional translator for an ERP system.
  
  TASK:
  Translate the following text into {{targetLang}}.
  
  RULES:
  1. If targetLang is 'en', provide a professional English engineering/business term.
  2. If targetLang is 'ar', provide a Standard Professional Arabic term.
  3. DO NOT return the same text if it's already in the target language.
  4. Keep it concise, suitable for a form field.
  
  TEXT: "{{{text}}}"`,
});