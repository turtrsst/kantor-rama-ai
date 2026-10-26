from PIL import Image
import os
import math

extracted_dir = r'\\100.76.172.67\c$\xampp\htdocs\kantor-rama-ai\assets\voxel\renders\extracted'
output_sheet = r'\\100.76.172.67\c$\xampp\htdocs\kantor-rama-ai\assets\voxel\renders\extracted_catalog.png'

def create_catalog():
    files = sorted([f for f in os.listdir(extracted_dir) if f.endswith('.png')])
    if not files: return

    # Grid settings
    cols = 16
    rows = math.ceil(len(files) / cols)
    cell_size = 140
    
    sheet = Image.new("RGBA", (cols * cell_size, rows * cell_size), (40, 48, 64, 255))
    
    for i, f in enumerate(files):
        img = Image.open(os.path.join(extracted_dir, f))
        
        # Draw on sheet centered in cell
        x = (i % cols) * cell_size
        y = (i // cols) * cell_size
        
        # Center image in cell
        iw, ih = img.size
        ox = (cell_size - iw) // 2
        oy = (cell_size - ih) // 2
        
        sheet.paste(img, (x + ox, y + oy), img)
        
    sheet.save(output_sheet, "PNG")
    print(f"CATALOG CREATED: {output_sheet}")

if __name__ == "__main__":
    create_catalog()
