export type InvoiceSummary = {
  id: string;
  number: string;
  status: 'DRAFT' | 'ISSUED' | 'PAID' | 'CANCELLED';
  amountGross: number;
  currency: 'CZK' | 'EUR';
  buyerDisplayName?: string;
  issuedAt?: string;
  dueAt?: string;
  paidAt?: string;
  pdfPath: string;
  version: number;
};

export const formatMoney = (amount: number, currency: InvoiceSummary['currency']) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount / 100);

export const formatDate = (value?: string, fallback = 'No due date') => {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

export const getCustomerLabel = (invoice: InvoiceSummary) => {
  if (invoice.buyerDisplayName && invoice.buyerDisplayName.trim().length > 0) {
    return invoice.buyerDisplayName;
  }

  return 'Customer name is not available.';
};

export const getUrgency = (invoice: InvoiceSummary, now: Date) => {
  if (invoice.status === 'PAID') {
    return {
      tone: 'emerald' as const,
      label: invoice.paidAt ? `Paid ${formatDate(invoice.paidAt)}` : 'Paid',
      badge: 'Paid',
      needsAttention: false,
    };
  }

  if (invoice.status === 'DRAFT') {
    return {
      tone: 'slate' as const,
      label: 'Draft invoice',
      badge: 'Draft',
      needsAttention: false,
    };
  }

  if (invoice.status === 'CANCELLED') {
    return {
      tone: 'slate' as const,
      label: 'Cancelled invoice',
      badge: 'Cancelled',
      needsAttention: false,
    };
  }

  if (!invoice.dueAt) {
    return {
      tone: 'amber' as const,
      label: 'Due date is not available',
      badge: 'Unpaid',
      needsAttention: true,
    };
  }

  const dueDate = new Date(invoice.dueAt);
  if (Number.isNaN(dueDate.getTime())) {
    return {
      tone: 'amber' as const,
      label: 'Due date is not available',
      badge: 'Unpaid',
      needsAttention: true,
    };
  }

  const nowAtMidnight = new Date(now);
  nowAtMidnight.setHours(0, 0, 0, 0);
  const dueAtMidnight = new Date(dueDate);
  dueAtMidnight.setHours(0, 0, 0, 0);
  const daysUntilDue = Math.round((dueAtMidnight.getTime() - nowAtMidnight.getTime()) / 86400000);

  if (daysUntilDue < 0) {
    return {
      tone: 'rose' as const,
      label: `${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) === 1 ? '' : 's'} overdue`,
      badge: 'Overdue',
      needsAttention: true,
    };
  }

  if (daysUntilDue === 0) {
    return {
      tone: 'amber' as const,
      label: 'Due today',
      badge: 'Due today',
      needsAttention: true,
    };
  }

  return {
    tone: 'sky' as const,
    label: `Due ${formatDate(invoice.dueAt)}`,
    badge: 'Issued',
    needsAttention: false,
  };
};
