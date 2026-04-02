import chalk from 'chalk';

export function formatStatsTable(stats: { subtype: string; count: number }[], total: number, apiUrl: string): string {
  const lines: string[] = [];
  lines.push(`ACP Context Store (${apiUrl})`);
  lines.push(`  ${'Type'.padEnd(20)} Count`);
  lines.push(`  ${'─'.repeat(30)}`);
  for (const s of stats) {
    lines.push(`  ${s.subtype.padEnd(20)} ${String(s.count).padStart(5)}`);
  }
  lines.push(`  ${'─'.repeat(30)}`);
  lines.push(`  ${'Total'.padEnd(20)} ${String(total).padStart(5)}`);
  return lines.join('\n');
}

export function formatEntityProfile(entity: Record<string, unknown>): string {
  const lines: string[] = [];
  const name = entity.canonicalName as string;
  const subtype = entity.subtype as string;
  const objectId = entity.objectId as string;

  lines.push(chalk.bold(`━━━ ${name} (${subtype}) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━`));
  lines.push(`ID: ${objectId}`);
  lines.push('');

  const context = entity.context as Record<string, Record<string, unknown>> | undefined;
  if (context) {
    const groupOrder = ['attributes', 'measures', 'actors', 'temporals', 'locations', 'intents', 'processes'];
    for (const group of groupOrder) {
      const data = context[group];
      if (!data || Object.keys(data).length === 0) continue;
      lines.push(chalk.cyan(`${group.charAt(0).toUpperCase() + group.slice(1)}:`));
      for (const [k, v] of Object.entries(data)) {
        const display = Array.isArray(v) ? v.join(', ') : String(v);
        lines.push(`  ${k}: ${display}`);
      }
    }
  }

  const txns = entity.recentTransactions as Record<string, unknown>[] | undefined;
  if (txns && txns.length > 0) {
    lines.push('');
    lines.push(chalk.cyan('Recent Transactions:'));
    for (const t of txns) {
      const date = new Date(t.occurredAt as string).toISOString().slice(0, 10);
      const type = t.transactionType as string;
      const ctx = t.context as Record<string, unknown>;
      const summary = ctx ? Object.values(ctx).slice(0, 2).join(', ') : '';
      lines.push(`  ${date}  ${type.padEnd(22)} ${summary}`);
    }
  }

  return lines.join('\n');
}

export function formatChanges(changes: Record<string, unknown>[], cursor: string): string {
  const lines: string[] = [];
  for (const c of changes) {
    const date = new Date(c.changedAt as string).toISOString().slice(0, 16).replace('T', ' ');
    const type = c.subtype as string;
    const changeType = c.changeType as string;
    const objectType = c.objectType as string;
    lines.push(`  ${date}  (${type})  ${changeType}`);
  }
  lines.push('');
  lines.push(`Cursor: ${cursor} (use as --since for next poll)`);
  return lines.join('\n');
}

export function formatTransactions(transactions: Record<string, unknown>[]): string {
  const lines: string[] = [];
  for (const t of transactions) {
    const date = new Date(t.occurredAt as string).toISOString().slice(0, 16).replace('T', ' ');
    const type = t.transactionType as string;
    const name = (t as Record<string, unknown>).canonicalName as string | undefined;
    const prefix = name ? `${name} - ` : '';
    lines.push(`  ${date}  ${prefix}${type}`);
  }
  return lines.join('\n');
}
