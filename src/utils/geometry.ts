// Calcular distância entre dois pontos
export function calculateDistance(
  point1: { x: number; y: number },
  point2: { x: number; y: number }
): number {
  const dx = point2.x - point1.x;
  const dy = point2.y - point1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Calcular ângulo entre dois pontos
export function calculateAngle(
  point1: { x: number; y: number },
  point2: { x: number; y: number }
): number {
  return Math.atan2(point2.y - point1.y, point2.x - point1.x);
}

// Calcular ponto médio entre dois pontos
export function calculateMidpoint(
  point1: { x: number; y: number },
  point2: { x: number; y: number }
): { x: number; y: number } {
  return {
    x: (point1.x + point2.x) / 2,
    y: (point1.y + point2.y) / 2
  };
}

// Calcular área do triângulo
export function calculateTriangleArea(
  point1: { x: number; y: number },
  point2: { x: number; y: number },
  point3: { x: number; y: number }
): number {
  return Math.abs(
    (point1.x * (point2.y - point3.y) +
     point2.x * (point3.y - point1.y) +
     point3.x * (point1.y - point2.y)) / 2
  );
}

// Calcular centro de massa de um conjunto de pontos
export function calculateCentroid(points: { x: number; y: number }[]): { x: number; y: number } {
  const sum = points.reduce(
    (acc, point) => ({
      x: acc.x + point.x,
      y: acc.y + point.y
    }),
    { x: 0, y: 0 }
  );

  return {
    x: sum.x / points.length,
    y: sum.y / points.length
  };
}

// Calcular rotação de um ponto em torno de um centro
export function rotatePoint(
  point: { x: number; y: number },
  center: { x: number; y: number },
  angle: number
): { x: number; y: number } {
  const radians = (angle * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  const dx = point.x - center.x;
  const dy = point.y - center.y;

  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos
  };
}

// Calcular interseção de duas linhas
export function calculateLineIntersection(
  line1Start: { x: number; y: number },
  line1End: { x: number; y: number },
  line2Start: { x: number; y: number },
  line2End: { x: number; y: number }
): { x: number; y: number } | null {
  const denominator =
    (line2End.y - line2Start.y) * (line1End.x - line1Start.x) -
    (line2End.x - line2Start.x) * (line1End.y - line1Start.y);

  if (denominator === 0) {
    return null; // Linhas paralelas
  }

  const ua =
    ((line2End.x - line2Start.x) * (line1Start.y - line2Start.y) -
     (line2End.y - line2Start.y) * (line1Start.x - line2Start.x)) /
    denominator;

  const ub =
    ((line1End.x - line1Start.x) * (line1Start.y - line2Start.y) -
     (line1End.y - line1Start.y) * (line1Start.x - line2Start.x)) /
    denominator;

  if (ua < 0 || ua > 1 || ub < 0 || ub > 1) {
    return null; // Interseção fora dos segmentos
  }

  return {
    x: line1Start.x + ua * (line1End.x - line1Start.x),
    y: line1Start.y + ua * (line1End.y - line1Start.y)
  };
}

// Calcular perpendicular a uma linha
export function calculatePerpendicular(
  lineStart: { x: number; y: number },
  lineEnd: { x: number; y: number },
  point: { x: number; y: number }
): { x: number; y: number } {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const length = Math.sqrt(dx * dx + dy * dy);

  const normalizedDx = dx / length;
  const normalizedDy = dy / length;

  return {
    x: point.x - normalizedDy,
    y: point.y + normalizedDx
  };
}

// Calcular projeção de um ponto em uma linha
export function calculateProjection(
  lineStart: { x: number; y: number },
  lineEnd: { x: number; y: number },
  point: { x: number; y: number }
): { x: number; y: number } {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const length = dx * dx + dy * dy;

  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / length
    )
  );

  return {
    x: lineStart.x + t * dx,
    y: lineStart.y + t * dy
  };
}

// Calcular distância de um ponto a uma linha
export function calculatePointToLineDistance(
  lineStart: { x: number; y: number },
  lineEnd: { x: number; y: number },
  point: { x: number; y: number }
): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const length = Math.sqrt(dx * dx + dy * dy);

  if (length === 0) {
    return calculateDistance(lineStart, point);
  }

  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (length * length)
    )
  );

  const projection = {
    x: lineStart.x + t * dx,
    y: lineStart.y + t * dy
  };

  return calculateDistance(point, projection);
}

// Calcular ângulo entre três pontos
export function calculateAngleBetweenPoints(
  point1: { x: number; y: number },
  vertex: { x: number; y: number },
  point2: { x: number; y: number }
): number {
  const v1 = {
    x: point1.x - vertex.x,
    y: point1.y - vertex.y
  };
  const v2 = {
    x: point2.x - vertex.x,
    y: point2.y - vertex.y
  };

  const dot = v1.x * v2.x + v1.y * v2.y;
  const v1mag = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
  const v2mag = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

  const cos = dot / (v1mag * v2mag);
  const angle = Math.acos(Math.max(-1, Math.min(1, cos)));

  return (angle * 180) / Math.PI;
} 