"""
Perspective transformation API for straightening crooked document images
"""
import cv2
import numpy as np
import base64
from io import BytesIO
from PIL import Image


def perspective_transform_image(image_base64: str, corners: list) -> str:
    """
    Apply perspective transform to straighten a document image.

    Args:
        image_base64: Base64 encoded image
        corners: List of 4 corner points [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]
                 Order: top-left, top-right, bottom-right, bottom-left

    Returns:
        Base64 encoded straightened image
    """
    # Decode base64 image
    image_data = base64.b64decode(image_base64.split(',')[1] if ',' in image_base64 else image_base64)
    image = Image.open(BytesIO(image_data))

    # Convert PIL to OpenCV format
    img_array = np.array(image)
    if len(img_array.shape) == 2:  # Grayscale
        img_cv = img_array
    elif img_array.shape[2] == 4:  # RGBA
        img_cv = cv2.cvtColor(img_array, cv2.COLOR_RGBA2BGR)
    else:  # RGB
        img_cv = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)

    # Source points (the 4 corners marked by user)
    src_pts = np.float32(corners)

    # Calculate target dimensions (UK driving licence aspect ratio: 85.6mm × 54mm = 1.585)
    target_aspect_ratio = 1.585
    target_width = 856
    target_height = int(target_width / target_aspect_ratio)

    # Destination points (rectangle)
    dst_pts = np.float32([
        [0, 0],                          # top-left
        [target_width, 0],               # top-right
        [target_width, target_height],   # bottom-right
        [0, target_height]               # bottom-left
    ])

    # Calculate perspective transform matrix
    matrix = cv2.getPerspectiveTransform(src_pts, dst_pts)

    # Apply perspective transform
    warped = cv2.warpPerspective(img_cv, matrix, (target_width, target_height))

    # Convert back to PIL Image
    if len(warped.shape) == 2:  # Grayscale
        result_image = Image.fromarray(warped)
    else:  # Color
        warped_rgb = cv2.cvtColor(warped, cv2.COLOR_BGR2RGB)
        result_image = Image.fromarray(warped_rgb)

    # Convert to base64
    buffered = BytesIO()
    result_image.save(buffered, format="PNG")
    img_base64 = base64.b64encode(buffered.getvalue()).decode()

    return f"data:image/png;base64,{img_base64}"
