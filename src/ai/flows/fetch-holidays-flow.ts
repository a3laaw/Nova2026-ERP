'use server';
/**
 * @fileOverview محرك البحث الذكي عن العطلات الرسمية المطور.
 * 
 * - fetchPublicHolidays - دالة لجلب العطلات الرسمية لدولة معينة باستخدام تقنيات Genkit.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const FetchHolidaysInputSchema = z.object({
  country: z.string().describe('الدولة المراد البحث عن عطلاتها (مثلاً: الكويت)'),
  year: z.number().describe('السنة المراد جلب العطلات لها'),
});

const HolidaySchema = z.object({
  date: z.string().describe('تاريخ العطلة بصيغة YYYY-MM-DD فقط'),
  name: z.string().describe('اسم العطلة الرسمي باللغة العربية'),
  nameEn: z.string().describe('اسم العطلة الرسمي باللغة الإنجليزية'),
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
  prompt: `You are a high-precision administrative assistant for NovaFlow ERP.
  
  TASK:
  Provide a list of all official public and religious holidays for {{{country}}} in the year {{year}}.
  
  STRICT RULES:
  1. Return ONLY a valid JSON object matching the requested output schema.
  2. The "date" field MUST be in exactly "YYYY-MM-DD" format.
  3. Include major national holidays (National Day, Liberation Day) and religious ones (Eid Al-Fitr, Eid Al-Adha, Islamic New Year, Prophet's Birthday).
  4. Ensure Arabic names are formal and professional.
  5. If specific dates for lunar holidays (Eids) are estimated, provide the most likely dates for {{year}}.
  
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
    try {
      const { output } = await ai.generate({
        prompt: fetchHolidaysPrompt(input),
        config: {
          temperature: 0.1, // تقليل العشوائية لضمان دقة التنسيق
        }
      });

      if (!output || !output.holidays) {
        throw new Error('AI failed to generate a structured holiday list.');
      }

      return output;
    } catch (error) {
      console.error("Genkit Flow Error (fetchHolidays):", error);
      throw error;
    }
  }
);

export async function fetchPublicHolidays(input: FetchHolidaysInput): Promise<FetchHolidaysOutput> {
  return fetchHolidaysFlow(input);
}
