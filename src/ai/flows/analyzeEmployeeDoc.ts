'use server';
/**
 * @fileOverview A Genkit flow for analyzing uploaded employee documents.
 *
 * - analyzeEmployeeDoc - A function that handles the employee document analysis process.
 * - AnalyzeEmployeeDocInput - The input type for the analyzeEmployeeDoc function.
 * - AnalyzeEmployeeDocOutput - The return type for the analyzeEmployeeDoc function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Input Schema
const AnalyzeEmployeeDocInputSchema = z.object({
  documentDataUri: z
    .string()
    .describe(
      "The employee document (e.g., PDF, image) as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type AnalyzeEmployeeDocInput = z.infer<typeof AnalyzeEmployeeDocInputSchema>;

// Output Schema
const AnalyzeEmployeeDocOutputSchema = z.object({
  employeeName: z.string().optional().describe('The full name of the employee mentioned in the document.'),
  documentType: z.string().optional().describe('The type of the document (e.g., "Employment Contract", "Civil ID", "University Degree", "Passport").'),
  documentNumber: z.string().optional().describe('Any official identification number associated with the document, if applicable.'),
  issueDate: z.string().optional().describe('The date the document was issued, in ISO 8601 format (YYYY-MM-DD), if found.'),
  expiryDate: z.string().optional().describe('The date the document expires, in ISO 8601 format (YYYY-MM-DD), if found.'),
  issuer: z.string().optional().describe('The entity or organization that issued the document (e.g., "Ministry of Interior", "Harvard University").'),
  summary: z.string().optional().describe('A brief summary of the main content and purpose of the document.'),
  extractedText: z.string().optional().describe('The complete textual content of the document.'),
  complianceNotes: z.string().optional().describe('Any immediate notes or observations regarding compliance or missing information based on common HR document requirements.'),
});
export type AnalyzeEmployeeDocOutput = z.infer<typeof AnalyzeEmployeeDocOutputSchema>;

// Wrapper function to call the flow
export async function analyzeEmployeeDoc(input: AnalyzeEmployeeDocInput): Promise<AnalyzeEmployeeDocOutput> {
  return analyzeEmployeeDocFlow(input);
}

// Genkit Prompt Definition
const analyzeEmployeeDocPrompt = ai.definePrompt({
  name: 'analyzeEmployeeDocPrompt',
  input: {schema: AnalyzeEmployeeDocInputSchema},
  output: {schema: AnalyzeEmployeeDocOutputSchema},
  prompt: `You are an AI HR assistant specialized in analyzing employee documents. Your task is to extract key information from the provided document and present it in a structured JSON format based on the output schema provided.

If a piece of information is not found, return an empty string or omit the field.

Document: {{media url=documentDataUri}}`,
});

// Genkit Flow Definition
const analyzeEmployeeDocFlow = ai.defineFlow(
  {
    name: 'analyzeEmployeeDocFlow',
    inputSchema: AnalyzeEmployeeDocInputSchema,
    outputSchema: AnalyzeEmployeeDocOutputSchema,
  },
  async (input) => {
    const {output} = await ai.generate({
      prompt: analyzeEmployeeDocPrompt(input),
      // استخدام نموذج 1.5 المستقر بدلاً من 2.5
      model: 'googleai/gemini-1.5-flash',
      config: {
        responseModalities: ['TEXT'],
      },
    });

    if (!output) {
      throw new Error('Failed to extract information from the document.');
    }
    return output;
  }
);
