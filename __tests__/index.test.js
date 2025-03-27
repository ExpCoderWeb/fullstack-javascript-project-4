import { fileURLToPath } from 'node:url';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import nock from 'nock';
import debug from 'debug';
import htmlBeautify from 'html-beautify';
import * as cheerio from 'cheerio';
import downloadPage from '../src/index.js';
import { transformHostname, transformPathname, getTargetAttribute } from '../src/utils.js';

nock.disableNetConnect();

const log = debug('page-loader:nock');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getFixturePath = (name) => path.join(__dirname, '..', '__fixtures__', name);

const getUrlComponents = (url) => new URL(url);

const getUrlWithoutProtocol = (url) => {
  const [, urlWithoutProtocol] = url.split('//');
  return urlWithoutProtocol;
};

const getOutputPageName = (urlWithoutProtocol) => `${transformHostname(urlWithoutProtocol)}.html`;
const getOutputResourcesDirName = (urlWithoutProtocol) => `${transformHostname(urlWithoutProtocol)}_files`;

const processRscLocalLinks = (cheerioFn, url, rscDirName) => (rsc, linkComponents, localLinks) => {
  const { hostname: inputUrlHostname, origin: inputUrlOrigin } = new URL(url);
  const targetAttribute = getTargetAttribute(rsc);

  cheerioFn(rsc).each((_, element) => {
    const resourceLink = cheerioFn(element).attr(targetAttribute);
    const {
      hostname: rscHostname,
      pathname: rscPathname,
      search: rscSearch,
      href: rscHref,
    } = new URL(resourceLink, inputUrlOrigin);

    if (resourceLink && (url.includes(rscHostname) || resourceLink.includes(inputUrlHostname))) {
      const {
        origin: nockOrigin,
        pathname: nockPathname,
        search: nockSearch,
      } = new URL(rscHref);

      linkComponents.push([nockOrigin, nockPathname, nockSearch]);

      const transformedRscHostname = transformHostname(rscHostname);
      const transformedRscPathname = transformPathname(`${rscPathname}${rscSearch}`);
      const transformedRscLink = `${transformedRscHostname}${transformedRscPathname}`;

      const resourceLocalLink = path.join(rscDirName, transformedRscLink);

      localLinks.push(resourceLocalLink);
    }
  });
};

const nockLocalResources = (nockResourceLinkComponents, nockContent) => {
  nockResourceLinkComponents.forEach(([nockOrigin, nockPathname, nockSearch]) => {
    nock(nockOrigin)
      .get(`${nockPathname}${nockSearch}`)
      .reply(200, nockContent);
  });
};

describe('downloadPage', () => {
  const inputUrl = 'https://ru.hexlet.io/courses';
  const {
    origin: inputOrigin,
    pathname: inputPathname,
    search: inputSearch,
  } = getUrlComponents(inputUrl);
  const inputUrlUrlWithoutProtocol = getUrlWithoutProtocol(inputUrl);

  const expectedOutputPageName = getOutputPageName(inputUrlUrlWithoutProtocol);
  const expectedOutputResourcesDirName = getOutputResourcesDirName(inputUrlUrlWithoutProtocol);

  let initialContent;
  let expectedHtml;
  let expectedImg;
  let expectedLink;
  let expectedScript;

  let absoluteOutputDirPath;
  let absoluteOutputFilepath;
  let actualAbsoluteOutputFilepath;

  let imgLinkComponents;
  let linkLinkComponents;
  let scriptLinkComponents;

  let imgLocalLinks;
  let linkLocalLinks;
  let scriptLocalLinks;

  beforeAll(async () => {
    initialContent = await fsp.readFile(getFixturePath('initialHTML.txt'), 'utf-8');
    expectedHtml = await fsp.readFile(getFixturePath('expectedHTML.txt'), 'utf-8');
    expectedImg = await fsp.readFile(getFixturePath('expectedImg.png'), 'utf-8');
    expectedLink = await fsp.readFile(getFixturePath('expectedLink.css'), 'utf-8');
    expectedScript = await fsp.readFile(getFixturePath('expectedScript.js'), 'utf-8');
    log('Fixtures have been read');
  });

  beforeEach(async () => {
    imgLinkComponents = [];
    linkLinkComponents = [];
    scriptLinkComponents = [];

    imgLocalLinks = [];
    linkLocalLinks = [];
    scriptLocalLinks = [];

    const $ = cheerio.load(initialContent);
    const processInputUrl = processRscLocalLinks($, inputUrl, expectedOutputResourcesDirName);
    processInputUrl('img', imgLinkComponents, imgLocalLinks);
    processInputUrl('link', linkLinkComponents, linkLocalLinks);
    processInputUrl('script', scriptLinkComponents, scriptLocalLinks);
    log('Local resources of input url have been processed');
    nockLocalResources(imgLinkComponents, expectedImg);
    nockLocalResources(linkLinkComponents, expectedLink);
    nockLocalResources(scriptLinkComponents, expectedScript);
    log('Local resources have been nocked');
    nock(inputOrigin)
      .get(`${inputPathname}${inputSearch}`)
      .reply(200, initialContent);

    absoluteOutputDirPath = await fsp.mkdtemp(path.join(os.tmpdir(), 'page-loader-'));
    actualAbsoluteOutputFilepath = await downloadPage(inputUrl, absoluteOutputDirPath);
    log('Page has been downloaded');
    absoluteOutputFilepath = path.join(absoluteOutputDirPath, expectedOutputPageName);
  });

  it('should match the expected absolute filepath', async () => {
    expect(actualAbsoluteOutputFilepath).toBe(absoluteOutputFilepath);
  });

  it('should contain the expected output resources directory', async () => {
    const absoluteTestDirPathContent = await fsp.readdir(absoluteOutputDirPath);
    expect(absoluteTestDirPathContent).toContain(expectedOutputResourcesDirName);
  });

  it('should match the expected HTML', async () => {
    const actualHtml = await fsp.readFile(absoluteOutputFilepath, 'utf-8');
    const formattedExpectedHTML = htmlBeautify(expectedHtml);
    const formattedActualHTML = htmlBeautify(actualHtml);
    expect(formattedActualHTML).toBe(formattedExpectedHTML);
  });

  it('should be the expected resources', async () => {
    const actualImg = await fsp.readFile(path.join(absoluteOutputDirPath, imgLocalLinks[0]), 'utf-8');
    expect(actualImg).toBe(expectedImg);
    const actualLink = await fsp.readFile(path.join(absoluteOutputDirPath, linkLocalLinks[0]), 'utf-8');
    expect(actualLink).toBe(expectedLink);
    const actualScript = await fsp.readFile(path.join(absoluteOutputDirPath, scriptLocalLinks[0]), 'utf-8');
    expect(actualScript).toBe(expectedScript);
  });
});

describe('getTargetAttribute', () => {
  it('should throw the expected error', () => {
    expect(() => getTargetAttribute('div')).toThrow('Invalid resource - div');
  });
});

describe('transformPathname', () => {
  it('should be equal to the expected pathname', () => {
    expect(transformPathname('/assets/service.min.css?master-557bb553/')).toBe('-assets-service-min-css-master-557bb553.css');
  });
});
