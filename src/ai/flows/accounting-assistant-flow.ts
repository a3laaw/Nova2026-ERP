'use server';
/**
 * @fileOverview This flow provides an AI accounting assistant that can draft journal entries
 * or offer accounting advice based on natural language descriptions, ensuring efficiency and accuracy.
 *
 * - useAccountingAssistant - The main function to interact with the accounting assistant flow.
 * - AccountingAssistantInput - The input type for the accounting assistant.
 * - AccountingAssistantOutput - The output type for the accounting assistant.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { defaultCoa } from '@/lib/default-coa';

const JournalEntryLineSchema = z.object({
  accountName: z.string().describe('The name of the accounting account (e.g., "Cash", "Accounts Receivable", "Sales Revenue"). Must exist in the provided Chart of Accounts.'),
  debit: z.number().optional().describe('The debit amount for this line item. Leave as 0 if credit.'),
  credit: z.number().optional().describe('The credit amount for this line item. Leave as 0 if debit.'),
});

const JournalEntrySchema = z.object({
  narration: z.string().describe('A brief explanation of the journal entry.'),
  lines: z.array(JournalEntryLineSchema).describe('An array of journal entry lines. The sum of debits must equal the sum of credits.'),
});

const AccountingAssistantInputSchema = z.object({
  description: z.string().describe('Natural language description of the transaction or accounting query.'),
});
export type AccountingAssistantInput = z.infer<typeof AccountingAssistantInputSchema>;

const AccountingAssistantOutputSchema = z.object({
  journalEntry: JournalEntrySchema.optional().describe('A drafted journal entry based on the description. Provided if the request was to record a transaction.'),
  advice: z.string().optional().describe('Accounting advice or an answer to the query. Provided if the request was for advice.'),
}).describe('Output can either be a journal entry or accounting advice, but not both.');
export type AccountingAssistantOutput = z.infer<typeof AccountingAssistantOutputSchema>;

export async function useAccountingAssistant(input: AccountingAssistantInput): Promise<AccountingAssistantOutput> {
  return accountingAssistantFlow(input);
}

const accountingAssistantPrompt = ai.definePrompt({
  name: 'accountingAssistantPrompt',
  model: 'googleai/gemini-1.5-flash',
  input: {
    schema: z.object({
      description: z.string(),
      coaAsString: z.string(),
    }),
  },
  output: { schema: AccountingAssistantOutputSchema },
  prompt: `You are an expert accountant for Nova ERP. Your task is to assist users by either drafting balanced journal entries for transactions or providing clear accounting advice.

When drafting a journal entry, you MUST ensure that:
1. The sum of all 'debit' amounts equals the sum of all 'credit' amounts.
2. The 'accountName' for each line item MUST come from the provided Chart of Accounts. Do not invent new accounts.
3. If no specific account name is clearly implied by the description, choose the most appropriate general account.
4. If a transaction involves an increase in an asset or expense, it's typically a debit.
5. If a transaction involves an increase in a liability, equity, or revenue, it's typically a credit.

When providing accounting advice, explain concepts clearly and concisely.

Here is the Chart of Accounts you must use:
{{{coaAsString}}}

User's Request: {{{description}}}

Based on the user's request, provide either a JSON object for a 'journalEntry' or a string for 'advice'. Do NOT provide both. If the request cannot be fulfilled as a journal entry or advice, provide clear advice explaining why.`,
});

const accountingAssistantFlow = ai.defineFlow(
  {
    name: 'accountingAssistantFlow',
    inputSchema: AccountingAssistantInputSchema,
    outputSchema: AccountingAssistantOutputSchema,
  },
  async (input) => {
    const coaAsString = defaultCoa
      .map((account) => `${account.name} (Type: ${account.type}, Code: ${account.code})`)
      .join('; ');

    const { output } = await accountingAssistantPrompt({
      description: input.description,
      coaAsString: coaAsString,
    });
    return output!;
  }
);
