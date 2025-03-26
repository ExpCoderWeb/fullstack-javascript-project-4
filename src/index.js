import fsp from 'node:fs/promises';
import path from 'node:path';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { transformHostname, transformPathname, getTargetAttribute } from './utils.js';

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

  return fsp.mkdir(absoluteOutputDirPath, { recursive: true })
    .then(() => fsp.mkdir(outputResourcesDirPath))
    .then(() => axios.get(url))
    .then(({ data }) => {
      const $ = cheerio.load(data);
      processResource($, 'img');
      processResource($, 'link');
      processResource($, 'script');

      return $.html();
    })
    .then((changedHtml) => fsp.writeFile(absoluteOutputFilepath, changedHtml))
    .then(() => Promise.all(resourcePromises))
    .then((resources) => {
      const resourcesAndFilepaths = [];
      let index = 0;

      resources.forEach((resource) => {
        resourcesAndFilepaths.push([resourceFilepaths[index], resource]);
        index += 1;
      });

      return resourcesAndFilepaths.map(([filepath, { data }]) => fsp.writeFile(filepath, data));
    })
    .then((resourcePromisesToWrite) => Promise.all(resourcePromisesToWrite))
    .then(() => absoluteOutputFilepath);
};

export default downloadPage;
