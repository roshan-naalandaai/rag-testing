/**
 * Path Helpers - Utilities for generating common paths
 */

export class PathHelpers {
  /**
   * Generate a circle path
   */
  static circle(centerX: number, centerY: number, radius: number, segments: number = 32): number[][] {
    const path: number[][] = [];
    
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      path.push([x, y]);
    }
    
    return path;
  }

  /**
   * Generate a rectangle path
   */
  static rectangle(x: number, y: number, width: number, height: number): number[][] {
    return [
      [x, y],
      [x + width, y],
      [x + width, y + height],
      [x, y + height],
      [x, y],
    ];
  }

  /**
   * Generate a line path
   */
  static line(x1: number, y1: number, x2: number, y2: number): number[][] {
    return [[x1, y1], [x2, y2]];
  }

  /**
   * Generate an arrow path (line + arrowhead)
   */
  static arrow(x1: number, y1: number, x2: number, y2: number, headSize: number = 15): {
    shaft: number[][];
    head: number[][];
  } {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    
    const headAngle1 = angle + Math.PI * 0.8;
    const headAngle2 = angle - Math.PI * 0.8;
    
    const headX1 = x2 + Math.cos(headAngle1) * headSize;
    const headY1 = y2 + Math.sin(headAngle1) * headSize;
    
    const headX2 = x2 + Math.cos(headAngle2) * headSize;
    const headY2 = y2 + Math.sin(headAngle2) * headSize;
    
    return {
      shaft: [[x1, y1], [x2, y2]],
      head: [[headX1, headY1], [x2, y2], [headX2, headY2]],
    };
  }

  /**
   * Generate a curved path (quadratic Bezier)
   */
  static curve(x1: number, y1: number, cx: number, cy: number, x2: number, y2: number, segments: number = 20): number[][] {
    const path: number[][] = [];
    
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const t1 = 1 - t;
      
      const x = t1 * t1 * x1 + 2 * t1 * t * cx + t * t * x2;
      const y = t1 * t1 * y1 + 2 * t1 * t * cy + t * t * y2;
      
      path.push([x, y]);
    }
    
    return path;
  }

  /**
   * Generate a smooth curve through multiple points (Catmull-Rom spline)
   */
  static smoothPath(points: number[][], segments: number = 10): number[][] {
    if (points.length < 3) return points;
    
    const result: number[][] = [];
    
    // Add first point
    result.push(points[0]);
    
    // Interpolate between points
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];
      
      for (let t = 0; t < 1; t += 1 / segments) {
        const tt = t * t;
        const ttt = tt * t;
        
        const x = 0.5 * (
          (2 * p1[0]) +
          (-p0[0] + p2[0]) * t +
          (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * tt +
          (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * ttt
        );
        
        const y = 0.5 * (
          (2 * p1[1]) +
          (-p0[1] + p2[1]) * t +
          (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * tt +
          (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * ttt
        );
        
        result.push([x, y]);
      }
    }
    
    // Add last point
    result.push(points[points.length - 1]);
    
    return result;
  }

  /**
   * Generate a star path
   */
  static star(centerX: number, centerY: number, outerRadius: number, innerRadius: number, points: number = 5): number[][] {
    const path: number[][] = [];
    const angleStep = Math.PI / points;
    
    for (let i = 0; i <= points * 2; i++) {
      const angle = i * angleStep - Math.PI / 2;
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      
      path.push([x, y]);
    }
    
    return path;
  }

  /**
   * Generate a sine wave path
   */
  static sineWave(startX: number, startY: number, endX: number, amplitude: number, frequency: number, segments: number = 100): number[][] {
    const path: number[][] = [];
    const width = endX - startX;
    
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = startX + width * t;
      const y = startY + Math.sin(t * Math.PI * 2 * frequency) * amplitude;
      
      path.push([x, y]);
    }
    
    return path;
  }

  /**
   * Generate a polygon path
   */
  static polygon(centerX: number, centerY: number, radius: number, sides: number): number[][] {
    const path: number[][] = [];
    const angleStep = (Math.PI * 2) / sides;
    
    for (let i = 0; i <= sides; i++) {
      const angle = i * angleStep - Math.PI / 2;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      
      path.push([x, y]);
    }
    
    return path;
  }

  /**
   * Resample a path to have evenly spaced points
   */
  static resample(path: number[][], spacing: number): number[][] {
    if (path.length < 2) return path;
    
    const result: number[][] = [path[0]];
    let accumulated = 0;
    
    for (let i = 1; i < path.length; i++) {
      const prev = path[i - 1];
      const curr = path[i];
      
      const dx = curr[0] - prev[0];
      const dy = curr[1] - prev[1];
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      accumulated += distance;
      
      if (accumulated >= spacing) {
        result.push(curr);
        accumulated = 0;
      }
    }
    
    // Always include last point
    if (result[result.length - 1] !== path[path.length - 1]) {
      result.push(path[path.length - 1]);
    }
    
    return result;
  }
}

