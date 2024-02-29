// pull out client accessible options
import { startCase } from 'lodash-es'
import { $URL } from 'ufo'
import CellNetworkRequests from '../components/Cell/CellNetworkRequests.vue'
import CellImageIssues from '../components/Cell/CellImageIssues.vue'
import CellColorContrast from '../components/Cell/CellColorContrast.vue'
import CellMetaDescription from '../components/Cell/CellMetaDescription.vue'
import CellIndexable from '../components/Cell/CellIndexable.vue'
import CellScreenshotThumbnails from '../components/Cell/CellScreenshotThumbnails.vue'
import CellImage from '../components/Cell/CellImage.vue'
import CellTapTargets from '../components/Cell/CellTapTargets.vue'
import CellWebVitals from '../components/Cell/CellWebVitals.vue'
import CellLargestContentfulPaint from '../components/Cell/CellLargestContentfulPaint.vue'
import CellLayoutShift from '../components/Cell/CellLayoutShift.vue'

const {
  options: {
    site,
    client: {
      columns: configColumns,
      groupRoutesKey,
    },
    websocketUrl: wsUrl,
    apiUrl,
    lighthouseOptions,
    scanner: {
      dynamicSampling,
      throttle,
      device,
    },
    routerPrefix: basePath,
  },
} = window.__unlighthouse_payload

export const isStatic = window.__unlighthouse_static

export { wsUrl, basePath, dynamicSampling, apiUrl, groupRoutesKey, lighthouseOptions, throttle, device }

export const website = new $URL(site).origin

export const categories = (lighthouseOptions?.onlyCategories || ['performance', 'accessibility', 'best-practices', 'seo'])
export const tabs = [
  'Overview',
  ...categories.map((c) => {
    if (c === 'seo')
      return 'SEO'

    if (c === 'pwa')
      return 'PWA'

    return startCase(c)
  }),
]

// map the column components
export const columns = Object.values(configColumns)
  .map((columns) => {
    return columns.map((column) => {
      switch (column.key) {
        case 'report.audits.largest-contentful-paint':
          column.component = CellLargestContentfulPaint
          break
        case 'report.audits.cumulative-layout-shift':
          column.component = CellLayoutShift
          break
        case 'report.audits.network-requests':
          column.component = CellNetworkRequests
          break
        case 'report.audits.diagnostics':
          column.component = CellImageIssues
          break
        case 'report.audits.color-contrast':
          column.component = CellColorContrast
          break
        case 'seo.description':
          column.component = CellMetaDescription
          break
        case 'report.audits.is-crawlable':
          column.component = CellIndexable
          break
        case 'report.audits.screenshot-thumbnails':
          column.component = CellScreenshotThumbnails
          break
        case 'seo.og.image':
          column.component = CellImage
          break
        case 'report.audits.tap-targets':
          column.component = CellTapTargets
          break
      }
      switch (column.label) {
        case 'Core Web Vitals':
          column.component = CellWebVitals
          break
      }
      return column
    })
  })
