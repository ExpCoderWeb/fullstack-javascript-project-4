#!/usr/bin/env node

import { program } from 'commander';
import { AxiosError } from 'axios';
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
    downloadPage(url, outputPath)
      .then((absoluteOutputFilepath) => {
        console.log(`Page was successfully downloaded into '${absoluteOutputFilepath}'`);
        process.exit(0);
      })
      .catch((error) => {
        if (error.name === 'Error') {
          console.error(error.message);
        } else if (error instanceof AxiosError) {
          if (error.response && error.response.status !== 200) {
            console.error(`The request was made and the server responded with a status code not equal to 200 - ${error.response.status}`);
          } else if (error.request) {
            console.error('The request was made but no response was received');
          } else {
            console.error('Something happened in setting up the request that triggered an error');
          }
        } else {
          console.error(`Unknown error - ${error}`);
        }

        process.exit(1);
      });
  });

program.parse();
