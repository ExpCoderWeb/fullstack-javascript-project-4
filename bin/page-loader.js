#!/usr/bin/env node

import { program } from 'commander';
import downloadPage from '../src/index.js';

program
  .name('page-loader')
  .description('Page loader utility')
  .version('1.0.0')
  .argument('<url>')
  .option('-o, --output [dir]', 'output dir', process.cwd())
  .helpOption('-h, --help', 'display help for command')
  .action((url) => {
    const outputPath = program.opts().output;
    downloadPage(url, outputPath).then((absoluteOutputFilepath) => console.log(`Page was successfully downloaded into '${absoluteOutputFilepath}'`));
  });

program.parse();
