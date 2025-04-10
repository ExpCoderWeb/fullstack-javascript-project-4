#!/usr/bin/env node

import { program } from 'commander';
import downloadPage from '../src/index.js';
import { handleError } from '../src/utils.js';

program
  .name('page-loader')
  .description('Page loader utility')
  .version('1.0.0')
  .argument('<url>')
  .option('-o, --output [dir]', 'output dir', process.cwd())
  .helpOption('-h, --help', 'display help for command')
  .action((url) => {
    const outputPath = program.opts().output;
    downloadPage(url, outputPath)
      .then((absolutePagePath) => {
        console.log(`Page was successfully downloaded into '${absolutePagePath}'`);
        process.exit(0);
      })
      .catch((error) => {
        handleError(error);
        process.exit(1);
      });
  });

program.parse();
