import { Command } from 'commander';
import { readConfig, setConfigValue, getConfigValue } from '../global-config';

export const config = new Command('config')
  .description('Manage global configuration')
  .action(() => {
    config.help();
  });

config.command('list')
  .description('List all configuration values')
  .action(() => {
    const c = readConfig();
    console.log(JSON.stringify(c, null, 2));
  });

config.command('get')
  .argument('<key>', 'Configuration key')
  .description('Get a configuration value')
  .action((key) => {
    const val = getConfigValue(key);
    console.log(val);
  });

config.command('set')
  .argument('<key>', 'Configuration key')
  .argument('<value>', 'Configuration value')
  .description('Set a configuration value')
  .action((key, value) => {
    setConfigValue(key, value);
    console.log(`Set ${key} = ${value}`);
  });
