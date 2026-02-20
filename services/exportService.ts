import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { AgentConversationMessage } from '../types';

export interface ExportOptions {
  filename: string;
  title: string;
  metadata?: Record<string, string>;
}

// Export to JSON
export async function exportToJSON(
  conversation: AgentConversationMessage[],
  options: ExportOptions
): Promise<void> {
  const data = {
    ...options,
    timestamp: new Date().toISOString(),
    messageCount: conversation.length,
    messages: conversation,
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadFile(blob, `${options.filename}.json`);
}

// Export to CSV
export async function exportToCSV(
  conversation: AgentConversationMessage[],
  options: ExportOptions
): Promise<void> {
  const headers = ['Agent Name', 'Message', 'Timestamp', 'Turn Number'];
  const rows = conversation.map((msg) => [
    msg.agentName,
    `"${msg.content.replace(/"/g, '""')}"`,
    new Date(msg.timestamp).toISOString(),
    msg.turnNumber,
  ]);

  const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  downloadFile(blob, `${options.filename}.csv`);
}

// Export to PDF
export async function exportToPDF(
  conversation: AgentConversationMessage[],
  options: ExportOptions,
  htmlElement?: HTMLElement
): Promise<void> {
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  let yPosition = 20;

  // Title
  pdf.setFontSize(16);
  pdf.text(options.title, 20, yPosition);
  yPosition += 15;

  // Metadata
  if (options.metadata) {
    pdf.setFontSize(10);
    Object.entries(options.metadata).forEach(([key, value]) => {
      pdf.text(`${key}: ${value}`, 20, yPosition);
      yPosition += 7;
    });
    yPosition += 5;
  }

  // Messages
  pdf.setFontSize(11);
  conversation.forEach((msg, idx) => {
    const agentText = `${msg.agentName}:`;
    pdf.setFont(undefined, 'bold');
    pdf.text(agentText, 20, yPosition);
    yPosition += 7;

    pdf.setFont(undefined, 'normal');
    const lines = pdf.splitTextToSize(msg.content, pageWidth - 40);
    pdf.text(lines, 25, yPosition);
    yPosition += lines.length * 5 + 5;

    // Add page break if needed
    if (yPosition > pageHeight - 20) {
      pdf.addPage();
      yPosition = 20;
    }
  });

  pdf.save(`${options.filename}.pdf`);
}

// Export to Markdown
export function exportToMarkdown(
  conversation: AgentConversationMessage[],
  options: ExportOptions
): void {
  let markdown = `# ${options.title}\n\n`;
  markdown += `**Generated:** ${new Date().toLocaleString()}\n\n`;

  if (options.metadata) {
    markdown += '## Metadata\n\n';
    Object.entries(options.metadata).forEach(([key, value]) => {
      markdown += `- **${key}:** ${value}\n`;
    });
    markdown += '\n';
  }

  markdown += '## Conversation\n\n';
  conversation.forEach((msg) => {
    markdown += `### ${msg.agentName}\n\n`;
    markdown += `${msg.content}\n\n`;
  });

  const blob = new Blob([markdown], { type: 'text/markdown' });
  downloadFile(blob, `${options.filename}.md`);
}

// Helper function to download file
function downloadFile(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

// Capture HTML element and convert to image
export async function captureAsImage(element: HTMLElement, filename: string): Promise<void> {
  try {
    const canvas = await html2canvas(element);
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `${filename}.png`;
    link.click();
  } catch (error) {
    console.error('Error capturing image:', error);
  }
}
