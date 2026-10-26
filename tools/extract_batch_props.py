from PIL import Image, ImageChops
import numpy as np
import os

source_path = r'D:\Download\Gemini_Generated_Image_tgpg8ktgpg8ktgpg.jfif'
output_dir = r'\\100.76.172.67\c$\xampp\htdocs\kantor-rama-ai\assets\voxel\renders\extracted'
os.makedirs(output_dir, exist_ok=True)

def extract_props():
    img = Image.open(source_path).convert("RGBA")
    data = np.array(img)
    
    # Target background color from inspection
    bg_r, bg_g, bg_b = 28, 25, 34
    tolerance = 25
    
    # Create mask where pixels are NOT background
    diff = np.abs(data[:, :, 0].astype(int) - bg_r) + \
           np.abs(data[:, :, 1].astype(int) - bg_g) + \
           np.abs(data[:, :, 2].astype(int) - bg_b)
    
    mask = diff > tolerance
    
    # Set background to transparent
    data[~mask, 3] = 0
    clean_img = Image.fromarray(data)
    
    # Find bounding boxes using a simple connected component logic or just scan regions
    # For now, let's use a 128x128 grid scan and crop non-empty tiles to be fast and safe
    grid_w, grid_h = 128, 128
    w, h = img.size
    
    count = 0
    for y in range(0, h, grid_h):
        for x in range(0, w, grid_w):
            box = (x, y, min(x + grid_w, w), min(y + grid_h, h))
            tile = clean_img.crop(box)
            
            # Trim the tile to actual content
            bbox = tile.getbbox()
            if bbox:
                # Add small padding
                p = 2
                padded_bbox = (max(0, bbox[0]-p), max(0, bbox[1]-p), min(grid_w, bbox[2]+p), min(grid_h, bbox[3]+p))
                cropped_tile = tile.crop(padded_bbox)
                
                # Filter out very small artifacts (noise < 8px)
                tw, th = cropped_tile.size
                if tw > 8 and th > 8:
                    count += 1
                    save_path = os.path.join(output_dir, f"prop_{count:03d}_{tw}x{th}.png")
                    cropped_tile.save(save_path, "PNG")

    print(f"EXTRACTED: {count} assets to {output_dir}")

if __name__ == "__main__":
    extract_props()
