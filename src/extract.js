export function extractTrackingFromPage() {
    const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim();
    const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();

    const candidates = [...document.querySelectorAll('.text-pxtx')];
    const root = candidates.find((e) => /Estatus|Status/.test(e.textContent || '')) || candidates[0];
    if (!root || !/Rastrea tu envío|Track your shipment/i.test(root.innerText || '')) return null;

    const field = (labels) => {
        const lab = [...root.querySelectorAll('span, p')].find(
            (e) => labels.includes(txt(e)) && /text-pxblue/.test(e.className || ''),
        );
        if (!lab) return '';
        const box = lab.parentElement;
        const values = [...box.querySelectorAll('span')]
            .map(txt)
            .filter((t) => t && !labels.includes(t));
        return values.join(' ');
    };

    const place = (labels) => {
        const lab = [...root.querySelectorAll('span')].find((e) => labels.includes(txt(e)) && /text-pxblue/.test(e.className || ''));
        if (!lab) return null;
        const box = lab.closest('div');
        const code = txt(box.querySelector('span > span.font-medium'));
        const lines = [...box.querySelectorAll('span.block.text-gray-500')].map(txt);
        return { code, cityState: lines[0] || '', country: lines[1] || '' };
    };

    const statusHeader = [...root.querySelectorAll('p')].find((e) => ['Estatus', 'Status'].includes(txt(e)));
    let status = '';
    let statusStep = 0;
    const steps = [];
    if (statusHeader) {
        const stepper = statusHeader.nextElementSibling;
        if (stepper) {
            for (const child of stepper.children) {
                const label = clean(child.innerText);
                if (!label) continue;
                const active = /Active/.test(child.className || '');
                steps.push({ label, active });
            }
        }
    }
    if (steps.length) {
        // The first step ("Mercancía documentada") carries no Active marker in the
        // markup but is always reached once a guide exists.
        steps[0].active = true;
        const activeSteps = steps.filter((s) => s.active);
        statusStep = activeSteps.length;
        status = activeSteps.length ? activeSteps[activeSteps.length - 1].label : steps[0].label;
    }

    const movements = [...root.querySelectorAll('ul li')]
        .filter((li) => li.querySelector('.TrackingHistoryItem'))
        .map((li) => {
            const spans = [...li.querySelectorAll('div.ml-6 span')].map(txt).filter(Boolean);
            return {
                time: (spans[0] || '').replace(/\s*Horas$/i, '').trim(),
                date: spans[1] || '',
                description: spans[2] || '',
                location: spans[3] || '',
            };
        })
        .filter((m) => m.description);

    const signature = (() => {
        const lab = [...root.querySelectorAll('p, span')].find((e) => ['Firma electrónica', 'Electronic signature'].includes(txt(e)));
        if (!lab) return null;
        const img = lab.parentElement.querySelector('img');
        const src = (img?.getAttribute('src') || '').replace(/\s+/g, '');
        if (!src.startsWith('data:')) return null;
        const m = src.match(/^data:([a-z0-9/+\-]+);base64,(.+)$/i);
        if (!m) return { dataUri: src };
        return { dataUri: src, mimeType: m[1], bytes: Math.floor(m[2].length * 3 / 4) };
    })();

    const etaMatch = (root.innerText || '').match(/Fecha estimada de entrega:\s*([^\n]+)/i);

    return {
        trackingNumber: field(['Rastreo', 'Tracking']),
        guide: field(['Guía', 'Guide']),
        reference: field(['Referencia', 'Reference']),
        shippingDate: field(['Fecha de envío', 'Shipment date']),
        deliveryService: field(['Servicio de entrega', 'Delivery service']),
        destinationBranch: field(['Sucursal de destino', 'Destination Office']),
        origin: place(['Origen', 'Origin']),
        destination: place(['Destino', 'Destination']),
        status,
        statusStep,
        steps: steps.map((s) => s.label),
        estimatedDeliveryDate: etaMatch ? etaMatch[1].trim() : '',
        electronicSignature: signature,
        movements,
    };
}
