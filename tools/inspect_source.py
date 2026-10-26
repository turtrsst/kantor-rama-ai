from PIL import Image
import numpy as np
import os

source_path = r'D:\Download\Gemini_Generated_Image_tgpg8ktgpg8ktgpg.jfif'
output_dir = r'\\100.76.172.67\c$\xampp\htdocs\kantor-rama-ai\assets\voxel\renders\inspect'
os.makedirs(output_dir, exist_ok=True)

try:
    img = Image.open(source_path)
    print(f"FORMAT: {img.format}")
    print(f"SIZE: {img.size}")
    print(f"MODE: {img.mode}")
    
    # Save as PNG for inspection
    png_path = os.path.join(output_dir, "source_full.png")
    img.save(png_path, "PNG")
    print(f"CONVERTED: {png_path}")

    # Inspect top-left 256x256 to check grid size and background color
    crop = img.crop((0, 0, 256, 256))
    crop_path = os.path.join(output_dir, "source_top_left.png")
    crop.save(crop_path, "PNG")
    
    # Check background color at (0,0)
    img_rgba = img.convert("RGBA")
    data = np.array(img_rgba)
    bg_color = data[0, 0]
    print(f"BG_COLOR_AT_0_0: {bg_color}")

except Exception as e:
    print(f"ERROR: {str(e)}")
