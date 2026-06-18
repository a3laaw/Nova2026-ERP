'use server';
/**
 * @fileOverview A Genkit flow for generating AI-powered cash flow projections.
 *
 * - generateCashFlowProjection - A function that handles the cash flow projection process.
 * - GenerateCashFlowProjectionInput - The input type for the generateCashFlowProjection function.
 * - GenerateCashFlowProjectionOutput - The return type for the generateCashFlowProjection function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ProjectMilestoneSchema = z.object({
  id: z.string().describe('Unique identifier for the project milestone.'),
  description: z.string().describe('Description of the project milestone.'),
  dueDate: z.string().describe('Expected completion date of the milestone (YYYY-MM-DD).'),
  expectedRevenue: z.number().describe('Expected revenue associated with this milestone.'),
});

const ContractPaymentScheduleSchema = z.object({
  contractId: z.string().describe('Identifier for the contract.'),
  paymentDate: z.string().describe('Scheduled date for the payment (YYYY-MM-DD).'),
  amount: z.number().describe('Amount of the payment.'),
});

const HistoricalPeriodDataSchema = z.object({
  period: z.string().describe('Period identifier, e.g., "2023-01".'),
  inflows: z.number().describe('Total cash inflows for the period.'),
  outflows: z.number().describe('Total cash outflows for the period.'),
});

const GenerateCashFlowProjectionInputSchema = z.object({
  projectMilestones: z.array(ProjectMilestoneSchema).describe('List of upcoming project milestones with expected revenues.'),
  contractPaymentSchedules: z.array(ContractPaymentScheduleSchema).describe('List of scheduled contract payments.'),
  historicalFinancialData: z.array(HistoricalPeriodDataSchema).describe('Historical financial data for past periods.'),
  projectionHorizonMonths: z.number().int().min(1).describe('Number of months to project the cash flow for.'),
  currentCashBalance: z.number().describe('The current cash balance of the company.'),
});
export type GenerateCashFlowProjectionInput = z.infer<typeof GenerateCashFlowProjectionInputSchema>;

const ProjectionPeriodOutputSchema = z.object({
  periodName: z.string().describe('Name of the projection period, e.g., "July 2024".'),
  projectedInflows: z.number().describe('Total projected cash inflows for this period.'),
  projectedOutflows: z.number().describe('Total projected cash outflows for this period.'),
  netCashFlow: z.number().describe('Net cash flow for this period (inflows - outflows).'),
  cumulativeCashFlow: z.number().describe('Cumulative cash flow at the end of this period.'),
  details: z.string().optional().describe('Brief explanation of major inflows/outflows for this period.'),
});

const GenerateCashFlowProjectionOutputSchema = z.object({
  projectionPeriods: z.array(ProjectionPeriodOutputSchema).describe('Array of cash flow projections for each period.'),
  summary: z.string().optional().describe('Overall summary of the cash flow projection and key takeaways.'),
});
export type GenerateCashFlowProjectionOutput = z.infer<typeof GenerateCashFlowProjectionOutputSchema>;

export async function generateCashFlowProjection(input: GenerateCashFlowProjectionInput): Promise<GenerateCashFlowProjectionOutput> {
  return generateCashFlowProjectionFlow(input);
}

const cashFlowProjectionPrompt = ai.definePrompt({
  name: 'cashFlowProjectionPrompt',
  input: { schema: GenerateCashFlowProjectionInputSchema },
  output: { schema: GenerateCashFlowProjectionOutputSchema },
  prompt: `You are an expert financial manager specializing in construction and engineering firms.
Your task is to generate a detailed cash flow projection based on the provided project milestones, contract payment schedules, and historical financial data.

Consider the following inputs:

Current Cash Balance: {{{currentCashBalance}}}

Projection Horizon: {{projectionHorizonMonths}} months

Project Milestones:
{{#each projectMilestones}}
- ID: {{this.id}}, Description: {{this.description}}, Due Date: {{this.dueDate}}, Expected Revenue: {{this.expectedRevenue}}
{{/each}}

Contract Payment Schedules:
{{#each contractPaymentSchedules}}
- Contract ID: {{this.contractId}}, Payment Date: {{this.paymentDate}}, Amount: {{this.amount}}
{{/each}}

Historical Financial Data (for understanding typical operational costs and income patterns):
{{#each historicalFinancialData}}
- Period: {{this.period}}, Inflows: {{this.inflows}}, Outflows: {{this.outflows}}
{{/each}}

Based on this information, provide a cash flow projection broken down by monthly periods for the specified projection horizon.
Calculate projected inflows, projected outflows, net cash flow for each period, and a cumulative cash flow.
Also, provide a summary of the projection.

Make sure to provide the output in the exact JSON format as described by the output schema, with all fields populated accurately.`,
});

const generateCashFlowProjectionFlow = ai.defineFlow(
  {
    name: 'generateCashFlowProjectionFlow',
    inputSchema: GenerateCashFlowProjectionInputSchema,
    outputSchema: GenerateCashFlowProjectionOutputSchema,
  },
  async (input) => {
    const { output } = await cashFlowProjectionPrompt(input);
    return output!;
  }
);
