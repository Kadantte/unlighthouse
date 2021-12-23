import { createHash } from 'crypto'
import { join } from 'path'
import { ensureDirSync } from 'fs-extra'
import sanitize from 'sanitize-filename'
import slugify from 'slugify'
import { hasProtocol, withoutLeadingSlash, withoutTrailingSlash } from 'ufo'
import type { NormalisedRoute, UnlighthouseRouteReport } from './types'
import { useUnlighthouse } from './unlighthouse'

/**
 * Removes leading and trailing slashes from a string.
 *
 * @param s
 */
export const trimSlashes = (s: string) => withoutLeadingSlash(withoutTrailingSlash(s))

/**
 * Sanitises the provided URL for use as a file system path.
 *
 * @param url
 * @return A sanitized URL, will retain the path hierarchy in the folder structure.
 */
export const sanitiseUrlForFilePath = (url: string) => {
    return trimSlashes(url)
        .split('/')
        .map(part => sanitize(slugify(part)))
        .join('/')
}

/**
 * Turns a web path to a 6-char hash which can be used for easy identification.
 *
 * @param path
 */
export const hashPathName = (path: string) => {
    return createHash('md5')
        .update(sanitiseUrlForFilePath(path))
        .digest('hex')
        .substring(0, 6)
}

/**
 * Ensures a provided host is consistent, ensuring a protocol is provided.
 *
 * @param host
 */
export const normaliseHost = (host: string) => {
    host = withoutTrailingSlash(host)
    if (!hasProtocol(host))
        host = `http${host.startsWith('localhost') ? '' : 's'}://${host}`
    return host
}

/**
 * A task report is a wrapper for the route, the report file paths and task status.
 *
 * @param route
 */
export const createTaskReportFromRoute
    = (route: NormalisedRoute): UnlighthouseRouteReport => {
    const { runtimeSettings } = useUnlighthouse()

    const reportId = hashPathName(route.path)

    const reportPath = join(runtimeSettings.outputPath, 'routes', sanitiseUrlForFilePath(route.path))

    // add missing dirs
    ensureDirSync(reportPath)

    return {
        // @ts-ignore
        tasks: {},
        route,
        reportId,
        htmlPayload: join(reportPath, 'payload.html'),
        reportHtml: join(reportPath, 'lighthouse.html'),
        reportJson: join(reportPath, 'lighthouse.json'),
    }
}

export const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes'

    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}