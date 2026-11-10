"""Visible bounding-box dimensions, not physical manufacturing dimensions."""
import math

def visible_dimensions(box, width, height, depth_m, focal_px):
    if len(box) != 4 or not all(math.isfinite(float(x)) for x in [*box, width, height, depth_m, focal_px]):
        raise ValueError("Invalid geometry")
    x1, y1, x2, y2 = box
    if not (0 <= x1 < x2 <= width and 0 <= y1 < y2 <= height and depth_m > 0 and focal_px > 0):
        raise ValueError("Invalid geometry")
    # Frontoparallel approximation at median target depth. This is not a 3D bounding box.
    w, h = (x2-x1)*depth_m/focal_px*1000, (y2-y1)*depth_m/focal_px*1000
    if not (1 <= w <= 10000 and 1 <= h <= 10000):
        raise ValueError("Out of supported range")
    return round(w, 1), round(h, 1)
