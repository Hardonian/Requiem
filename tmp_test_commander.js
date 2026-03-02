import { Command } from 'commander';

const entitlement = new Command('entitlement');
entitlement.command('show').action(() => console.log('SHOWING'));

try {
  console.log('Testing with entitlement in args:');
  entitlement.parse(['node', 'script.js', 'entitlement', 'show']);
} catch (e) {
  console.log('Caught:', e.message);
}

const ent2 = new Command('entitlement');
ent2.command('show').action(() => console.log('SHOWING (no name in args)'));

try {
  console.log('Testing without entitlement in args:');
  ent2.parse(['node', 'script.js', 'show']);
} catch (e) {
  console.log('Caught:', e.message);
}
