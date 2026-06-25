'use server';
/**
 * @fileOverview An AI agent that analyzes multiple supplier quotations, extracts key details,
 * highlights differences, and provides a recommendation for purchasing managers.
 *
 * - analyzeSupplierQuotes - A function that handles the supplier quote analysis process.
 * - AnalyzeSupplierQuotesInput - The input type for the analyzeSupplierQuotes function.
 * - AnalyzeSupplierQuotesOutput - The return type for the analyzeSupplierQuotes function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const SupplierQuoteSchema = z.object({
  supplierName: z.string().describe('The name of the supplier.'),
  quoteText: z.string().describe('The full text content of the supplier quotation.'),
});

const ExtractedQuoteDetailSchema = z.object({
  item: z.string().describe('The name of the item being quoted.'),
  quantity: z.number().describe('The quoted quantity for the item.').optional(),
  unitPrice: z.number().describe('The unit price of the item.').optional(),
  totalPrice: z.number().describe('The total price for the item quantity.').optional(),
  deliveryTimeDays: z.number().describe('Estimated delivery time in days.').optional(),
  paymentTerms: z.string().describe('Payment terms (e.g., "Net 30", "50% upfront").').optional(),
  validityDays: z.number().describe('Number of days the quote is valid.').optional(),
  notes: z.string().describe('Any other important notes or conditions for this item.').optional(),
});

const SupplierQuoteAnalysisSchema = z.object({
  supplierName: z.string().describe('The name of the supplier.'),
  extractedDetails: z.array(ExtractedQuoteDetailSchema).describe('A list of key details extracted for each item in the supplier\u0027s quote.'),
});

const ComparisonSummarySchema = z.object({
  bestOverallSupplier: z.string().describe('The name of the supplier offering the best overall deal, considering price, delivery, and terms.').optional(),
  keyDifferences: z.string().describe('A narrative summary highlighting major differences across all quotes (e.g., price variations, delivery times, payment terms).'),
  recommendation: z.string().describe('A final recommendation and justification for the purchasing decision.'),
});

const AnalyzeSupplierQuotesInputSchema = z.object({
  quotes: z.array(SupplierQuoteSchema).describe('An array of supplier quotations, each containing the supplier\u0027s name and the quote text.'),
});
export type AnalyzeSupplierQuotesInput = z.infer<typeof AnalyzeSupplierQuotesInputSchema>;

const AnalyzeSupplierQuotesOutputSchema = z.object({
  analysisPerQuote: z.array(SupplierQuoteAnalysisSchema).describe('Detailed analysis for each individual supplier quotation.'),
  comparisonSummary: ComparisonSummarySchema.describe('A summary comparing all quotes and providing a recommendation.'),
});
export type AnalyzeSupplierQuotesOutput = z.infer<typeof AnalyzeSupplierQuotesOutputSchema>;

export async function analyzeSupplierQuotes(input: AnalyzeSupplierQuotesInput): Promise<AnalyzeSupplierQuotesOutput> {
  return analyzeSupplierQuotesFlow(input);
}

const analyzeSupplierQuotesPrompt = ai.definePrompt({
  name: 'analyzeSupplierQuotesPrompt',
  model: 'googleai/gemini-1.5-flash',
  input: { schema: AnalyzeSupplierQuotesInputSchema },
  output: { schema: AnalyzeSupplierQuotesOutputSchema },
  prompt: `You are an expert purchasing manager responsible for analyzing supplier quotations. Your goal is to extract key details from each quote and then provide a comprehensive comparison, highlighting significant differences and recommending the best option.

Here are the supplier quotations for analysis:

{{#each quotes}}
## Supplier: {{{supplierName}}}
Quote Text:
'''
{{{quoteText}}}
'''
---
{{/each}}

Based on the provided quotations, first, extract the key details for each item quoted by each supplier. Pay close attention to item names, quantities, unit prices, total prices, estimated delivery times, payment terms, and validity periods. Then, provide a comparison summary, focusing on overall value, pricing, delivery, and payment terms, and finally a clear recommendation.

Ensure your output strictly adheres to the following JSON schema:
{{output.schema}}`,
});

const analyzeSupplierQuotesFlow = ai.defineFlow(
  {
    name: 'analyzeSupplierQuotesFlow',
    inputSchema: AnalyzeSupplierQuotesInputSchema,
    outputSchema: AnalyzeSupplierQuotesOutputSchema,
  },
  async (input) => {
    const { output } = await analyzeSupplierQuotesPrompt(input);
    return output!;
  }
);
