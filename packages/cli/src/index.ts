#!/usr/bin/env node
import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { ctxDefineCommand } from './commands/ctx-define.js';
import { ctxListCommand } from './commands/ctx-list.js';
import { ctxGetCommand } from './commands/ctx-get.js';
import { ctxSearchCommand } from './commands/ctx-search.js';
import { txnListCommand } from './commands/txn-list.js';
import { txnAddCommand } from './commands/txn-add.js';
import { changesCommand } from './commands/changes.js';
import { connectAddCommand } from './commands/connect-add.js';
import { connectListCommand } from './commands/connect-list.js';
import { connectSyncCommand } from './commands/connect-sync.js';

const program = new Command();

program
  .name('acp')
  .description('Agent Context Platform CLI')
  .version('0.1.0');

program.addCommand(initCommand);

const ctx = new Command('ctx').description('Context object commands');
ctx.addCommand(ctxDefineCommand);
ctx.addCommand(ctxListCommand);
ctx.addCommand(ctxGetCommand);
ctx.addCommand(ctxSearchCommand);
program.addCommand(ctx);

const txn = new Command('txn').description('Transaction commands');
txn.addCommand(txnListCommand);
txn.addCommand(txnAddCommand);
program.addCommand(txn);

program.addCommand(changesCommand);

const connect = new Command('connect').description('Data connector commands');
connect.addCommand(connectAddCommand);
connect.addCommand(connectListCommand);
connect.addCommand(connectSyncCommand);
program.addCommand(connect);

program.parse();
