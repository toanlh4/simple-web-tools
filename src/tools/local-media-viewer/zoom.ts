/** Scale and offset applied to an image box with `transform-origin: 0 0`. Scale 1 is "fit to screen". */
export interface ZoomView {
  scale: number;
  x: number;
  y: number;
}

/** The viewport and the image shown in it with `object-fit: contain`. */
export interface ZoomBox {
  width: number;
  height: number;
  naturalWidth: number;
  naturalHeight: number;
}

export const FIT: ZoomView = { scale: 1, x: 0, y: 0 };

/** Size and position of the visible image inside the box at scale 1. */
export function fitRect(box: ZoomBox): { width: number; height: number; left: number; top: number } {
  if (box.naturalWidth <= 0 || box.naturalHeight <= 0) return { width: box.width, height: box.height, left: 0, top: 0 };
  const ratio = Math.min(box.width / box.naturalWidth, box.height / box.naturalHeight);
  const width = box.naturalWidth * ratio;
  const height = box.naturalHeight * ratio;
  return { width, height, left: (box.width - width) / 2, top: (box.height - height) / 2 };
}

/** Scale at which one image pixel takes one screen pixel. */
export function actualSizeScale(box: ZoomBox): number {
  const fit = fitRect(box);
  return fit.width > 0 && box.naturalWidth > 0 ? box.naturalWidth / fit.width : 1;
}

export function maxScale(box: ZoomBox): number {
  return Math.max(4, actualSizeScale(box) * 2);
}

function clampAxis(offset: number, scale: number, size: number, start: number, length: number): number {
  const content = length * scale;
  // Smaller than the viewport: keep it centered.
  if (content <= size) return size / 2 - scale * (start + length / 2);
  return Math.min(-start * scale, Math.max(size - (start + length) * scale, offset));
}

/** Limits the scale and keeps the image covering the viewport, or centered when it is smaller. */
export function clampView(view: ZoomView, box: ZoomBox): ZoomView {
  const scale = Math.min(maxScale(box), Math.max(1, view.scale));
  const fit = fitRect(box);
  return {
    scale,
    x: clampAxis(view.x, scale, box.width, fit.left, fit.width),
    y: clampAxis(view.y, scale, box.height, fit.top, fit.height),
  };
}

/** Changes the scale while keeping the point (px, py) of the viewport over the same part of the image. */
export function zoomAt(view: ZoomView, box: ZoomBox, scale: number, px: number, py: number): ZoomView {
  const next = Math.min(maxScale(box), Math.max(1, scale));
  const ratio = next / view.scale;
  return clampView({ scale: next, x: px - (px - view.x) * ratio, y: py - (py - view.y) * ratio }, box);
}
