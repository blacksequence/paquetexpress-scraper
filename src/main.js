import { Actor, log } from 'apify';
import { PlaywrightCrawler } from 'crawlee';

import { extractTrackingFromPage } from './extract.js';
import { formatTrackingMarkdown } from './format.js';

const TRACKING_URL = (n) => `https://www.paquetexpress.com.mx/rastreo/${encodeURIComponent(n)}`;

await Actor.init();

const input = (await Actor.getInput()) ?? {};
const cliNumbers = process.argv.slice(2).flatMap((a) => a.split(',')).map((s) => s.trim()).filter(Boolean);
const trackingNumbers = (Array.isArray(input.trackingNumbers) && input.trackingNumbers.length
    ? input.trackingNumbers
    : cliNumbers.length
        ? cliNumbers
        : (process.env.TRACKING_NUMBERS || '').split(',').map((s) => s.trim()).filter(Boolean));

if (!trackingNumbers.length) {
    throw new Error('No tracking numbers provided. Pass input.trackingNumbers, CLI args, or TRACKING_NUMBERS env.');
}

const proxyConfiguration = input.proxyConfiguration
    ? await Actor.createProxyConfiguration(input.proxyConfiguration)
    : undefined;

const markdownOutput = input.markdownOutput ?? true;

log.info(`Scraping ${trackingNumbers.length} tracking number(s)`, { trackingNumbers });

const results = [];

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const crawler = new PlaywrightCrawler({
    proxyConfiguration,
    headless: true,
    browserPoolOptions: { useFingerprints: false },
    launchContext: {
        launchOptions: { args: ['--lang=es-MX', '--disable-blink-features=AutomationControlled'] },
        userAgent: UA,
    },
    maxRequestsPerCrawl: trackingNumbers.length,
    navigationTimeoutSecs: 120,
    requestHandlerTimeoutSecs: 180,
    async requestHandler({ request, page }) {
        const trackingNumber = request.userData.trackingNumber;
        log.info(`Tracking ${trackingNumber}`);

        let data = null;
        try {
            const deadline = Date.now() + 120_000;
            let ready = false;
            while (!ready && Date.now() < deadline) {
                ready = await page.evaluate((num) => {
                    const r = [...document.querySelectorAll('.text-pxtx')].find((e) => /Estatus|Status/.test(e.textContent || ''));
                    if (!r || (r.textContent || '').length <= 400) return false;
                    return (r.textContent || '').replace(/\u200c/g, '').includes(num);
                }, trackingNumber).catch(() => false);
                if (!ready) await new Promise((r) => setTimeout(r, 1000));
            }
            if (!ready) throw new Error('tracking detail never rendered within 120s');
            data = await page.evaluate(extractTrackingFromPage);
        } catch (err) {
            log.warning(`Extraction failed for ${trackingNumber}: ${err.message}`);
            try {
                const debug = await page.evaluate(() => ({
                    title: document.title,
                    hasRoot: !!document.querySelector('.text-pxtx'),
                    bodyLen: (document.body?.innerText || '').length,
                    bodySample: (document.body?.innerText || '').slice(0, 300),
                }));
                log.warning('Debug page state', debug);
            } catch { /* page may be gone */ }
        }

        if (!data || !data.guide) {
            log.warning(`Extract detail: ${JSON.stringify({ hasData: !!data, keys: data ? Object.keys(data) : null, guide: data?.guide ?? null })}`);
            const item = {
                trackingNumber,
                guide: null,
                status: null,
                movements: [],
                error: 'not_found',
                sourceUrl: request.url,
                scrapedAt: new Date().toISOString(),
            };
            results.push(item);
            await Actor.pushData(item);
            log.warning(`No tracking data found for ${trackingNumber}`);
            return;
        }

        const item = { ...data, sourceUrl: request.url, scrapedAt: new Date().toISOString() };
        results.push(item);
        await Actor.pushData(item);
        log.info(`OK ${trackingNumber}: status="${item.status}", movements=${item.movements.length}`);
    },
    failedRequestHandler({ request, log: reqLog }, error) {
        reqLog.error(`Request failed for ${request.userData.trackingNumber}: ${error.message}`);
        const item = {
            trackingNumber: request.userData.trackingNumber,
            guide: null,
            status: null,
            movements: [],
            error: 'request_failed',
            sourceUrl: request.url,
            scrapedAt: new Date().toISOString(),
        };
        results.push(item);
        return Actor.pushData(item);
    },
});

await crawler.run(trackingNumbers.map((n) => ({ url: TRACKING_URL(n), userData: { trackingNumber: n } })));

if (markdownOutput) {
    for (const item of results) item.markdown = formatTrackingMarkdown(item);
}

console.log(JSON.stringify(results, null, 2));
if (markdownOutput) {
    console.log('\n' + results.map((item) => item.markdown).join('\n\n---\n\n'));
}

await Actor.exit();
