import { describe, expect, it } from 'vitest';
import { actualSizeScale, clampView as clampRaw, FIT, fitRect, maxScale, zoomAt as zoomRaw, type ZoomBox, type ZoomView } from './zoom';

/** Turns -0 into 0, which toEqual tells apart. */
const plain = (v: ZoomView): ZoomView => ({ scale: v.scale, x: v.x + 0, y: v.y + 0 });
const clampView = (...a: Parameters<typeof clampRaw>) => plain(clampRaw(...a));
const zoomAt = (...a: Parameters<typeof zoomRaw>) => plain(zoomRaw(...a));

// A 4000x2000 photo in an 1000x1000 viewport is shown as 1000x500, 250px from the top.
const box: ZoomBox = { width: 1000, height: 1000, naturalWidth: 4000, naturalHeight: 2000 };

describe('zoom', () => {
  it('fits the image', () => {
    expect(fitRect(box)).toEqual({ width: 1000, height: 500, left: 0, top: 250 });
    expect(actualSizeScale(box)).toBe(4);
    expect(maxScale(box)).toBe(8);
    expect(maxScale({ ...box, naturalWidth: 100, naturalHeight: 50 })).toBe(4);
  });

  it('keeps the point under the cursor in place', () => {
    const view = zoomAt(FIT, box, 2, 250, 500);
    expect(view).toEqual({ scale: 2, x: -250, y: -500 });
    // The image point under (250, 500) stays there: (250 - x) / scale is unchanged.
    expect((250 - view.x) / view.scale).toBe(250);
  });

  it('centers an axis that is smaller than the viewport', () => {
    // At scale 1.5 the image is 750px high, so it stays centered vertically.
    expect(zoomAt(FIT, box, 1.5, 0, 0)).toEqual({ scale: 1.5, x: 0, y: -250 });
  });

  it('stops panning at the image edges', () => {
    expect(clampView({ scale: 4, x: 500, y: 0 }, box)).toEqual({ scale: 4, x: 0, y: -1000 });
    expect(clampView({ scale: 4, x: -9999, y: -9999 }, box)).toEqual({ scale: 4, x: -3000, y: -2000 });
  });

  it('limits the scale', () => {
    expect(zoomAt(FIT, box, 0.2, 10, 10)).toEqual(FIT);
    expect(zoomAt(FIT, box, 100, 0, 250).scale).toBe(8);
  });
});
