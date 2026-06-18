'use server';
/**
 * @fileOverview A GenAI tool for accountants to suggest smart reconciliations between bank statements and ledger entries.
 *
 * - reconcileBankStatement - A function that handles the bank reconciliation process.
 * - ReconcileBankStatementInput - The input type for the reconcileBankStatement function.
 * - ReconcileBankStatementOutput - The return type for the reconcileBankStatement function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Input Schema
const ReconcileBankStatementInputSchema = z.object({
  bankStatementEntries: z.array(z.object({
    id: z.string().describe('Unique identifier for the bank statement entry.'),
    date: z.string().describe('Date of the bank transaction in YYYY-MM-DD format.'),
    description: z.string().describe('Description of the bank transaction.'),
    amount: z.number().describe('Absolute amount of the bank transaction.'),
    transactionType: z.enum(['DEBIT', 'CREDIT']).describe('Type of bank transaction: DEBIT for withdrawals, CREDIT for deposits.')
  })).describe('List of entries from the bank statement.'),
  ledgerEntries: z.array(z.object({
    id: z.string().describe('Unique identifier for the ledger entry.'),
    date: z.string().describe('Date of the ledger transaction in YYYY-MM-DD format.'),
    description: z.string().describe('Description of the ledger transaction.'),
    amount: z.number().describe('Absolute amount of the ledger transaction.'),
    transactionType: z.enum(['DEBIT', 'CREDIT']).describe('Type of ledger transaction: DEBIT for money out (e.g., expenses), CREDIT for money in (e.g., revenue).'),
    accountName: z.string().optional().describe('The ledger account name associated with the entry (e.g., "Bank - Main", "Accounts Payable").')
  })).describe('List of entries from the company\'s general ledger, filtered for bank-related accounts.')
});

export type ReconcileBankStatementInput = z.infer<typeof ReconcileBankStatementInputSchema>;

// Output Schema
const ReconcileBankStatementOutputSchema = z.object({
  suggestedMatches: z.array(z.object({
    bankStatementEntryId: z.string().describe('ID of the bank statement entry.'),
    ledgerEntryId: z.string().describe('ID of the ledger entry.'),
    matchConfidence: z.number().min(0).max(1).describe('Confidence score of the match (0-1). 1 being a perfect match.'),
    reason: z.string().optional().describe('Reason for the suggested match, if not obvious.')
  })).describe('Suggested pairings between bank statement entries and ledger entries.'),
  unmatchedBankEntries: z.array(z.string()).describe('IDs of bank statement entries that could not be matched.'),
  unmatchedLedgerEntries: z.array(z.string()).describe('IDs of ledger entries that could not be matched.'),
  summary: z.string().describe('A summary of the reconciliation process, highlighting key findings, potential discrepancies, and areas requiring manual review.')
});

export type ReconcileBankStatementOutput = z.infer<typeof ReconcileBankStatementOutputSchema>;

// Wrapper function
export async function reconcileBankStatement(input: ReconcileBankStatementInput): Promise<ReconcileBankStatementOutput> {
  return reconcileBankStatementFlow(input);
}

// Genkit Prompt definition
const reconcileBankStatementPrompt = ai.definePrompt({
  name: 'reconcileBankStatementPrompt',
  input: { schema: ReconcileBankStatementInputSchema },
  output: { schema: ReconcileBankStatementOutputSchema },
  prompt: `You are an expert accountant specializing in bank reconciliation. Your task is to compare bank statement entries with general ledger entries and identify matches, as well as highlight any discrepancies.

Follow these steps for reconciliation:
1.  **Strict Matching**: First, try to find exact matches where 'date', 'amount', and 'transactionType' are identical, and 'description' is highly similar.
2.  **Fuzzy Matching**: For remaining unmatched entries, look for fuzzy matches where:
    *   'date' is within a small window (e.g., 1-2 days difference).
    *   'amount' is identical or very close.
    *   'transactionType' is the same.
    *   'description' contains keywords or partial phrases that indicate a strong likelihood of being the same transaction.
3.  **Confidence Score**: Assign a 'matchConfidence' from 0 (very low) to 1 (perfect match). Exact matches should be 1. Fuzzy matches should have a score reflecting the certainty.
4.  **Unmatched Entries**: Clearly identify all bank statement entries and ledger entries that do not have a match.
5.  **Summary**: Provide a concise summary of your findings, including the total number of matched items, the number of unmatched items from each source, and any notable patterns or significant discrepancies that an accountant should review.

Bank Statement Entries:
{{{JSON.stringify bankStatementEntries}}}

Ledger Entries:
{{{JSON.stringify ledgerEntries}}}`
});

// Genkit Flow definition
const reconcileBankStatementFlow = ai.defineFlow(
  {
    name: 'reconcileBankStatementFlow',
    inputSchema: ReconcileBankStatementInputSchema,
    outputSchema: ReconcileBankStatementOutputSchema
  },
  async (input) => {
    const { output } = await reconcileBankStatementPrompt(input);
    return output!;
  }
);