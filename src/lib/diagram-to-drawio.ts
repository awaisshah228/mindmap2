/**
 * Convert React Flow diagram to Draw.io XML.
 * Creates a minimal Draw.io mxGraph XML with the diagram rendered as an embedded image.
 */

/**
 * Generate Draw.io XML with the diagram as an embedded PNG image.
 * @param dataUrl - PNG data URL (from html-to-image toPng)
 * @param width - Image width in pixels
 * @param height - Image height in pixels
 */
export function diagramToDrawioXml(dataUrl: string, width: number, height: number): string {
  const id = () => `id-${Math.random().toString(36).slice(2, 9)}`;
  const img = id();
  // Draw.io expects image as data URL in style; escape for XML
  const imgData = dataUrl.replace(/"/g, "&quot;");
  return `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net">
  <diagram name="Diagram" id="${id()}">
    <mxGraphModel dx="1434" dy="780" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="827" pageHeight="1169" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
        <mxCell id="${img}" value="" style="shape=image;verticalLabelPosition=bottom;verticalAlign=top;aspect=fixed;imageAspect=0;image=${imgData};" vertex="1" parent="1">
          <mxGeometry x="40" y="40" width="${width}" height="${height}" as="geometry" />
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;
}
