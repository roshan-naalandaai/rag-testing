/**
 * SVGPathParser - Converts SVG elements to drawable path commands
 * Supports: path, circle, rect, ellipse, polygon, line, polyline
 */

import * as svgPathParser from 'svg-path-parser';

export interface PathCommand {
  code: string;
  x?: number;
  y?: number;
  x0?: number;
  y0?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  rx?: number;
  ry?: number;
  xAxisRotation?: number;
  largeArc?: number;
  sweep?: number;
}

export interface SVGShape {
  type: 'path' | 'circle' | 'rect' | 'ellipse' | 'polygon' | 'line' | 'polyline';
  commands?: PathCommand[];
  circle?: { cx: number; cy: number; r: number };
  fill: string;
  stroke: string;
  opacity: number;
  strokeWidth: number;
}

/**
 * Parse an SVG string or element into drawable shapes
 */
export function parseSVGToShapes(
  svgInput: string | Element,
  scale: number = 1,
  offsetX: number = 0,
  offsetY: number = 0
): SVGShape[] {
  const shapes: SVGShape[] = [];
  
  let svgElement: Element;
  if (typeof svgInput === 'string') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgInput, 'image/svg+xml');
    svgElement = doc.documentElement;
  } else {
    svgElement = svgInput;
  }

  // Extract all supported elements
  extractPaths(svgElement, shapes, scale, offsetX, offsetY);
  extractCircles(svgElement, shapes, scale, offsetX, offsetY);
  extractRects(svgElement, shapes, scale, offsetX, offsetY);
  extractEllipses(svgElement, shapes, scale, offsetX, offsetY);
  extractPolygons(svgElement, shapes, scale, offsetX, offsetY);
  extractPolylines(svgElement, shapes, scale, offsetX, offsetY);
  extractLines(svgElement, shapes, scale, offsetX, offsetY);

  return shapes;
}

/**
 * Extract path elements
 */
function extractPaths(
  svgElement: Element,
  shapes: SVGShape[],
  scale: number,
  offsetX: number,
  offsetY: number
): void {
  const pathElements = svgElement.querySelectorAll('path');
  pathElements.forEach((path) => {
    const d = path.getAttribute('d');
    if (d) {
      const commands = parseSVGPath(d, scale, offsetX, offsetY);
      shapes.push({
        type: 'path',
        commands,
        fill: path.getAttribute('fill') || '#000000',
        stroke: path.getAttribute('stroke') || 'none',
        opacity: parseFloat(path.getAttribute('opacity') || '1'),
        strokeWidth: parseFloat(path.getAttribute('stroke-width') || '1') * scale,
      });
    }
  });
}

/**
 * Extract circle elements
 */
function extractCircles(
  svgElement: Element,
  shapes: SVGShape[],
  scale: number,
  offsetX: number,
  offsetY: number
): void {
  const circleElements = svgElement.querySelectorAll('circle');
  circleElements.forEach((circle) => {
    const cx = parseFloat(circle.getAttribute('cx') || '0') * scale + offsetX;
    const cy = parseFloat(circle.getAttribute('cy') || '0') * scale + offsetY;
    const r = parseFloat(circle.getAttribute('r') || '0') * scale;

    shapes.push({
      type: 'circle',
      circle: { cx, cy, r },
      fill: circle.getAttribute('fill') || '#000000',
      stroke: circle.getAttribute('stroke') || 'none',
      opacity: parseFloat(circle.getAttribute('opacity') || '1'),
      strokeWidth: parseFloat(circle.getAttribute('stroke-width') || '1') * scale,
    });
  });
}

/**
 * Extract rect elements and convert to path
 */
function extractRects(
  svgElement: Element,
  shapes: SVGShape[],
  scale: number,
  offsetX: number,
  offsetY: number
): void {
  const rectElements = svgElement.querySelectorAll('rect');
  rectElements.forEach((rect) => {
    const x = parseFloat(rect.getAttribute('x') || '0') * scale + offsetX;
    const y = parseFloat(rect.getAttribute('y') || '0') * scale + offsetY;
    const width = parseFloat(rect.getAttribute('width') || '0') * scale;
    const height = parseFloat(rect.getAttribute('height') || '0') * scale;
    const rx = parseFloat(rect.getAttribute('rx') || '0') * scale;
    const ry = parseFloat(rect.getAttribute('ry') || rx.toString()) * scale;

    // Convert rect to path commands
    const commands: PathCommand[] = [];
    if (rx > 0 || ry > 0) {
      // Rounded rectangle
      commands.push({ code: 'M', x: x + rx, y });
      commands.push({ code: 'L', x: x + width - rx, y });
      commands.push({ code: 'A', rx, ry, x: x + width, y: y + ry, xAxisRotation: 0, largeArc: 0, sweep: 1 });
      commands.push({ code: 'L', x: x + width, y: y + height - ry });
      commands.push({ code: 'A', rx, ry, x: x + width - rx, y: y + height, xAxisRotation: 0, largeArc: 0, sweep: 1 });
      commands.push({ code: 'L', x: x + rx, y: y + height });
      commands.push({ code: 'A', rx, ry, x, y: y + height - ry, xAxisRotation: 0, largeArc: 0, sweep: 1 });
      commands.push({ code: 'L', x, y: y + ry });
      commands.push({ code: 'A', rx, ry, x: x + rx, y, xAxisRotation: 0, largeArc: 0, sweep: 1 });
      commands.push({ code: 'Z' });
    } else {
      // Regular rectangle
      commands.push({ code: 'M', x, y });
      commands.push({ code: 'L', x: x + width, y });
      commands.push({ code: 'L', x: x + width, y: y + height });
      commands.push({ code: 'L', x, y: y + height });
      commands.push({ code: 'Z' });
    }

    shapes.push({
      type: 'rect',
      commands,
      fill: rect.getAttribute('fill') || '#000000',
      stroke: rect.getAttribute('stroke') || 'none',
      opacity: parseFloat(rect.getAttribute('opacity') || '1'),
      strokeWidth: parseFloat(rect.getAttribute('stroke-width') || '1') * scale,
    });
  });
}

/**
 * Extract ellipse elements and convert to path
 */
function extractEllipses(
  svgElement: Element,
  shapes: SVGShape[],
  scale: number,
  offsetX: number,
  offsetY: number
): void {
  const ellipseElements = svgElement.querySelectorAll('ellipse');
  ellipseElements.forEach((ellipse) => {
    const cx = parseFloat(ellipse.getAttribute('cx') || '0') * scale + offsetX;
    const cy = parseFloat(ellipse.getAttribute('cy') || '0') * scale + offsetY;
    const rx = parseFloat(ellipse.getAttribute('rx') || '0') * scale;
    const ry = parseFloat(ellipse.getAttribute('ry') || '0') * scale;

    // Convert ellipse to path using arcs
    const commands: PathCommand[] = [
      { code: 'M', x: cx - rx, y: cy },
      { code: 'A', rx, ry, x: cx + rx, y: cy, x0: cx - rx, y0: cy, xAxisRotation: 0, largeArc: 0, sweep: 1 },
      { code: 'A', rx, ry, x: cx - rx, y: cy, x0: cx + rx, y0: cy, xAxisRotation: 0, largeArc: 0, sweep: 1 },
      { code: 'Z' },
    ];

    shapes.push({
      type: 'ellipse',
      commands,
      fill: ellipse.getAttribute('fill') || '#000000',
      stroke: ellipse.getAttribute('stroke') || 'none',
      opacity: parseFloat(ellipse.getAttribute('opacity') || '1'),
      strokeWidth: parseFloat(ellipse.getAttribute('stroke-width') || '1') * scale,
    });
  });
}

/**
 * Extract polygon elements and convert to path
 */
function extractPolygons(
  svgElement: Element,
  shapes: SVGShape[],
  scale: number,
  offsetX: number,
  offsetY: number
): void {
  const polygonElements = svgElement.querySelectorAll('polygon');
  polygonElements.forEach((polygon) => {
    const points = parsePoints(polygon.getAttribute('points') || '', scale, offsetX, offsetY);
    if (points.length > 0) {
      const commands: PathCommand[] = [{ code: 'M', x: points[0].x, y: points[0].y }];
      for (let i = 1; i < points.length; i++) {
        commands.push({ code: 'L', x: points[i].x, y: points[i].y });
      }
      commands.push({ code: 'Z' });

      shapes.push({
        type: 'polygon',
        commands,
        fill: polygon.getAttribute('fill') || '#000000',
        stroke: polygon.getAttribute('stroke') || 'none',
        opacity: parseFloat(polygon.getAttribute('opacity') || '1'),
        strokeWidth: parseFloat(polygon.getAttribute('stroke-width') || '1') * scale,
      });
    }
  });
}

/**
 * Extract polyline elements and convert to path
 */
function extractPolylines(
  svgElement: Element,
  shapes: SVGShape[],
  scale: number,
  offsetX: number,
  offsetY: number
): void {
  const polylineElements = svgElement.querySelectorAll('polyline');
  polylineElements.forEach((polyline) => {
    const points = parsePoints(polyline.getAttribute('points') || '', scale, offsetX, offsetY);
    if (points.length > 0) {
      const commands: PathCommand[] = [{ code: 'M', x: points[0].x, y: points[0].y }];
      for (let i = 1; i < points.length; i++) {
        commands.push({ code: 'L', x: points[i].x, y: points[i].y });
      }

      shapes.push({
        type: 'polyline',
        commands,
        fill: polyline.getAttribute('fill') || 'none',
        stroke: polyline.getAttribute('stroke') || '#000000',
        opacity: parseFloat(polyline.getAttribute('opacity') || '1'),
        strokeWidth: parseFloat(polyline.getAttribute('stroke-width') || '1') * scale,
      });
    }
  });
}

/**
 * Extract line elements and convert to path
 */
function extractLines(
  svgElement: Element,
  shapes: SVGShape[],
  scale: number,
  offsetX: number,
  offsetY: number
): void {
  const lineElements = svgElement.querySelectorAll('line');
  lineElements.forEach((line) => {
    const x1 = parseFloat(line.getAttribute('x1') || '0') * scale + offsetX;
    const y1 = parseFloat(line.getAttribute('y1') || '0') * scale + offsetY;
    const x2 = parseFloat(line.getAttribute('x2') || '0') * scale + offsetX;
    const y2 = parseFloat(line.getAttribute('y2') || '0') * scale + offsetY;

    const commands: PathCommand[] = [
      { code: 'M', x: x1, y: y1 },
      { code: 'L', x: x2, y: y2 },
    ];

    shapes.push({
      type: 'line',
      commands,
      fill: 'none',
      stroke: line.getAttribute('stroke') || '#000000',
      opacity: parseFloat(line.getAttribute('opacity') || '1'),
      strokeWidth: parseFloat(line.getAttribute('stroke-width') || '1') * scale,
    });
  });
}

/**
 * Parse points attribute (used by polygon and polyline)
 */
function parsePoints(
  pointsStr: string,
  scale: number,
  offsetX: number,
  offsetY: number
): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  const coords = pointsStr.trim().split(/[\s,]+/);
  
  for (let i = 0; i < coords.length - 1; i += 2) {
    const x = parseFloat(coords[i]) * scale + offsetX;
    const y = parseFloat(coords[i + 1]) * scale + offsetY;
    points.push({ x, y });
  }
  
  return points;
}

/**
 * Parse SVG path string to commands using svg-path-parser library
 */
function parseSVGPath(
  pathString: string,
  scale: number,
  offsetX: number,
  offsetY: number
): PathCommand[] {
  try {
    const parsed = svgPathParser.parseSVG(pathString);
    const absolute = svgPathParser.makeAbsolute(parsed);
    const transformed = absolute.map((cmd: any) => 
      transformCommand(cmd, scale, offsetX, offsetY)
    );
    return transformed;
  } catch (error) {
    console.error('Error parsing SVG path:', error);
    return [];
  }
}

/**
 * Transform a path command with scale and offset
 */
function transformCommand(
  cmd: any,
  scale: number,
  offsetX: number,
  offsetY: number
): PathCommand {
  const transformed: PathCommand = { code: cmd.code };

  // Transform coordinate properties
  if (cmd.x !== undefined) {
    transformed.x = cmd.x * scale + offsetX;
  }
  if (cmd.y !== undefined) {
    transformed.y = cmd.y * scale + offsetY;
  }
  if (cmd.x1 !== undefined) {
    transformed.x1 = cmd.x1 * scale + offsetX;
  }
  if (cmd.y1 !== undefined) {
    transformed.y1 = cmd.y1 * scale + offsetY;
  }
  if (cmd.x2 !== undefined) {
    transformed.x2 = cmd.x2 * scale + offsetX;
  }
  if (cmd.y2 !== undefined) {
    transformed.y2 = cmd.y2 * scale + offsetY;
  }
  if (cmd.x0 !== undefined) {
    transformed.x0 = cmd.x0 * scale + offsetX;
  }
  if (cmd.y0 !== undefined) {
    transformed.y0 = cmd.y0 * scale + offsetY;
  }

  // Scale radius properties (don't offset)
  if (cmd.rx !== undefined) {
    transformed.rx = cmd.rx * scale;
  }
  if (cmd.ry !== undefined) {
    transformed.ry = cmd.ry * scale;
  }

  // Copy other properties
  if (cmd.xAxisRotation !== undefined) {
    transformed.xAxisRotation = cmd.xAxisRotation;
  }
  if (cmd.largeArc !== undefined) {
    transformed.largeArc = cmd.largeArc;
  }
  if (cmd.sweep !== undefined) {
    transformed.sweep = cmd.sweep;
  }

  return transformed;
}

