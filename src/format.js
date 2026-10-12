export function formatTrackingMarkdown(item) {
    if (item.error) {
        return [
            `## Rastreo ${item.trackingNumber}`,
            '',
            `No se encontró información de rastreo (${item.error}).`,
            '',
            `Fuente: ${item.sourceUrl}`,
        ].join('\n');
    }

    const lines = [
        `## Rastreo ${item.trackingNumber}`,
        '',
        `- **Guía:** ${item.guide}`,
        `- **Referencia:** ${item.reference || '—'}`,
        `- **Estatus:** ${item.status} (paso ${item.statusStep} de ${item.steps.length})`,
        `- **Fecha de envío:** ${item.shippingDate || '—'}`,
        `- **Servicio de entrega:** ${item.deliveryService || '—'}`,
        `- **Sucursal de destino:** ${item.destinationBranch || '—'}`,
    ];

    if (item.origin) {
        lines.push(`- **Origen:** ${item.origin.code} — ${item.origin.cityState}, ${item.origin.country}`);
    }
    if (item.destination) {
        lines.push(`- **Destino:** ${item.destination.code} — ${item.destination.cityState}, ${item.destination.country}`);
    }
    if (item.estimatedDeliveryDate) {
        lines.push(`- **Entrega estimada:** ${item.estimatedDeliveryDate}`);
    }
    if (item.electronicSignature?.dataUri) {
        const kb = item.electronicSignature.bytes ? ` (${Math.round(item.electronicSignature.bytes / 1024)} KB)` : '';
        lines.push(`- **Firma electrónica:** ${item.electronicSignature.mimeType || 'imagen'}${kb}`);
    }

    if (item.steps.length) {
        lines.push('', '### Progreso', '');
        item.steps.forEach((step, i) => {
            const done = i < item.statusStep;
            lines.push(`- [${done ? 'x' : ' '}] ${step}`);
        });
    }

    if (item.movements.length) {
        lines.push('', '### Notificaciones', '');
        for (const m of item.movements) {
            lines.push(`- **${m.date} ${m.time}** — ${m.description} (${m.location})`);
        }
    }

    if (item.electronicSignature?.dataUri) {
        lines.push('', '### Firma electrónica', '', `![Firma electrónica](${item.electronicSignature.dataUri})`);
    }

    lines.push('', `Fuente: ${item.sourceUrl}`, `Extraído: ${item.scrapedAt}`);
    return lines.join('\n');
}
