import { Command } from 'commander';
import { resetDB } from '../db/connection.js';

export const nuke = new Command('nuke')
  .description('Clear the database (reset state)')
  .option('-f, --force', 'Skip confirmation')
  .action((options: { force?: boolean }) => {
    if (!options.force) {
      console.log('⚠️  This will clear all data. Pass --force to confirm.');
      return;
    }
    resetDB();
    console.log('💥 Database nuked (in-memory state reset).');
  });

