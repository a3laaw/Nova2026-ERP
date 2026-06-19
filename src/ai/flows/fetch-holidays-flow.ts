'use server';
/**
 * @fileOverview محرك البحث الذكي عن العطلات الرسمية.
 * 
 * - fetchPublicHolidays - دالة لجلب العطلات الرسمية لدولة معينة.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const FetchHolidaysInputSchema = z.object({
  country: z.string().describe('الدولة المراد البحث عن عطلاتها (مثلاً: الكويت)'),
  year: z.number().describe('السنة المراد جلب العطلات لها'),
});

const HolidaySchema = z.object({
  date: z.string().describe('تاريخ العطلة بصيغة YYYY-MM-DD'),
  name: z.string().describe('اسم العطلة بالعربية'),
  nameEn: z.string().describe('اسم العطلة بالإنجليزية'),
});

const FetchHolidaysOutputSchema = z.object({
  holidays: z.array(HolidaySchema),
});

export type FetchHolidaysInput = z.infer<typeof FetchHolidaysInputSchema>;
export type FetchHolidaysOutput = z.infer<typeof FetchHolidaysOutputSchema>;

const fetchHolidaysPrompt = ai.definePrompt({
  name: 'fetchHolidaysPrompt',
  input: { schema: FetchHolidaysInputSchema },
  output: { schema: FetchHolidaysOutputSchema },
  prompt: `You are an expert administrative assistant for an ERP system.
  
  TASK:
  Find all official public holidays for {{{country}}} in the year {{year}}.
  
  RULES:
  1. Return the output strictly in the requested JSON format.
  2. Include major national and religious holidays (e.g., Eid Al-Fitr, National Day).
  3. Format dates strictly as YYYY-MM-DD.
  4. Ensure names are professional and correctly spelled in both Arabic and English.
  
  COUNTRY: "{{{country}}}"
  YEAR: {{year}}`,
});

const fetchHolidaysFlow = ai.defineFlow(
  {
    name: 'fetchHolidaysFlow',
    inputSchema: FetchHolidaysInputSchema,
    outputSchema: FetchHolidaysOutputSchema,
  },
  async (input) => {
    const { output } = await fetchHolidaysPrompt(input);
    if (!output) {
      throw new Error('Failed to generate holidays list');
    }
    return output;
  }
);

export async function fetchPublicHolidays(input: FetchHolidaysInput): Promise<FetchHolidaysOutput> {
  return fetchHolidaysFlow(input);
}
