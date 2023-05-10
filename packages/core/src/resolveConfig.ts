import { join } from 'path'
import { createDefu, defu } from 'defu'
import { pick } from 'lodash-es'
import { pathExists } from 'fs-extra'
import { Launcher } from 'chrome-launcher'
import puppeteer, { BrowserFetcher } from 'puppeteer-core'
import type { ResolvedUserConfig, UnlighthouseTabs, UserConfig } from './types'
import { defaultConfig } from './constants'
import { normaliseHost, withSlashes } from './util'
import { useLogger } from './logger'
import { homedir } from 'node:os'

/**
 * A provided configuration from the user may require runtime transformations to avoid breaking app functionality.
 *
 * Mostly normalisation of data and provided sane runtime defaults when configuration hasn't been fully provided, also
 * includes configuration alias helpers though such as `scanner.throttle`.
 *
 * @param userConfig
 */
export const resolveUserConfig: (userConfig: UserConfig) => Promise<ResolvedUserConfig> = async (userConfig) => {
  const logger = useLogger()
  // create our own config resolution
  const merger = createDefu((obj, key, value) => {
    // avoid joining arrays, instead replace them
    if ((key === 'supportedExtensions' || key === 'onlyCategories') && value) {
      obj[key] = value
      return true
    }
  })
  const config = merger(userConfig, defaultConfig)

  // it's possible we don't know the site at runtime
  if (config.site) {
    // normalise site
    config.site = normaliseHost(config.site)
  }
  if (config.lighthouseOptions) {
    if (config.lighthouseOptions.onlyCategories?.length) {
      // restrict categories values and copy order of columns from the default config
      // @ts-expect-error 'defaultConfig.lighthouseOptions' is always set in default config
      config.lighthouseOptions.onlyCategories = defaultConfig.lighthouseOptions.onlyCategories
        .filter(column => config.lighthouseOptions.onlyCategories.includes(column))
    }
  }
  else {
    config.lighthouseOptions = {}
  }
  // for local urls we disable throttling
  if (!config.site || config.site.includes('localhost') || !config.scanner?.throttle) {
    config.lighthouseOptions.throttlingMethod = 'provided'
    config.lighthouseOptions.throttling = {
      rttMs: 0,
      throughputKbps: 0,
      cpuSlowdownMultiplier: 1,
      requestLatencyMs: 0, // 0 means unset
      downloadThroughputKbps: 0,
      uploadThroughputKbps: 0,
    }
  }

  if (config.auth) {
    config.lighthouseOptions.extraHeaders = config.lighthouseOptions.extraHeaders || {}
    if (!config.lighthouseOptions.extraHeaders.Authorization) {
      const credentials = `${config.auth.username}:${config.auth.password}`
      config.lighthouseOptions.extraHeaders.Authorization = `Basic ${Buffer.from(credentials).toString('base64')}`
    }
  }

  if (config.client?.columns) {
    // filter out any columns for categories we're not showing
    config.client.columns = pick(config.client.columns, ['overview', ...config.lighthouseOptions.onlyCategories as UnlighthouseTabs[]])
  }

  // the default pages dir is `${root}/pages`, check if it exists, if not revert to root
  if (config.root && config.discovery && config.discovery.pagesDir === 'pages') {
    const pagesDirExist = await pathExists(join(config.root, config.discovery.pagesDir))
    if (!pagesDirExist) {
      logger.debug('Unable to locale page files, disabling route discovery.')
      // disable discovery to avoid globbing entire file systems
      config.discovery = false
    }
  }

  // alias to set the device
  if (!config.lighthouseOptions.formFactor) {
    if (config.scanner?.device === 'mobile') {
      config.lighthouseOptions.formFactor = 'mobile'
      config.lighthouseOptions.screenEmulation = defu({
        mobile: true,
        width: 360,
        height: 640,
        deviceScaleFactor: 2,
      }, config.lighthouseOptions.screenEmulation || {})
    }
    else if (config.scanner?.device === 'desktop') {
      config.lighthouseOptions.formFactor = 'desktop'
      config.lighthouseOptions.screenEmulation = defu({
        mobile: false,
        width: 1024,
        height: 750,
      }, config.lighthouseOptions.screenEmulation || {})
    }
  }

  if (config.routerPrefix)
    config.routerPrefix = withSlashes(config.routerPrefix)

  // if user is using the default chrome binary options
  if (!config.puppeteerOptions?.executablePath && !config.puppeteerClusterOptions?.puppeteer) {
    // set default to puppeteer core
    config.puppeteerClusterOptions = defu({ puppeteer }, config.puppeteerClusterOptions || {})
    // point to our pre-installed chrome version
    config.puppeteerOptions = defu({
      // set viewport
      defaultViewport: {
        width: config.lighthouseOptions?.screenEmulation?.width || 0,
        height: config.lighthouseOptions?.screenEmulation?.height || 0,
      },
    }, config.puppeteerOptions || {})
    if (!config.puppeteerOptions.executablePath) {
      // we'll try and resolve their local chrome
      const chromePath = false && Launcher.getFirstInstallation()
      if (chromePath) {
        logger.debug(`Found chrome at \`${chromePath}\`.`)
        config.puppeteerOptions.executablePath = chromePath
      } else {
        const path = join(homedir(), '.unlighthouse')
        const fetcher = new BrowserFetcher({
          path,
          product: 'chrome',
        })
        let lastPercent = 0
        if (fetcher.localRevisions()?.[0]) {
          config.puppeteerOptions.executablePath = fetcher.revisionInfo(fetcher.localRevisions()[0]).executablePath
          logger.debug(`Found chrome at \`${config.puppeteerOptions.executablePath}\`.`)
        } else {
          logger.warn(`Failed to find chrome, downloading version v${1095492} to: ${path}`)
          const chromium = await fetcher.download('1095492', (downloadedBytes, toDownloadBytes) => {
            const percent = Math.round(downloadedBytes / toDownloadBytes * 100)
            if (percent % 5 === 0 && lastPercent !== percent) {
              logger.info(`Downloading chromium: ${percent}%`)
              lastPercent = percent
            }
          })

          if (!chromium) {
            throw new Error('Failed to download chromium. Please ensure you have a valid chrome installed.')
          }
          config.puppeteerOptions.executablePath = chromium.executablePath
        }
      }
    }
  }

  return config as ResolvedUserConfig
}
