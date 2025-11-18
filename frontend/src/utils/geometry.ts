/**
 * Geometry utilities for coordinate transformations
 * Handles conversions between canvas space, image space, card-local space, and normalized space
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NormalizedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FieldRect {
  fieldId: string;
  label: string;
  rectCard: Rect;           // In card-local coordinates
  normalizedCard: NormalizedRect;  // Normalized [0-1] relative to card
  extractionType?: 'text' | 'image' | 'both';  // Type of extraction (defaults to 'text')
}

export interface TemplateExport {
  templateName: string;
  imageSize: { width: number; height: number };
  cardRect: {
    absolute: Rect;
    normalized: NormalizedRect;
  };
  fields: FieldRect[];
}

/**
 * Convert canvas coordinates to image coordinates
 */
export function canvasToImage(
  canvasRect: Rect,
  scale: number,
  offset: { x: number; y: number }
): Rect {
  return {
    x: (canvasRect.x - offset.x) / scale,
    y: (canvasRect.y - offset.y) / scale,
    width: canvasRect.width / scale,
    height: canvasRect.height / scale
  };
}

/**
 * Convert image coordinates to canvas coordinates
 */
export function imageToCanvas(
  imageRect: Rect,
  scale: number,
  offset: { x: number; y: number }
): Rect {
  return {
    x: imageRect.x * scale + offset.x,
    y: imageRect.y * scale + offset.y,
    width: imageRect.width * scale,
    height: imageRect.height * scale
  };
}

/**
 * Normalize a rectangle to [0-1] range
 */
export function normalizeRect(
  rect: Rect,
  containerWidth: number,
  containerHeight: number
): NormalizedRect {
  return {
    x: rect.x / containerWidth,
    y: rect.y / containerHeight,
    width: rect.width / containerWidth,
    height: rect.height / containerHeight
  };
}

/**
 * Denormalize a rectangle from [0-1] range
 */
export function denormalizeRect(
  normalized: NormalizedRect,
  containerWidth: number,
  containerHeight: number
): Rect {
  return {
    x: normalized.x * containerWidth,
    y: normalized.y * containerHeight,
    width: normalized.width * containerWidth,
    height: normalized.height * containerHeight
  };
}

/**
 * Convert image-absolute coordinates to card-local coordinates
 */
export function rectToCardLocal(imageRect: Rect, cardRect: Rect): Rect {
  return {
    x: imageRect.x - cardRect.x,
    y: imageRect.y - cardRect.y,
    width: imageRect.width,
    height: imageRect.height
  };
}

/**
 * Convert card-local coordinates to image-absolute coordinates
 */
export function cardLocalToImage(cardLocalRect: Rect, cardRect: Rect): Rect {
  return {
    x: cardLocalRect.x + cardRect.x,
    y: cardLocalRect.y + cardRect.y,
    width: cardLocalRect.width,
    height: cardLocalRect.height
  };
}

/**
 * Clip a rectangle to fit within bounds
 */
export function clipRect(rect: Rect, bounds: Rect): Rect {
  const x1 = Math.max(rect.x, bounds.x);
  const y1 = Math.max(rect.y, bounds.y);
  const x2 = Math.min(rect.x + rect.width, bounds.x + bounds.width);
  const y2 = Math.min(rect.y + rect.height, bounds.y + bounds.height);

  return {
    x: x1,
    y: y1,
    width: Math.max(0, x2 - x1),
    height: Math.max(0, y2 - y1)
  };
}

/**
 * Check if a point is inside a rectangle
 */
export function pointInRect(point: { x: number; y: number }, rect: Rect): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}
