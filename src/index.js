import fsp from 'node:fs/promises';
import path from 'node:path';
import axios from 'axios';
import axiosDebugLog from 'axios-debug-log';
import debug from 'debug';
import * as cheerio from 'cheerio';
import { transformHostname, transformPathname, getTargetAttribute } from './utils.js';

const log = debug('page-loader');

axiosDebugLog(axios);

const downloadPage = (url, outputPath = process.cwd()) => {
  const { hostname: inputUrlHostname, origin: inputUrlOrigin } = new URL(url);
  const [, urlWithoutProtocol] = url.split('//');

  const outputPageName = `${transformHostname(urlWithoutProtocol)}.html`;
  const outputResourcesDirName = `${transformHostname(urlWithoutProtocol)}_files`;

  const absoluteOutputDirPath = path.resolve(process.cwd(), outputPath);
  const absoluteOutputFilepath = path.join(absoluteOutputDirPath, outputPageName);
  const outputResourcesDirPath = path.join(absoluteOutputDirPath, outputResourcesDirName);

  const resourcePromises = [];
  const resourceFilepaths = [];

  const processResource = (cheerioMainFn, resource) => {
    const targetAttribute = getTargetAttribute(resource);

    cheerioMainFn(resource).each((_, element) => {
      const resourceLink = cheerioMainFn(element).attr(targetAttribute);
      const {
        hostname: rscHostname,
        pathname: rscPathname,
        search: rscSearch,
        href: rscHref,
      } = new URL(resourceLink, inputUrlOrigin);

      if (resourceLink && (url.includes(rscHostname) || resourceLink.includes(inputUrlHostname))) {
        const transformedRscHostname = transformHostname(rscHostname);
        const transformedRscPathname = transformPathname(`${rscPathname}${rscSearch}`);
        const transformedRscLink = `${transformedRscHostname}${transformedRscPathname}`;

        const resourceLocalLink = path.join(outputResourcesDirName, transformedRscLink);
        const absoluteOutputRscFilepath = path.join(outputResourcesDirPath, transformedRscLink);

        resourcePromises.push(axios.get(rscHref, { responseType: 'arraybuffer' }));
        resourceFilepaths.push(absoluteOutputRscFilepath);

        cheerioMainFn(element).attr(targetAttribute, resourceLocalLink);
      }
    });
  };
  log('Starting...');
  log('Output directory is being created');
  return fsp.mkdir(absoluteOutputDirPath, { recursive: true })
    .then(() => {
      log('Resources directory is being created');
      return fsp.mkdir(outputResourcesDirPath);
    })
    .then(() => {
      log(`GET ${url}`);
      return axios.get(url);
    })
    .then(({ data }) => {
      log('Html has been received');
      const $ = cheerio.load(data);
      processResource($, 'img');
      processResource($, 'link');
      processResource($, 'script');
      log('Resources have been processed and html has been changed');
      return $.html();
    })
    .then((changedHtml) => {
      log('Html is being written');
      return fsp.writeFile(absoluteOutputFilepath, changedHtml);
    })
    .then(() => {
      log('Waiting for resources dowloading');
      return Promise.all(resourcePromises);
    })
    .then((resources) => {
      const resourcesAndFilepaths = [];
      let index = 0;

      resources.forEach((resource) => {
        resourcesAndFilepaths.push([resourceFilepaths[index], resource]);
        index += 1;
      });

      log('fsp.writeFile resources performance');
      return resourcesAndFilepaths.map(([filepath, { data }]) => fsp.writeFile(filepath, data));
    })
    .then((resourcePromisesToWrite) => {
      log('Waiting for resources writing');
      return Promise.all(resourcePromisesToWrite);
    })
    .then(() => {
      log('Success');
      return absoluteOutputFilepath;
    });
};

export default downloadPage;
