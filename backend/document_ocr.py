"""
Document OCR and Extraction Module
Handles OCR processing and data extraction from UK driving licences
"""

import re
from datetime import datetime
from typing import Dict, Optional, Any, Tuple, List
import pytesseract
from PIL import Image, ImageOps
import io
import logging
import cv2
import numpy as np
import os
import json
import tempfile
import subprocess
import uuid
import base64
from pathlib import Path
from perspective_transform import perspective_transform_image

logger = logging.getLogger(__name__)


DEBUG_DIR = Path(__file__).resolve().parent / "debug_images"
DEBUG_DIR.mkdir(parents=True, exist_ok=True)


def analyze_font_characteristics(image_pil: Image.Image) -> Dict[str, Any]:
    """
    Analyze font characteristics in an image region to optimize OCR.

    Detects:
    - Font type (dot-matrix, printed, monospace)
    - Character spacing and dimensions
    - Case type (uppercase/lowercase/mixed)
    - Optimal Tesseract configuration

    Args:
        image_pil: PIL Image of the text region

    Returns:
        Dictionary with font characteristics and recommended OCR config
    """
    try:
        # Convert to OpenCV format
        img_cv = cv2.cvtColor(np.array(image_pil), cv2.COLOR_RGB2BGR)
        gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)

        # Binarize image
        _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

        # Find contours of characters
        contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        # Filter small noise contours
        min_area = (gray.shape[0] * gray.shape[1]) * 0.001
        char_contours = [c for c in contours if cv2.contourArea(c) > min_area]

        if not char_contours:
            logger.warning("No character contours found in font analysis")
            return _default_font_config()

        # Analyze character dimensions
        char_widths = []
        char_heights = []
        char_spacing = []

        sorted_contours = sorted(char_contours, key=lambda c: cv2.boundingRect(c)[0])

        for i, contour in enumerate(sorted_contours):
            x, y, w, h = cv2.boundingRect(contour)
            char_widths.append(w)
            char_heights.append(h)

            # Calculate spacing to next character
            if i < len(sorted_contours) - 1:
                next_x = cv2.boundingRect(sorted_contours[i + 1])[0]
                spacing = next_x - (x + w)
                if spacing > 0:
                    char_spacing.append(spacing)

        # Calculate statistics
        avg_width = np.median(char_widths) if char_widths else 0
        avg_height = np.median(char_heights) if char_heights else 0
        avg_spacing = np.median(char_spacing) if char_spacing else 0
        width_variance = np.std(char_widths) if len(char_widths) > 1 else 0

        # Detect font type
        is_monospace = width_variance < avg_width * 0.15 if avg_width > 0 else False

        # Detect dot-matrix characteristics
        # Dot-matrix fonts have distinctive gaps/dots in characters
        is_dot_matrix = _detect_dot_matrix(binary, char_contours)

        # Detect case type (simple heuristic)
        case_type = "mixed"  # Default, could be enhanced with OCR

        # Build optimal Tesseract config
        tesseract_config = _build_tesseract_config({
            'is_monospace': is_monospace,
            'is_dot_matrix': is_dot_matrix,
            'avg_height': avg_height
        })

        return {
            'fontType': 'dot-matrix' if is_dot_matrix else ('monospace' if is_monospace else 'printed'),
            'isMonospace': bool(is_monospace),
            'isDotMatrix': bool(is_dot_matrix),
            'caseType': case_type,
            'avgCharWidth': float(avg_width),
            'avgCharHeight': float(avg_height),
            'charSpacing': float(avg_spacing),
            'tesseractPSM': 6,  # Uniform block of text
            'tesseractConfig': tesseract_config
        }

    except Exception as e:
        logger.error(f"Error analyzing font characteristics: {e}")
        return _default_font_config()


def _detect_dot_matrix(binary_image: np.ndarray, char_contours: List) -> bool:
    """
    Detect if text uses dot-matrix font by analyzing character density.
    Dot-matrix fonts have lower density due to gaps between dots.
    """
    try:
        if not char_contours:
            return False

        # Sample a few characters
        sample_size = min(5, len(char_contours))
        sampled = char_contours[:sample_size]

        densities = []
        for contour in sampled:
            x, y, w, h = cv2.boundingRect(contour)
            char_region = binary_image[y:y+h, x:x+w]

            if char_region.size > 0:
                # Calculate pixel density (ratio of foreground pixels)
                density = np.count_nonzero(char_region == 0) / char_region.size
                densities.append(density)

        if not densities:
            return False

        avg_density = np.mean(densities)

        # Dot-matrix fonts typically have lower density (0.2-0.5)
        # Normal printed fonts have higher density (0.5-0.8)
        return avg_density < 0.5

    except Exception as e:
        logger.error(f"Error detecting dot-matrix font: {e}")
        return False


def _build_tesseract_config(font_props: Dict) -> str:
    """
    Build optimal Tesseract configuration string based on font properties.
    """
    config_parts = ['--psm 6']  # Assume uniform block of text

    if font_props.get('is_dot_matrix'):
        # Dot-matrix fonts need special handling
        # Use uppercase-only character set if it's likely all caps
        config_parts.append('-c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ')
        config_parts.append('-c tessedit_enable_dict_correction=0')
        # Increase minimum character height for dot-matrix
        if font_props.get('avg_height', 0) > 15:
            config_parts.append('-c textord_min_linesize=2.5')

    if font_props.get('is_monospace'):
        # Monospace fonts benefit from fixed pitch detection
        config_parts.append('-c textord_force_make_prop_words=0')

    return ' '.join(config_parts)


def _default_font_config() -> Dict[str, Any]:
    """Return default font configuration when analysis fails."""
    return {
        'fontType': 'printed',
        'isMonospace': False,
        'isDotMatrix': False,
        'caseType': 'mixed',
        'avgCharWidth': 0,
        'avgCharHeight': 0,
        'charSpacing': 0,
        'tesseractPSM': 6,
        'tesseractConfig': '--psm 6'
    }


class UKDrivingLicenceExtractor:
    """
    Extract structured data from UK driving licences using OCR.

    UK Driving Licence Format:
    - Field 1: Surname
    - Field 2: First names
    - Field 3: Date of birth (DD.MM.YYYY)
    - Field 4a: Date of issue
    - Field 4b: Date of expiry
    - Field 4c: Issuing authority (DVLA)
    - Field 5: Licence number (format: SSSSS-DDMMYY-IN-XXX)
    - Field 7: Signature
    - Field 8: Address
    - Field 9: Vehicle categories
    """

    def __init__(self):
        self.patterns = {
            # UK Licence number: 5 letters + 6 digits (DDMMYY) + 2 letters + 3 digits
            # Made more flexible to handle partial OCR reads
            'licence_number': r'[A-Z]{5}\d{6}(?:[A-Z]{2}\d{3})?',

            # More strict pattern for complete licence numbers
            'licence_number_strict': r'[A-Z]{5}\d{6}[A-Z]{2}\d{3}',

            # Date patterns (DD.MM.YYYY or DD/MM/YYYY)
            'date': r'\b(\d{2})[./](\d{2})[./](\d{4})\b',

            # Postcode pattern
            'postcode': r'\b[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}\b',

            # DVLA indicator
            'dvla': r'DVLA',
        }

        # Load document templates
        self.templates = {}
        self.template = None  # Default template (UK licence for backward compatibility)

        # Load UK driving licence template
        uk_licence_path = Path(__file__).parent / "uk_licence_template.json"
        try:
            with open(uk_licence_path, 'r') as f:
                self.templates['uk_driving_licence'] = json.load(f)
                self.template = self.templates['uk_driving_licence']  # Default
                logger.info(f"Loaded UK driving licence template with {len(self.template['fields'])} fields")
        except Exception as e:
            logger.warning(f"Could not load UK driving licence template: {e}. Will use fallback extraction.")

        # Load V5C template
        v5c_path = Path(__file__).parent / "v5c_template.json"
        try:
            with open(v5c_path, 'r') as f:
                self.templates['v5c'] = json.load(f)
                logger.info(f"Loaded V5C template with {len(self.templates['v5c']['fields'])} fields")
        except Exception as e:
            logger.warning(f"Could not load V5C template: {e}.")

    def get_available_templates(self) -> Dict[str, Dict]:
        """
        Get all available document templates.

        Returns:
            Dictionary mapping template type to template data
        """
        return self.templates

    def set_template(self, template_type: str) -> bool:
        """
        Set the active template for extraction.

        Args:
            template_type: Template identifier ('uk_driving_licence' or 'v5c')

        Returns:
            True if template was set successfully, False otherwise
        """
        if template_type in self.templates:
            self.template = self.templates[template_type]
            logger.info(f"Switched to template: {template_type}")
            return True
        else:
            logger.warning(f"Template '{template_type}' not found. Available templates: {list(self.templates.keys())}")
            return False

    def extract_from_image(self, image_bytes: bytes, template_type: str = 'uk_driving_licence', custom_template: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Extract data from document image using specified template.

        Args:
            image_bytes: Image file bytes
            template_type: Document template to use ('uk_driving_licence' or 'v5c')
            custom_template: Optional custom template dict with field coordinates from template editor

        Returns:
            Dictionary containing extracted fields
        """
        try:
            # Track if we're using a custom template to skip position-based extraction
            using_custom_template = bool(custom_template)

            # Use custom template if provided, otherwise use template_type
            if custom_template:
                logger.info(f"Using custom template with {len(custom_template.get('fields', []))} fields")
                self.template = custom_template
            elif template_type and template_type in self.templates:
                self.set_template(template_type)

            # Open image and normalize orientation using EXIF
            image = Image.open(io.BytesIO(image_bytes))
            try:
                image = ImageOps.exif_transpose(image)
            except Exception:
                pass

            job_id = uuid.uuid4().hex
            debug_enabled = os.getenv("OCR_DEBUG", "0") == "1"
            debug_urls: List[str] = []

            # DISABLED: Automatic card straightening (not working correctly)
            # Detect card corners and apply perspective transform if template is available
            # This must happen BEFORE preprocessing to work on the original full image
            straightened_image = None
            # if self.template:
            #     logger.info("Attempting automatic card detection and straightening on original image...")
            #     corners = self._detect_card_corners(image, job_id if debug_enabled else None)
            #
            #     if corners:
            #         # Convert image to base64 for perspective transform
            #         buffer = io.BytesIO()
            #         image.save(buffer, format='PNG')
            #         img_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
            #         img_base64_with_prefix = f"data:image/png;base64,{img_base64}"
            #
            #         # Apply perspective transform
            #         straightened_base64 = perspective_transform_image(img_base64_with_prefix, corners)
            #
            #         # Convert back to PIL Image
            #         straightened_data = base64.b64decode(straightened_base64.split(',')[1])
            #         straightened_image = Image.open(io.BytesIO(straightened_data))
            #
            #         logger.info(f"Card straightened successfully: {straightened_image.size}")
            #
            #         # Save debug image
            #         if debug_enabled:
            #             debug_path = DEBUG_DIR / f"{job_id}_straightened_card.png"
            #             straightened_image.save(debug_path)
            #             logger.info(f"Saved straightened card: {debug_path}")
            #
            #         # Skip the old Hough lines preprocessing if we successfully straightened
            #         image = straightened_image
            #         logger.info("Using template-based straightened card, skipping Hough lines detection")
            #     else:
            #         logger.warning("Could not detect card corners automatically, will use Hough lines fallback")

            # Always preprocess image (straightening disabled)
            # Preprocess image only if we didn't already straighten it
            # if not straightened_image:
            image = self._preprocess_image(image, job_id if debug_enabled else None, debug_urls)

            # Use the working image (either template-straightened or Hough-preprocessed)
            working_image = image

            # Try multiple orientations to find the best one
            best_result = None
            best_confidence = 0

            for rotation in [0, 90, 180, 270]:
                rotated_image = working_image.rotate(rotation, expand=True) if rotation > 0 else working_image

                # Perform OCR with position data
                ocr_text = pytesseract.image_to_string(rotated_image, lang='eng')

                # Get detailed OCR data with bounding boxes for position-based extraction
                ocr_data = pytesseract.image_to_data(rotated_image, lang='eng', output_type=pytesseract.Output.DICT)

                # Debug: log OCR text if debug enabled
                if os.getenv("OCR_DEBUG", "0") == "1":
                    logger.info(f"OCR Text at {rotation}°:\n{ocr_text[:500]}")  # First 500 chars

                # Extract structured data using both text patterns and positional layout
                # Skip position-based extraction if using custom template
                if using_custom_template:
                    extracted_data = {}
                    confidence = 0.5  # Neutral confidence for custom templates
                    logger.info(f"Skipping position-based extraction (using custom template)")
                else:
                    extracted_data = self._parse_uk_licence_with_position(ocr_text, ocr_data, rotated_image.size)
                    confidence = self._calculate_confidence(extracted_data)

                logger.info(f"Rotation {rotation}°: confidence={confidence:.2f}, fields={len(extracted_data)}")
                if os.getenv("OCR_DEBUG", "0") == "1" and extracted_data:
                    logger.info(f"Extracted fields: {list(extracted_data.keys())}")

                # Keep the best result
                if confidence > best_confidence:
                    best_confidence = confidence
                    # Extract all fields using template (if available) or fallback to old method
                    if self.template:
                        template_result = self._extract_fields_using_template(
                            rotated_image,
                            job_id if debug_enabled else None
                        )
                        best_result = {
                            'ocr_text': ocr_text,
                            'extracted_data': extracted_data,
                            'rotation': rotation,
                            'photo': template_result['images'].get('photo'),
                            'signature': template_result['images'].get('signature'),
                            'full_image': template_result['images'].get('full_image'),
                            'field_images': template_result['images'],
                            'template_fields': template_result['extracted_fields']
                        }
                    else:
                        # Fallback to old percentage-based method
                        photo_and_sig = self._extract_photo_and_signature(rotated_image)
                        best_result = {
                            'ocr_text': ocr_text,
                            'extracted_data': extracted_data,
                            'rotation': rotation,
                            'photo': photo_and_sig.get('photo'),
                            'signature': photo_and_sig.get('signature'),
                            'full_image': photo_and_sig.get('full_image')
                        }

                # If we got a good result, no need to try other rotations
                if confidence > 0.7:
                    break

            if best_result:
                logger.info(f"Best result at {best_result['rotation']}° rotation with confidence {best_confidence:.2f}")

                # When using custom template, return ONLY template fields (not position-based extraction)
                if using_custom_template and 'template_fields' in best_result:
                    extracted_fields = best_result['template_fields']
                    logger.info(f"Returning {len(extracted_fields)} template-extracted fields only")
                else:
                    extracted_fields = best_result['extracted_data']

                # Determine document type from template
                doc_type_display = {
                    'uk_driving_licence': 'UK Driving Licence',
                    'v5c': 'V5C Log Book'
                }.get(template_type, 'UK Driving Licence')

                # Override with custom template name if provided
                if custom_template and custom_template.get('templateName'):
                    doc_type_display = custom_template['templateName'].replace('_', ' ').title()

                return {
                    'success': True,
                    'document_type': doc_type_display,
                    'raw_text': best_result['ocr_text'],
                    'extracted_fields': extracted_fields,
                    'images': best_result.get('field_images', {}),  # Field images from template extraction
                    'confidence': best_confidence,
                    'rotation_used': best_result['rotation'],
                    'photo': best_result.get('photo'),
                    'signature': best_result.get('signature'),
                    'full_image': best_result.get('full_image'),
                    'debug_urls': debug_urls
                }
            else:
                return {
                    'success': False,
                    'error': 'Could not extract data from image',
                    'document_type': 'Unknown',
                    'extracted_fields': {},
                    'debug_urls': debug_urls
                }

        except Exception as e:
            logger.error(f"OCR extraction failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'document_type': 'Unknown',
                'extracted_fields': {}
            }

    def _save_debug(self, img_np: np.ndarray, job_id: str, name: str, urls: List[str]) -> None:
        try:
            job_dir = DEBUG_DIR / job_id
            job_dir.mkdir(parents=True, exist_ok=True)
            out_path = job_dir / f"{name}.png"
            cv2.imwrite(str(out_path), img_np)
            urls.append(f"/debug/{job_id}/{name}.png")
        except Exception as e:
            logger.warning(f"Debug save failed for {name}: {e}")

    def _preprocess_image(self, image: Image.Image, job_id: Optional[str], debug_urls: List[str]) -> Image.Image:
        """
        Preprocess image for better OCR results.
        - Detect card contour
        - Apply perspective correction
        - Crop to card boundaries
        - Deskew text
        """
        # Convert PIL to OpenCV format
        img_cv = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)

        if job_id:
            self._save_debug(img_cv, job_id, "00_original", debug_urls)

        # Try to detect and extract the card
        card_img = self._detect_and_extract_card(img_cv, job_id, debug_urls)

        if card_img is not None:
            # Convert back to PIL
            image = Image.fromarray(cv2.cvtColor(card_img, cv2.COLOR_BGR2RGB))
            logger.info(f"Card detected and extracted, size: {image.size}")
        else:
            # Fall back to basic preprocessing
            logger.warning("Card detection failed, using basic preprocessing")
            if image.mode != 'RGB':
                image = image.convert('RGB')

        return image

    def _detect_and_extract_card(self, img: np.ndarray, job_id: Optional[str], debug_urls: List[str]) -> Optional[np.ndarray]:
        """
        Detect UK driving licence card in image and extract with perspective correction.
        UK licence is CR80 size: 85.6mm x 53.98mm (aspect ratio ~1.586:1)

        Uses multiple detection strategies:
        1. Edge-based detection (good for cards with clear edges)
        2. Color-based detection (good for pink/green UK licence against white background)
        """
        TARGET_AR = 85.6 / 53.98  # ~1.586
        W, H = 856, 540  # Output resolution maintaining aspect ratio

        orig = img.copy()

        # Try color-based detection first (UK driving licences have distinctive colors)
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

        # Detect pink regions (UK licence background is pink/hologram)
        lower_pink = np.array([140, 20, 20])
        upper_pink = np.array([180, 255, 255])
        pink_mask = cv2.inRange(hsv, lower_pink, upper_pink)

        # Detect light blue/cyan regions (main UK licence card background - KEY!)
        lower_cyan = np.array([85, 15, 100])
        upper_cyan = np.array([105, 120, 255])
        cyan_mask = cv2.inRange(hsv, lower_cyan, upper_cyan)

        # Detect green regions (UK licence flag has green)
        lower_green = np.array([40, 20, 20])
        upper_green = np.array([80, 255, 255])
        green_mask = cv2.inRange(hsv, lower_green, upper_green)

        # Combine all color masks - cyan is most important for inner license detection
        color_mask = cv2.bitwise_or(pink_mask, cyan_mask)
        color_mask = cv2.bitwise_or(color_mask, green_mask)

        # Fill gaps with morphological closing to create solid inner license region
        kernel_close = cv2.getStructuringElement(cv2.MORPH_RECT, (20, 20))
        color_mask = cv2.morphologyEx(color_mask, cv2.MORPH_CLOSE, kernel_close, iterations=2)

        if job_id:
            self._save_debug(color_mask, job_id, "00a_color_mask", debug_urls)

        # Try to find contours from color mask
        color_contours, _ = cv2.findContours(color_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        if len(color_contours) > 0:
            # Find the largest colored region
            largest_color_contour = max(color_contours, key=cv2.contourArea)
            color_area = cv2.contourArea(largest_color_contour)

            if color_area > img.shape[0] * img.shape[1] * 0.02:  # At least 2% of image
                # Get bounding rectangle of colored region
                x, y, w, h = cv2.boundingRect(largest_color_contour)

                # Expand the bounding box slightly to capture full card
                padding = int(min(w, h) * 0.1)
                x = max(0, x - padding)
                y = max(0, y - padding)
                w = min(img.shape[1] - x, w + 2 * padding)
                h = min(img.shape[0] - y, h + 2 * padding)

                ar = w / h if h > 0 else 0

                if 1.4 <= ar <= 1.9:
                    logger.info(f"Color-based detection: area={w*h}, aspect_ratio={ar:.2f}")

                    # Extract the card region
                    card_region = orig[y:y+h, x:x+w]

                    if job_id:
                        debug_img = img.copy()
                        cv2.rectangle(debug_img, (x, y), (x+w, y+h), (0, 255, 0), 3)
                        self._save_debug(debug_img, job_id, "00b_color_detection", debug_urls)

                    # Resize to standard size
                    card_resized = cv2.resize(card_region, (W, H))
                    return card_resized

        # Convert to grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        if job_id:
            self._save_debug(gray, job_id, "01_gray", debug_urls)

        # Enhance contrast using CLAHE (Contrast Limited Adaptive Histogram Equalization)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(gray)
        if job_id:
            self._save_debug(enhanced, job_id, "01b_enhanced", debug_urls)

        # Apply Gaussian blur to reduce noise
        blur = cv2.GaussianBlur(enhanced, (5, 5), 0)
        if job_id:
            self._save_debug(blur, job_id, "02_blur", debug_urls)

        # Edge detection - use lower thresholds to detect fainter edges
        # Try multiple edge detection approaches
        edges1 = cv2.Canny(blur, 30, 100)  # More sensitive
        edges2 = cv2.Canny(blur, 75, 200)  # Original

        # Combine edges
        edges = cv2.bitwise_or(edges1, edges2)

        if job_id:
            self._save_debug(edges1, job_id, "03a_edges_sensitive", debug_urls)
            self._save_debug(edges2, job_id, "03b_edges_normal", debug_urls)
            self._save_debug(edges, job_id, "03c_edges_combined", debug_urls)

        # Apply morphological operations to close gaps in edges
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
        edges_closed = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel)
        edges_closed = cv2.dilate(edges_closed, kernel, iterations=1)

        if job_id:
            self._save_debug(edges_closed, job_id, "03d_edges_closed", debug_urls)

        # Try adaptive thresholding to detect inner frame better
        # This helps detect subtle contrast changes at the inner border
        adaptive = cv2.adaptiveThreshold(
            blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 11, 2
        )

        # Combine with edge detection
        edges_enhanced = cv2.bitwise_or(edges_closed, adaptive)

        # Apply moderate morphological closing to connect edges without over-closing
        # Use moderate kernel to preserve both inner and outer frames
        med_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (7, 7))
        edges_enhanced = cv2.morphologyEx(edges_enhanced, cv2.MORPH_CLOSE, med_kernel, iterations=1)

        if job_id:
            self._save_debug(adaptive, job_id, "03e_adaptive", debug_urls)
            self._save_debug(edges_enhanced, job_id, "03f_edges_enhanced", debug_urls)

        # Use Hough Line Transform on the ENHANCED image instead of edges
        # The enhanced image (CLAHE) has better contrast and will detect frame edges better
        # Apply edge detection specifically for Hough (on enhanced image, not blur)
        edges_for_hough = cv2.Canny(enhanced, 50, 150)

        # Use Hough Line Transform to detect straight edges (best for nested rectangles)
        # This will find both outer frame (square corners) and inner frame (rounded, but with straight sides)
        min_line_len = min(img.shape[:2]) // 12  # Longer lines = frame edges, not text
        lines = cv2.HoughLinesP(edges_for_hough, rho=1, theta=np.pi/180, threshold=80, minLineLength=min_line_len, maxLineGap=40)

        # Group lines into horizontal and vertical, find rectangles from line intersections
        rectangles_from_lines = []
        if lines is not None and len(lines) > 0:
            horizontal_lines = []
            vertical_lines = []

            for line in lines:
                x1, y1, x2, y2 = line[0]
                angle = np.abs(np.arctan2(y2 - y1, x2 - x1) * 180 / np.pi)

                # Classify as horizontal (angle near 0 or 180) or vertical (angle near 90)
                if angle < 20 or angle > 160:
                    horizontal_lines.append((x1, y1, x2, y2))
                elif 70 < angle < 110:
                    vertical_lines.append((x1, y1, x2, y2))

            if job_id:
                # Draw detected lines on the enhanced grayscale image (converted to color)
                enhanced_color = cv2.cvtColor(enhanced, cv2.COLOR_GRAY2BGR)
                for x1, y1, x2, y2 in horizontal_lines:
                    cv2.line(enhanced_color, (x1, y1), (x2, y2), (0, 255, 0), 2)  # Green for horizontal
                for x1, y1, x2, y2 in vertical_lines:
                    cv2.line(enhanced_color, (x1, y1), (x2, y2), (255, 0, 0), 2)  # Blue for vertical
                self._save_debug(enhanced_color, job_id, "03g_hough_lines", debug_urls)
                logger.info(f"Hough lines: {len(horizontal_lines)} horizontal, {len(vertical_lines)} vertical")

            # Find the 4 dominant frame edges instead of all combinations
            # Group horizontal lines by y-coordinate, vertical lines by x-coordinate
            if len(horizontal_lines) >= 2 and len(vertical_lines) >= 2:
                # Find the longest lines in each direction (likely frame edges, not text)
                horizontal_lines.sort(key=lambda l: abs(l[2] - l[0]), reverse=True)  # Sort by length
                vertical_lines.sort(key=lambda l: abs(l[3] - l[1]), reverse=True)

                # Take top 20 longest lines of each type to filter noise
                top_h_lines = horizontal_lines[:min(20, len(horizontal_lines))]
                top_v_lines = vertical_lines[:min(20, len(vertical_lines))]

                # Group by position to find frame edges
                h_groups = self._cluster_lines_by_position(top_h_lines, axis='y', tolerance=50)
                v_groups = self._cluster_lines_by_position(top_v_lines, axis='x', tolerance=50)

                logger.info(f"Dominant line groups: {len(h_groups)} horizontal, {len(v_groups)} vertical")

                # Find the top-most and bottom-most horizontal groups (frame top/bottom edges)
                if len(h_groups) >= 2:
                    # Get y-positions of each group
                    h_positions = [(np.mean([y for _, y, _, _ in group]), group) for group in h_groups]
                    h_positions.sort(key=lambda x: x[0])  # Sort by y-position

                    top_group = h_positions[0][1]  # Top-most
                    bottom_group = h_positions[-1][1]  # Bottom-most

                    # Find the left-most and right-most vertical groups (frame left/right edges)
                    if len(v_groups) >= 2:
                        v_positions = [(np.mean([x for x, _, _, _ in group]), group) for group in v_groups]
                        v_positions.sort(key=lambda x: x[0])  # Sort by x-position

                        left_group = v_positions[0][1]  # Left-most
                        right_group = v_positions[-1][1]  # Right-most

                        # Calculate rectangle from the 4 frame edges
                        y_top = int(np.mean([y for _, y, _, _ in top_group]))
                        y_bottom = int(np.mean([y for _, y, _, _ in bottom_group]))
                        x_left = int(np.mean([x for x, _, _, _ in left_group]))
                        x_right = int(np.mean([x for x, _, _, _ in right_group]))

                        width = x_right - x_left
                        height = y_bottom - y_top

                        if width > 0 and height > 0:
                            aspect_ratio = width / height
                            area = width * height
                            area_pct = (area / (img.shape[0] * img.shape[1])) * 100

                            logger.info(f"Frame rectangle: top={y_top}, bottom={y_bottom}, left={x_left}, right={x_right}")
                            logger.info(f"Frame dimensions: {width}x{height}, AR={aspect_ratio:.2f}, area={area_pct:.1f}%")

                            # Check if this looks like a license card
                            if 1.3 <= aspect_ratio <= 2.0 and area_pct > 10:
                                rectangles_from_lines.append({
                                    'bbox': (x_left, y_top, x_right, y_bottom),
                                    'area': area,
                                    'aspect_ratio': aspect_ratio
                                })
                                logger.info(f"Found license frame via Hough lines!")

        # Find contours using HIERARCHICAL mode to detect nested rectangles
        # RETR_TREE will give us parent-child relationships (outer frame contains inner frame)
        contours, hierarchy = cv2.findContours(edges_enhanced, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)

        debug_enabled = os.getenv("OCR_DEBUG", "0") == "1"
        if debug_enabled:
            logger.info(f"Total contours found: {len(contours)}")
            logger.info(f"Image size: {img.shape[1]}x{img.shape[0]}, area={img.shape[0] * img.shape[1]}")
            if hierarchy is not None:
                logger.info(f"Hierarchy shape: {hierarchy.shape}")

        # Strategy: Find nested rectangular contours
        # The inner license frame will be a child contour with rounded corners (5-8 vertices)
        # The outer frame will be the parent with square corners (4 vertices)

        # Collect all valid candidates
        candidates = []

        border_margin_x = int(img.shape[1] * 0.03)  # 3% margin
        border_margin_y = int(img.shape[0] * 0.03)

        # Precompute image area for heuristics
        img_area = img.shape[0] * img.shape[1]

        for i, contour in enumerate(contours):
            # For cards with rounded corners, try to fit a rotated rectangle
            # This works better than polygon approximation for rounded shapes
            rect = cv2.minAreaRect(contour)
            box = cv2.boxPoints(rect)
            box = np.intp(box)  # np.int0 deprecated, use np.intp

            # Also try polygon approximation for comparison
            # Use looser epsilon (0.03 instead of 0.02) to better approximate rounded rectangles
            peri = cv2.arcLength(contour, True)
            approx = cv2.approxPolyDP(contour, 0.03 * peri, True)

            # Use rotated rectangle if contour is roughly rectangular
            # IMPORTANT: UK driving license has ROUNDED corners (5-8 vertices)
            # Outer frames have SQUARE corners (exactly 4 vertices) - reject those!
            if 5 <= len(approx) <= 8:
                # Use the fitted rotated rectangle area
                box_w, box_h = rect[1]
                area = box_w * box_h

                # Inner license frame is typically 30-70% of the captured image
                # Reject very small contours (flags, text, etc.)
                min_area = img.shape[0] * img.shape[1] * 0.20
                if area < min_area:
                    if debug_enabled and area > min_area * 0.1:  # Log near-misses
                        logger.info(f"Contour {i}: area={area:.0f} too small (min={min_area:.0f})")
                    continue

                # Reject contours hugging the image borders only if they cover most of the image (likely the whole frame)
                touches_border = False
                for (px, py) in box:
                    if px <= border_margin_x or px >= img.shape[1] - border_margin_x or \
                       py <= border_margin_y or py >= img.shape[0] - border_margin_y:
                        touches_border = True
                        break
                area_pct_border = (area / img_area) * 100.0 if img_area > 0 else 100.0

                # IMPORTANT: For UK driving licenses, we want the INNER frame (rounded rectangle)
                # not the outer border. Skip very large contours that touch borders (>70% of image).
                # The inner license frame is typically 50-70% of the captured image area.
                if touches_border and area_pct_border > 70.0:
                    if debug_enabled:
                        logger.info(f"Contour {i}: touches image border with {area_pct_border:.1f}% area, likely outer frame - skipping")
                    continue

                if min(box_w, box_h) == 0:
                    continue

                contour_ar = max(box_w, box_h) / min(box_w, box_h)

                # Check if this is a child contour (nested inside another)
                is_child = False
                if hierarchy is not None and len(hierarchy) > 0:
                    # hierarchy[0][i] = [Next, Previous, First_Child, Parent]
                    # Parent index >= 0 means this contour is nested inside another
                    parent_idx = hierarchy[0][i][3]
                    is_child = parent_idx >= 0

                # Log all rounded rectangle contours in debug mode
                if debug_enabled:
                    logger.info(f"Rounded rect {i}: vertices={len(approx)}, area={area:.0f}, aspect_ratio={contour_ar:.2f}, is_child={is_child}")

                # UK licence aspect ratio with wider tolerance (1.3 to 2.0)
                # Standard is 1.586 but allow for perspective distortion
                # Also catches landscape-oriented cards (1.33 is common for photos)
                if 1.3 <= contour_ar <= 2.0:
                    candidates.append({
                        'contour': box,  # Use rotated rectangle corners
                        'area': area,
                        'aspect_ratio': contour_ar,
                        'index': i,
                        'vertices': len(approx),  # Track number of vertices for debugging
                        'touches_border': touches_border,
                        'is_child': is_child  # Inner frame should be a child of outer frame
                    })
                    logger.info(f"Found card candidate {len(candidates)}: vertices={len(approx)}, area={area:.0f}, aspect_ratio={contour_ar:.2f}, touches_border={touches_border}, is_child={is_child}")

        # Sort candidates by area (largest first)
        candidates.sort(key=lambda x: x['area'], reverse=True)

        # Try to pick the best candidate
        # Strategy: prefer candidates with correct aspect ratio and reasonable size
        # If we have multiple candidates, prefer smaller ones (licence on top of card)
        # But not too small - should be at least 10% of image
        best_contour = None
        best_candidate = None
        # img_area already computed above

        if len(candidates) > 0:
            logger.info(f"Analyzing {len(candidates)} candidates")

            for i, candidate in enumerate(candidates):
                area_pct = candidate['area'] / img_area * 100

                # Score each candidate based on:
                # 1. Aspect ratio closeness to ideal (1.586)
                # 2. Size (prefer 10-50% of image for inner frame, 50-65% for complete card)
                # 3. Number of vertices (prefer 5-8 for rounded corners)
                # 4. Border touching (strongly prefer non-border-touching for inner frame detection)

                ar_score = 1.0 - abs(candidate['aspect_ratio'] - 1.586) / 0.5  # Max 1.0 when AR = 1.586

                # Adjusted size scoring to prefer inner frame (50-70% area)
                size_score = 1.0
                if area_pct < 10:
                    size_score = area_pct / 10  # Penalize too small
                elif 50 <= area_pct <= 70:
                    size_score = 1.0  # Perfect size for inner frame
                elif 10 <= area_pct < 50:
                    size_score = 0.7 + (area_pct - 10) / 40 * 0.3  # Gradually increase score
                else:  # area_pct > 70
                    size_score = max(0.3, 1.0 - (area_pct - 70) / 30)  # Penalize too large

                vertices = candidate.get('vertices', 4)
                vertex_score = 1.0 if 5 <= vertices <= 8 else 0.7  # Prefer rounded corners

                # Border penalty: strongly prefer contours that don't touch borders (inner frame)
                border_score = 0.3 if candidate.get('touches_border', False) else 1.0

                total_score = (ar_score * 0.35) + (size_score * 0.25) + (vertex_score * 0.15) + (border_score * 0.25)
                candidate['score'] = total_score

                if debug_enabled:
                    logger.info(f"Candidate {i}: area={area_pct:.1f}%, AR={candidate['aspect_ratio']:.2f}, vertices={vertices}, border={candidate.get('touches_border', False)}, score={total_score:.2f}")

            # Pick the highest scoring candidate
            best_candidate = max(candidates, key=lambda x: x.get('score', 0))
            best_contour = best_candidate['contour']
            best_area = best_candidate['area']

            logger.info(f"Selected best candidate: area={best_area:.0f} ({best_area/img_area*100:.1f}% of image), " +
                       f"aspect_ratio={best_candidate['aspect_ratio']:.2f}, score={best_candidate['score']:.2f}")

        # Draw all candidates for debugging with colors indicating ranking
        if job_id and debug_enabled and candidates:
            candidates_img = img.copy()
            colors = [(0, 255, 0), (0, 255, 255), (255, 0, 255), (255, 255, 0)]  # Green, Yellow, Magenta, Cyan
            for i, candidate in enumerate(candidates):
                color = colors[min(i, len(colors)-1)]
                cv2.drawContours(candidates_img, [candidate['contour']], -1, color, 3)
                # Label with rank
                M = cv2.moments(candidate['contour'])
                if M["m00"] != 0:
                    cx = int(M["m10"] / M["m00"])
                    cy = int(M["m01"] / M["m00"])
                    cv2.putText(candidates_img, f"#{i+1}", (cx-20, cy),
                               cv2.FONT_HERSHEY_SIMPLEX, 1, color, 2)
            logger.info(f"Found {len(candidates)} candidates (green=#1, yellow=#2, etc)")
            self._save_debug(candidates_img, job_id, "03b_candidates", debug_urls)

        if best_contour is None:
            logger.warning("No card contour found by candidate scoring, falling back to largest contour")
            # Fallback: use largest raw contour's rotated rectangle, even if it touches border
            if len(contours) == 0:
                logger.warning("No contours at all")
                return None
            largest = max(contours, key=cv2.contourArea)
            rect_fb = cv2.minAreaRect(largest)
            best_contour = np.intp(cv2.boxPoints(rect_fb))

        # Order points: top-left, top-right, bottom-right, bottom-left
        pts = best_contour.reshape(4, 2).astype("float32")
        rect = self._order_points(pts)

        # Draw contour overlay for debugging
        if job_id:
            overlay = img.copy()
            cv2.drawContours(overlay, [best_contour], -1, (0, 255, 0), 3)
            self._save_debug(overlay, job_id, "04_contour", debug_urls)

        # Apply perspective transform
        dst = np.array([[0, 0], [W, 0], [W, H], [0, H]], dtype="float32")
        M = cv2.getPerspectiveTransform(rect, dst)
        warped = cv2.warpPerspective(orig, M, (W, H))
        if job_id:
            self._save_debug(warped, job_id, "05_warped", debug_urls)

        # Crop the warped image to remove white/gray borders
        # Convert to grayscale and threshold to find the license card area
        warped_gray = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY)
        # Use Otsu's thresholding to separate card from background
        _, thresh = cv2.threshold(warped_gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

        # Find contours of the card area
        contours_crop, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        if len(contours_crop) > 0:
            # Get the largest contour (should be the license card)
            largest_contour = max(contours_crop, key=cv2.contourArea)
            x, y, w, h = cv2.boundingRect(largest_contour)

            # Add small margin (2%) to avoid cutting off edges
            margin_x = int(w * 0.02)
            margin_y = int(h * 0.02)

            x = max(0, x - margin_x)
            y = max(0, y - margin_y)
            w = min(warped.shape[1] - x, w + 2 * margin_x)
            h = min(warped.shape[0] - y, h + 2 * margin_y)

            # Crop the warped image
            warped = warped[y:y+h, x:x+w]

            if job_id:
                logger.info(f"Cropped warped image: removed borders, new size={w}x{h}")
                self._save_debug(warped, job_id, "05b_warped_cropped", debug_urls)

        # Deskew if needed - DISABLED because perspective transform already aligns the image
        # warped = self._deskew_image(warped)
        # if job_id:
        #     self._save_debug(warped, job_id, "06_deskewed", debug_urls)

        # Heuristic orientation by gradient energy (rotate if vertical text dominates)
        try:
            gx = cv2.Sobel(cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY), cv2.CV_32F, 1, 0, ksize=3)
            gy = cv2.Sobel(cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY), cv2.CV_32F, 0, 1, ksize=3)
            energy_x = float(np.mean(np.abs(gx)))
            energy_y = float(np.mean(np.abs(gy)))
            if energy_x > energy_y * 1.15:
                warped = cv2.rotate(warped, cv2.ROTATE_90_COUNTERCLOCKWISE)
                if job_id:
                    self._save_debug(warped, job_id, "06a_grad_corrected", debug_urls)
        except Exception as e:
            logger.warning(f"Gradient orientation heuristic failed: {e}")

        # Use Tesseract OSD to correct orientation to 0/90/180/270 as needed
        warped = self._apply_osd_orientation(warped, job_id, debug_urls)

        # Ensure landscape orientation and crop to ID-1 ratio (~1.586)
        oriented = warped
        if oriented.shape[0] > oriented.shape[1]:
            oriented = cv2.rotate(oriented, cv2.ROTATE_90_CLOCKWISE)
        if job_id:
            self._save_debug(oriented, job_id, "07_oriented", debug_urls)

        # Center crop to target ratio, then resize to canonical size
        TARGET_AR = 85.6 / 53.98
        cropped = self._center_crop_to_ratio(oriented, TARGET_AR)
        if job_id:
            self._save_debug(cropped, job_id, "08_cropped", debug_urls)
        cropped = cv2.resize(cropped, (W, H), interpolation=cv2.INTER_CUBIC)
        return cropped

    def _cluster_lines_by_position(self, lines: list, axis: str, tolerance: int) -> list:
        """
        Cluster lines by their position (y for horizontal, x for vertical).
        Returns list of line groups where each group contains lines at similar positions.
        """
        if not lines:
            return []

        # Extract position values based on axis
        if axis == 'y':
            positions = [np.mean([y1, y2]) for _, y1, _, y2 in lines]
        else:  # axis == 'x'
            positions = [np.mean([x1, x2]) for x1, _, x2, _ in lines]

        # Sort lines by position
        sorted_indices = np.argsort(positions)
        sorted_lines = [lines[i] for i in sorted_indices]
        sorted_positions = [positions[i] for i in sorted_indices]

        # Group lines that are within tolerance of each other
        groups = []
        current_group = [sorted_lines[0]]
        current_pos = sorted_positions[0]

        for i in range(1, len(sorted_lines)):
            if abs(sorted_positions[i] - current_pos) <= tolerance:
                current_group.append(sorted_lines[i])
            else:
                groups.append(current_group)
                current_group = [sorted_lines[i]]
                current_pos = sorted_positions[i]

        # Add the last group
        if current_group:
            groups.append(current_group)

        return groups

    def _order_points(self, pts: np.ndarray) -> np.ndarray:
        """
        Order points in clockwise order: top-left, top-right, bottom-right, bottom-left
        """
        rect = np.zeros((4, 2), dtype="float32")

        # Sum of coordinates - smallest is top-left, largest is bottom-right
        s = pts.sum(axis=1)
        rect[0] = pts[np.argmin(s)]
        rect[2] = pts[np.argmax(s)]

        # Difference - smallest is top-right, largest is bottom-left
        diff = np.diff(pts, axis=1)
        rect[1] = pts[np.argmin(diff)]
        rect[3] = pts[np.argmax(diff)]

        return rect

    def _deskew_image(self, img: np.ndarray) -> np.ndarray:
        """
        Deskew image to make text horizontal
        """
        try:
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

            # Find text coordinates
            coords = np.column_stack(np.where(gray < 200))

            if len(coords) == 0:
                return img

            # Calculate rotation angle
            angle = cv2.minAreaRect(coords)[-1]

            # Normalize angle
            if angle < -45:
                angle = -(90 + angle)
            else:
                angle = -angle

            # Only deskew if angle is significant
            if abs(angle) > 0.5:
                (h, w) = img.shape[:2]
                center = (w / 2, h / 2)
                M = cv2.getRotationMatrix2D(center, angle, 1.0)
                img = cv2.warpAffine(img, M, (w, h),
                                    flags=cv2.INTER_CUBIC,
                                    borderMode=cv2.BORDER_REPLICATE)
                logger.info(f"Deskewed image by {angle:.2f} degrees")

        except Exception as e:
            logger.warning(f"Deskew failed: {e}")

        return img

    def _center_crop_to_ratio(self, img: np.ndarray, target_ar: float) -> np.ndarray:
        """
        Crop the image around center to the target aspect ratio without stretching.
        """
        h, w = img.shape[:2]
        if h == 0 or w == 0:
            return img
        ar = w / h
        if abs(ar - target_ar) < 0.02:
            return img
        if ar > target_ar:
            # Too wide: crop width
            new_w = int(h * target_ar)
            x0 = max(0, (w - new_w) // 2)
            return img[:, x0:x0 + new_w]
        else:
            # Too tall: crop height
            new_h = int(w / target_ar)
            y0 = max(0, (h - new_h) // 2)
            return img[y0:y0 + new_h, :]

    def _apply_osd_orientation(self, img: np.ndarray, job_id: Optional[str], debug_urls: List[str]) -> np.ndarray:
        """
        Use Tesseract OSD (orientation and script detection) to correct gross rotation.
        """
        try:
            rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            pil_img = Image.fromarray(rgb)
            osd = pytesseract.image_to_osd(pil_img)
            # Example OSD: "Page number: 0\nOrientation in degrees: 90\nRotate: 270\n..."
            rotate_match = re.search(r'Rotate:\s+(\d+)', osd)
            if rotate_match:
                rotation = int(rotate_match.group(1)) % 360
                if rotation == 90:
                    img = cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)
                elif rotation == 180:
                    img = cv2.rotate(img, cv2.ROTATE_180)
                elif rotation == 270:
                    img = cv2.rotate(img, cv2.ROTATE_90_COUNTERCLOCKWISE)
                if job_id:
                    self._save_debug(img, job_id, "06b_osd_corrected", debug_urls)
        except Exception as e:
            logger.warning(f"OSD orientation detection failed: {e}")
        return img

    def _parse_uk_licence(self, text: str) -> Dict[str, str]:
        """
        Parse UK driving licence text and extract key fields.
        """
        extracted = {}

        # Extract licence number
        # Remove common OCR artifacts (spaces, periods, hyphens)
        cleaned_text = text.replace(' ', '').replace('.', '').replace('-', '')
        licence_match = re.search(self.patterns['licence_number'], cleaned_text)
        if licence_match:
            extracted['licence_number'] = licence_match.group(0)
            logger.info(f"Found licence number: {licence_match.group(0)}")
            # Parse components from licence number
            extracted.update(self._parse_licence_number(licence_match.group(0)))

        # Extract dates
        dates = re.findall(self.patterns['date'], text)
        if dates:
            # Try to identify which date is which based on position/context
            extracted['dates_found'] = [f"{d[0]}.{d[1]}.{d[2]}" for d in dates]

            # Sort dates chronologically (year, month, day)
            sorted_dates = sorted(dates, key=lambda x: (int(x[2]), int(x[1]), int(x[0])))

            # UK Driving Licence has 3 dates:
            # Field 3: Date of birth (earliest)
            # Field 4a: Issue date (middle)
            # Field 4b: Expiry date (latest)
            if len(sorted_dates) >= 1:
                dob = sorted_dates[0]
                extracted['date_of_birth'] = f"{dob[0]}/{dob[1]}/{dob[2]}"

            if len(sorted_dates) >= 2:
                # Second date chronologically is the issue date (Field 4a)
                issue = sorted_dates[1]
                extracted['issue_date'] = f"{issue[0]}/{issue[1]}/{issue[2]}"

            if len(sorted_dates) >= 3:
                # Latest date is expiry (Field 4b)
                expiry = sorted_dates[2]
                extracted['expiry_date'] = f"{expiry[0]}/{expiry[1]}/{expiry[2]}"

        # Extract postcode
        postcode_match = re.search(self.patterns['postcode'], text)
        if postcode_match:
            extracted['postcode'] = postcode_match.group(0)

        # Extract names (lines before date of birth usually)
        lines = text.split('\n')
        name_candidates = []
        for i, line in enumerate(lines):
            line = line.strip()
            # Look for lines with capital letters and spaces (typical name format)
            # Handle both proper case (Vincent Gerard) and ALL CAPS (VINCENT GERARD)
            if line and re.match(r'^[A-Z][a-zA-Z\s\-\']+$', line) and len(line.split()) <= 5:
                # Skip if it looks like a date or licence number
                if not re.search(r'\d{2}\.\d{2}\.\d{4}', line) and not re.search(r'[A-Z]{5}\d{6}', line):
                    name_candidates.append(line.title())  # Normalize to title case
                    logger.debug(f"Found name candidate: {line}")

        # UK Licence layout: First line is surname, second line is first names
        # However, if we have a licence number, we can derive the surname from it
        if 'surname_code' in extracted:
            # Use surname from licence number as it's more reliable
            surname_from_licence = extracted['surname_code'].replace('9', '').title()
            extracted['surname'] = surname_from_licence
            # All name candidates are likely first names
            if name_candidates:
                extracted['first_names'] = name_candidates[0]
            logger.info(f"Derived surname from licence: {surname_from_licence}")
        elif len(name_candidates) >= 2:
            # First line is usually surname on UK licence
            extracted['surname'] = name_candidates[0]
            extracted['first_names'] = name_candidates[1]
        elif len(name_candidates) == 1:
            # If only one name found, check if it has multiple words
            words = name_candidates[0].split()
            if len(words) >= 2:
                # Assume last word is surname (common in some formats)
                extracted['first_names'] = ' '.join(words[:-1])
                extracted['surname'] = words[-1]
            else:
                # Single word - likely surname
                extracted['surname'] = name_candidates[0]

        # Extract address (complex - usually multiple lines with postcode)
        if postcode_match:
            # Find text around postcode
            postcode_pos = text.find(postcode_match.group(0))
            # Take text before postcode as potential address
            address_text = text[:postcode_pos].strip()
            address_lines = [l.strip() for l in address_text.split('\n') if l.strip()]
            # Take last few lines before postcode
            if len(address_lines) >= 2:
                extracted['address'] = ', '.join(address_lines[-3:]) + ', ' + postcode_match.group(0)

        return extracted

    def _parse_uk_licence_with_position(self, text: str, ocr_data: Dict, image_size: Tuple[int, int]) -> Dict[str, str]:
        """
        Parse UK driving licence using both text patterns and positional layout.

        UK Driving Licence Layout (856x540px after extraction):
        - Top-left: Surname (Field 1) - around y=50-100
        - Below surname: First names (Field 2) - around y=100-150
        - Top-right: Date of birth (Field 3) - around x>600, y=50-100
        - Middle-right: Issue date (4a), Expiry date (4b) - around x>600, y=100-200
        - Bottom-left: Licence number (Field 5) - around y>300
        - Bottom section: Address (Field 8)
        """
        extracted = {}

        # First, use the existing pattern-based extraction as baseline
        extracted = self._parse_uk_licence(text)

        # Now enhance with position-based extraction
        width, height = image_size

        # Group words by their vertical position (y-coordinate)
        words_by_line = {}
        for i, word_text in enumerate(ocr_data['text']):
            if not word_text or word_text.strip() == '':
                continue

            conf = int(ocr_data['conf'][i])
            if conf < 20:  # Skip very low confidence words (lowered from 30 to capture more)
                continue

            x = ocr_data['left'][i]
            y = ocr_data['top'][i]
            w = ocr_data['width'][i]
            h = ocr_data['height'][i]

            # Group by approximate line (allow 10px tolerance)
            line_key = y // 10 * 10
            if line_key not in words_by_line:
                words_by_line[line_key] = []
            words_by_line[line_key].append({
                'text': word_text,
                'x': x,
                'y': y,
                'w': w,
                'h': h,
                'conf': conf
            })

        # Sort lines by y-position
        sorted_lines = sorted(words_by_line.items())

        # Extract fields based on known UK licence layout
        # Top section (y < height/3): Names and dates
        # Middle section (height/3 < y < 2*height/3): More info
        # Bottom section (y > 2*height/3): Licence number, address

        top_threshold = height / 3
        bottom_threshold = 2 * height / 3
        left_threshold = width / 2

        surname_candidates = []
        firstname_candidates = []
        licence_candidates = []
        address_candidates = []
        vehicle_categories = []

        for line_y, words in sorted_lines:
            line_text = ' '.join([w['text'] for w in words])
            left_words = [w for w in words if w['x'] < left_threshold]
            right_words = [w for w in words if w['x'] >= left_threshold]

            # Top-left area (first 20% of height): likely surname (Field 1)
            if line_y < height * 0.2 and left_words:
                left_text = ' '.join([w['text'] for w in left_words])
                # Check if it looks like a name (mostly letters, capitalized)
                # Handle both proper case and ALL CAPS
                if re.match(r'^[A-Z][A-Za-z\s\-\']+$', left_text) and len(left_text) > 2:
                    if not surname_candidates:
                        surname_candidates.append(left_text.title())
                        logger.info(f"Found surname candidate (top 20%): {left_text}")

            # Just below surname (20-40% height): first names (Field 2)
            elif height * 0.2 <= line_y < height * 0.4 and left_words:
                left_text = ' '.join([w['text'] for w in left_words])
                # Handle both proper case and ALL CAPS
                if re.match(r'^[A-Z][A-Za-z\s\-\']+$', left_text) and len(left_text) > 2:
                    if not firstname_candidates:
                        firstname_candidates.append(left_text.title())
                        logger.info(f"Found first name candidate (20-40%): {left_text}")

            # Lower section (70-85% height): Address (Field 8)
            # Field 8 is BELOW signature (field 7), in the lower portion
            elif height * 0.70 <= line_y < height * 0.85:
                # Address is usually in the middle-left section, spans full width
                address_line = ' '.join([w['text'] for w in words])
                # Address lines contain numbers, letters, commas
                # Skip dates, short fragments, and field numbers
                if len(address_line) > 5 and not re.match(r'^\d{2}[./]\d{2}[./]\d{4}$', address_line):
                    # Skip lines that are just field numbers or single characters
                    if not re.match(r'^[0-9a-z]{1,2}\.?$', address_line.lower().strip()):
                        address_candidates.append(address_line)
                        logger.info(f"Found address line (70-85%): {address_line}")

            # Very bottom section (85%+ height): Categories (Field 9)
            # Field 9 is BELOW address (field 8), at the very bottom
            elif line_y >= height * 0.85:
                # Look for licence number pattern
                licence_match = re.search(self.patterns['licence_number'], line_text.replace(' ', '').replace('-', ''))
                if licence_match:
                    licence_candidates.append(licence_match.group(0))
                    logger.debug(f"Found licence number: {licence_match.group(0)}")

            # Vehicle categories (Field 9) - usually on the right side, lower section
            # Look for category codes: A, A1, A2, AM, B, B1, BE, C, C1, CE, C1E, D, D1, DE, D1E
            category_match = re.findall(r'\b(AM|A1|A2|A|B1|BE|B|C1E|C1|CE|C|D1E|D1|DE|D)\b', line_text)
            if category_match:
                vehicle_categories.extend(category_match)
                logger.debug(f"Found vehicle categories: {category_match}")

        # Log what was found
        logger.info(f"Position-based extraction found: {len(surname_candidates)} surnames, "
                   f"{len(firstname_candidates)} first names, {len(licence_candidates)} licence numbers, "
                   f"{len(address_candidates)} address lines, {len(vehicle_categories)} vehicle categories")

        # Update extracted data with position-based findings
        if surname_candidates and 'surname' not in extracted:
            extracted['surname'] = surname_candidates[0]
            logger.info(f"Set surname from position: {surname_candidates[0]}")

        if firstname_candidates and 'first_names' not in extracted:
            extracted['first_names'] = firstname_candidates[0]
            logger.info(f"Set first_names from position: {firstname_candidates[0]}")

        if licence_candidates and 'licence_number' not in extracted:
            extracted['licence_number'] = licence_candidates[0]
            logger.info(f"Set licence_number from position: {licence_candidates[0]}")
            # Parse licence number components
            extracted.update(self._parse_licence_number(licence_candidates[0]))

        if address_candidates and 'address' not in extracted:
            # Join address lines with proper formatting
            address = ', '.join([line.strip() for line in address_candidates if line.strip()])
            extracted['address'] = address
            logger.info(f"Set address from position: {address}")

        if vehicle_categories:
            # Remove duplicates and sort
            unique_categories = sorted(list(set(vehicle_categories)))
            extracted['vehicle_categories'] = ', '.join(unique_categories)
            logger.info(f"Set vehicle_categories: {unique_categories}")

        logger.info(f"Final extracted fields: {list(extracted.keys())}")
        return extracted

    def _parse_licence_number(self, licence_num: str) -> Dict[str, str]:
        """
        Parse UK driving licence number format.
        Format: SSSSS DDMMYY IN XXX
        Where:
        - SSSSS: First 5 chars of surname (padded with 9s)
        - DDMMYY: Date of birth with decade offset
        - IN: Initials
        - XXX: Checksum/unique identifier

        Also handles partial licence numbers (minimum 11 chars: SSSSS + DDMMYY)
        """
        if len(licence_num) < 11:
            logger.warning(f"Licence number too short: {licence_num} (need at least 11 chars)")
            return {}

        parsed = {}

        # Surname code (first 5 characters)
        surname_code = licence_num[:5]
        parsed['surname_code'] = surname_code.replace('9', '')  # Remove padding

        # Date components (characters 6-11)
        date_part = licence_num[5:11]
        day = date_part[0:2]
        month = date_part[2:4]
        year = date_part[4:6]

        # For women, 5 is added to the first digit of month
        month_num = int(month)
        if month_num > 50:
            parsed['gender'] = 'Female'
            month = str(month_num - 50).zfill(2)
        else:
            parsed['gender'] = 'Male'

        # Determine century (assume 20th/21st century)
        year_num = int(year)
        if year_num > 50:
            full_year = f"19{year}"
        else:
            full_year = f"20{year}"

        parsed['dob_from_licence'] = f"{day}/{month}/{full_year}"

        # Initials and check digits (only if licence number is complete)
        if len(licence_num) >= 13:
            parsed['initials'] = licence_num[11:13]

        if len(licence_num) >= 16:
            parsed['check_digits'] = licence_num[13:16]

        return parsed

    def _calculate_confidence(self, extracted_data: Dict[str, str]) -> float:
        """
        Calculate confidence score based on number of fields extracted.
        """
        # Key fields that should be present on a UK driving licence
        key_fields = ['licence_number', 'date_of_birth', 'surname', 'first_names']

        # Additional important fields
        important_fields = ['address', 'issue_date', 'expiry_date', 'vehicle_categories']

        found_key_fields = sum(1 for key in key_fields if key in extracted_data)
        found_important_fields = sum(1 for key in important_fields if key in extracted_data)
        total_fields = len(extracted_data)

        if total_fields == 0:
            return 0.0

        # Weight:
        # - Key fields (surname, first names, DOB, licence number): 60%
        # - Important fields (address, dates, categories): 25%
        # - Total field count: 15%
        confidence = (
            (found_key_fields / len(key_fields)) * 0.6 +
            (found_important_fields / len(important_fields)) * 0.25 +
            (min(total_fields, 10) / 10) * 0.15
        )

        return min(confidence, 1.0)

    def _detect_card_corners(self, image_pil: Image.Image, job_id: Optional[str] = None) -> Optional[List[Tuple[float, float]]]:
        """
        Automatically detect the 4 corners of the driving licence card.

        Uses edge detection and contour finding to locate the card boundary.

        Args:
            image_pil: PIL Image containing the driving licence
            job_id: Optional job ID for debug image saving

        Returns:
            List of 4 corner points [(x1,y1), (x2,y2), (x3,y3), (x4,y4)] in order:
            top-left, top-right, bottom-right, bottom-left
            Returns None if card cannot be detected
        """
        try:
            # Convert PIL to OpenCV format
            img_array = np.array(image_pil)
            if len(img_array.shape) == 2:
                gray = img_array
                img_cv = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
            elif img_array.shape[2] == 4:
                img_cv = cv2.cvtColor(img_array, cv2.COLOR_RGBA2BGR)
                gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
            else:
                img_cv = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
                gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)

            logger.info(f"Corner detection on image: {gray.shape[1]}x{gray.shape[0]}")

            # Apply Gaussian blur to reduce noise
            blurred = cv2.GaussianBlur(gray, (5, 5), 0)

            # Edge detection using Canny - using more sensitive thresholds
            edges = cv2.Canny(blurred, 30, 100)

            # Save edge detection debug image
            if job_id:
                edges_path = DEBUG_DIR / f"{job_id}_edges.png"
                cv2.imwrite(str(edges_path), edges)
                logger.info(f"Saved edge detection image: {edges_path}")

            # Find contours
            contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

            logger.info(f"Found {len(contours)} contours")

            # Sort contours by area (largest first)
            contours = sorted(contours, key=cv2.contourArea, reverse=True)

            # Save all contours debug image
            if job_id and len(contours) > 0:
                all_contours_img = img_cv.copy()
                cv2.drawContours(all_contours_img, contours[:10], -1, (0, 255, 0), 3)
                contours_path = DEBUG_DIR / f"{job_id}_all_contours.png"
                cv2.imwrite(str(contours_path), all_contours_img)
                logger.info(f"Saved all contours image: {contours_path}")

            # Look for a quadrilateral (4-sided polygon)
            card_contour = None
            image_area = gray.shape[0] * gray.shape[1]

            for idx, contour in enumerate(contours[:10]):  # Check top 10 largest contours
                # Approximate the contour to a polygon
                peri = cv2.arcLength(contour, True)
                area = cv2.contourArea(contour)
                area_pct = (area / image_area) * 100

                # Try multiple epsilon values for approximation
                for epsilon_mult in [0.02, 0.03, 0.04, 0.05]:
                    approx = cv2.approxPolyDP(contour, epsilon_mult * peri, True)

                    # If the approximated contour has 4 points, it's likely the card
                    if len(approx) == 4:
                        # Calculate bounding rectangle to check aspect ratio
                        rect = cv2.minAreaRect(approx)
                        width, height = rect[1]
                        if width > 0 and height > 0:
                            aspect_ratio = max(width, height) / min(width, height)
                            expected_ar = 1.585  # UK driving licence aspect ratio (85.6mm / 54mm)
                            ar_tolerance = 0.4   # Allow 25% deviation

                            logger.info(f"Contour #{idx}: area={area_pct:.1f}%, perimeter={peri:.1f}, sides={len(approx)}, epsilon={epsilon_mult}, AR={aspect_ratio:.2f}")

                            # Check if it's large enough (at least 0.1% of image area)
                            # AND has the correct aspect ratio for a UK driving licence
                            if area > image_area * 0.001 and abs(aspect_ratio - expected_ar) < ar_tolerance:
                                logger.info(f"Found 4-sided contour with {area_pct:.1f}% area and AR={aspect_ratio:.2f} (epsilon={epsilon_mult})")
                                card_contour = approx
                                break
                            elif area > image_area * 0.001:
                                logger.info(f"Rejected: aspect ratio {aspect_ratio:.2f} doesn't match expected {expected_ar:.2f}")
                        else:
                            logger.info(f"Contour #{idx}: area={area_pct:.1f}%, perimeter={peri:.1f}, sides={len(approx)}, epsilon={epsilon_mult}, invalid rect")

                if card_contour is not None:
                    break

            if card_contour is None:
                logger.warning("Could not detect card corners automatically - no suitable 4-sided contour found")
                return None

            # Extract the 4 corner points
            corners = card_contour.reshape(4, 2).astype(float)

            # Order corners: top-left, top-right, bottom-right, bottom-left
            # Sort by y-coordinate to get top and bottom pairs
            sorted_by_y = sorted(corners, key=lambda p: p[1])
            top_two = sorted_by_y[:2]
            bottom_two = sorted_by_y[2:]

            # Sort top pair by x-coordinate (left to right)
            top_left, top_right = sorted(top_two, key=lambda p: p[0])
            # Sort bottom pair by x-coordinate (left to right)
            bottom_left, bottom_right = sorted(bottom_two, key=lambda p: p[0])

            ordered_corners = [
                tuple(top_left),
                tuple(top_right),
                tuple(bottom_right),
                tuple(bottom_left)
            ]

            logger.info(f"Detected card corners: {ordered_corners}")

            # Save debug image if requested
            if job_id:
                debug_img = img_cv.copy()
                for i, corner in enumerate(ordered_corners):
                    cv2.circle(debug_img, (int(corner[0]), int(corner[1])), 10, (0, 0, 255), -1)
                    cv2.putText(debug_img, str(i+1), (int(corner[0])-10, int(corner[1])-10),
                              cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
                debug_path = DEBUG_DIR / f"{job_id}_detected_corners.png"
                cv2.imwrite(str(debug_path), debug_img)
                logger.info(f"Saved corner detection debug image: {debug_path}")

            return ordered_corners

        except Exception as e:
            logger.error(f"Error detecting card corners: {e}")
            return None

    def _extract_fields_using_template(self, image_pil: Image.Image, job_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Extract all fields from UK driving licence using template-based coordinates.

        Uses normalized coordinates from uk_licence_template.json to precisely extract
        each field region, perform OCR, and save debug images.

        Args:
            image_pil: PIL Image of the straightened licence
            job_id: Optional job ID for debug image naming

        Returns:
            Dictionary with extracted field values and base64 images
        """
        result = {
            'extracted_fields': {},
            'images': {}
        }

        if not self.template:
            logger.warning("No template loaded, cannot extract fields using template")
            return result

        try:
            width, height = image_pil.size
            template_width = self.template['imageSize']['width']
            template_height = self.template['imageSize']['height']

            logger.info(f"Extracting fields using template. Image: {width}x{height}, Template: {template_width}x{template_height}")

            # Add full straightened licence image
            full_buffer = io.BytesIO()
            image_pil.save(full_buffer, format='PNG')
            full_base64 = base64.b64encode(full_buffer.getvalue()).decode('utf-8')
            result['images']['full_image'] = f"data:image/png;base64,{full_base64}"

            # Extract each field using normalized coordinates
            for field in self.template['fields']:
                field_id = field['fieldId']
                label = field['label']
                norm = field['normalizedCard']

                # Get extraction type: 'text', 'image', or 'both' (defaults to 'text')
                extraction_type = field.get('extractionType', 'text')

                # Calculate pixel coordinates for current image size
                x = int(norm['x'] * width)
                y = int(norm['y'] * height)
                field_width = int(norm['width'] * width)
                field_height = int(norm['height'] * height)

                # Crop field region
                field_region = image_pil.crop((x, y, x + field_width, y + field_height))

                logger.info(f"Extracting field '{field_id}' ({label}): {field_width}x{field_height} at ({x},{y}), type={extraction_type}")

                # Extract image if type is 'image' or 'both'
                if extraction_type in ['image', 'both']:
                    # Save as base64 image
                    field_buffer = io.BytesIO()
                    field_region.save(field_buffer, format='PNG')
                    field_base64 = base64.b64encode(field_buffer.getvalue()).decode('utf-8')
                    result['images'][field_id] = f"data:image/png;base64,{field_base64}"
                    logger.info(f"Field '{field_id}' saved as image")

                # Perform OCR if type is 'text' or 'both'
                if extraction_type in ['text', 'both']:
                    try:
                        # Get field-specific font configuration if available
                        field_font_config = field.get('fontConfig', {})
                        tesseract_config = field_font_config.get('tesseractConfig', '--psm 6')

                        # If no saved font config, analyze the field region to detect font
                        if not field_font_config:
                            logger.info(f"Analyzing font for field '{field_id}'...")
                            font_analysis = analyze_font_characteristics(field_region)
                            tesseract_config = font_analysis['tesseractConfig']
                            logger.info(f"Font detected: {font_analysis['fontType']}, "
                                      f"dot-matrix={font_analysis['isDotMatrix']}, "
                                      f"monospace={font_analysis['isMonospace']}")

                        # Use Tesseract OCR with optimized config
                        logger.info(f"Using Tesseract config: {tesseract_config}")
                        field_text = pytesseract.image_to_string(field_region, config=tesseract_config).strip()
                        if field_text:
                            result['extracted_fields'][field_id] = field_text
                            logger.info(f"Field '{field_id}' OCR result: {field_text[:50]}...")
                    except Exception as e:
                        logger.error(f"OCR failed for field '{field_id}': {e}")

                # Save debug image if job_id provided
                if job_id:
                    debug_path = DEBUG_DIR / f"{job_id}_field_{field_id}.png"
                    field_region.save(debug_path)
                    logger.info(f"Saved debug image: {debug_path}")

        except Exception as e:
            logger.error(f"Failed to extract fields using template: {e}")

        return result

    def _extract_photo_and_signature(self, image_pil: Image.Image) -> Dict[str, str]:
        """
        Extract photo, signature, and full licence image from UK driving licence.

        UK Driving Licence Field Layout (ISO 7810 ID-1 card: 85.6mm x 53.98mm):
        After card detection, the extracted card is 856x540px (landscape orientation).

        Based on actual UK driving licence layout:
        - Field 6 (Photo): Top-left corner, approximately at (10, 50) with size around (160, 200)
        - Field 7 (Signature): Below photo, approximately at (10, 280) with size around (230, 60)

        Using percentage-based coordinates for flexibility:
        - Photo: 1-20% width, 10-47% height (top-left)
        - Signature: 1-28% width, 52-63% height (middle-left, below photo)

        Args:
            image_pil: PIL Image of the processed licence

        Returns:
            Dictionary with 'photo', 'signature', and 'full_image' as base64-encoded PNG images
        """
        result = {}

        try:
            width, height = image_pil.size
            logger.info(f"Extracting from licence image size: {width}x{height}")

            # Add full straightened licence image
            full_buffer = io.BytesIO()
            image_pil.save(full_buffer, format='PNG')
            full_base64 = base64.b64encode(full_buffer.getvalue()).decode('utf-8')
            result['full_image'] = f"data:image/png;base64,{full_base64}"
            logger.info(f"Extracted full licence image: {width}x{height}")

            # Extract photo region (Field 6) - left side area
            # Photo is approximately 4-23% width, 18-62% height
            photo_region = image_pil.crop((
                int(width * 0.04),  # left (more to the right)
                int(height * 0.18),  # top
                int(width * 0.23),  # right (more to the right)
                int(height * 0.62)  # bottom
            ))

            # Convert photo to base64
            photo_buffer = io.BytesIO()
            photo_region.save(photo_buffer, format='PNG')
            photo_base64 = base64.b64encode(photo_buffer.getvalue()).decode('utf-8')
            result['photo'] = f"data:image/png;base64,{photo_base64}"
            logger.info(f"Extracted photo region (Field 6): {photo_region.size}")

            # Extract signature region (Field 7) - far right area, middle height
            # Signature is to the RIGHT of photo, ABOVE address (field 8)
            # Approximately 35-70% width, 52-65% height
            signature_region = image_pil.crop((
                int(width * 0.35),  # left (far to the right of photo)
                int(height * 0.52),  # top (higher than before)
                int(width * 0.70),  # right (extends well to the right)
                int(height * 0.65)  # bottom (higher than before)
            ))

            # Convert signature to base64
            sig_buffer = io.BytesIO()
            signature_region.save(sig_buffer, format='PNG')
            sig_base64 = base64.b64encode(sig_buffer.getvalue()).decode('utf-8')
            result['signature'] = f"data:image/png;base64,{sig_base64}"
            logger.info(f"Extracted signature region (Field 7): {signature_region.size}")

        except Exception as e:
            logger.error(f"Failed to extract photo/signature/full image: {e}")

        return result


def extract_from_document(file_bytes: bytes, filename: str, custom_template: Optional[Dict] = None, document_type: str = 'uk_driving_licence') -> Dict[str, Any]:
    """
    Main entry point for document extraction.
    Determines document type and routes to appropriate extractor.
    Args:
        file_bytes: Image bytes
        filename: Original filename
        custom_template: Optional custom template dict with field coordinates
        document_type: Document type to extract ('uk_driving_licence' or 'v5c')
    """
    # FORCE Apple Vision OCR ONLY on macOS - NO TESSERACT FALLBACK
    if os.uname().sysname != "Darwin":
        logger.error("Apple Vision OCR is only available on macOS")
        return {
            'success': False,
            'error': 'Apple Vision OCR is only available on macOS'
        }

    logger.info(f"FORCING Apple Vision OCR ONLY for document type: {document_type}, custom_template={'provided' if custom_template else 'none'}")

    # Auto-detect vision-ocr binary location
    vision_bin = os.getenv("VISION_OCR_BIN")
    if not vision_bin:
        # Try default location relative to this file
        script_dir = os.path.dirname(os.path.abspath(__file__))
        vision_bin = os.path.join(script_dir, "tools", "vision-ocr", ".build", "arm64-apple-macosx", "release", "vision-ocr")

    if not vision_bin or not os.path.exists(vision_bin):
        logger.error(f"Apple Vision OCR binary not found at: {vision_bin}")
        return {
            'success': False,
            'error': f'Apple Vision OCR binary not found at: {vision_bin}'
        }

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{filename}") as tmp:
            tmp.write(file_bytes)
            tmp_path = tmp.name

        # Prepare command arguments
        cmd = [vision_bin, "--input", tmp_path, "--type", document_type]

        # If custom template is provided, write it to a temp JSON file and pass to CLI
        template_tmp_path = None
        if custom_template:
            logger.info(f"Writing custom template to temp file for Apple Vision OCR")
            with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.json') as template_tmp:
                json.dump(custom_template, template_tmp)
                template_tmp_path = template_tmp.name
            cmd.extend(["--template", template_tmp_path])
            logger.info(f"Apple Vision OCR command: {' '.join(cmd)}")

        # Call Swift CLI: outputs JSON on stdout
        logger.info(f"Calling Apple Vision OCR with command: {' '.join(cmd)}")
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=False
        )

        logger.info(f"Apple Vision OCR return code: {proc.returncode}")
        logger.info(f"Apple Vision OCR stdout: {proc.stdout[:500]}")
        if proc.stderr:
            logger.warning(f"Apple Vision OCR stderr: {proc.stderr}")

        # Clean up temp files
        try:
            os.unlink(tmp_path)
            if template_tmp_path:
                os.unlink(template_tmp_path)
        except Exception:
            pass

        if proc.returncode == 0:
            data = json.loads(proc.stdout.strip() or "{}")
            # Ensure expected keys
            if isinstance(data, dict) and data.get("success") is True:
                logger.info(f"Apple Vision OCR SUCCESS: extracted {len(data.get('extracted_fields', {}))} fields")

                # Load field bitmap images from debug_images directory
                field_images = {}
                extracted_fields = data.get("extracted_fields", {})

                # For each field that was extracted, look for its corresponding bitmap image
                for field_name in extracted_fields.keys():
                    bitmap_path = DEBUG_DIR / f"field_{field_name}.png"
                    if bitmap_path.exists():
                        try:
                            # Read the PNG file and encode as base64
                            with open(bitmap_path, 'rb') as f:
                                bitmap_bytes = f.read()
                                bitmap_base64 = base64.b64encode(bitmap_bytes).decode('utf-8')
                                field_images[field_name] = f"data:image/png;base64,{bitmap_base64}"
                                logger.info(f"Loaded bitmap for field '{field_name}' from {bitmap_path}")
                        except Exception as e:
                            logger.warning(f"Failed to load bitmap for field '{field_name}': {e}")

                # Also check for fields that didn't extract (empty OCR) but have bitmaps
                # This handles the case where OCR failed but we still want to show the image
                if custom_template and custom_template.get('fields'):
                    for field in custom_template['fields']:
                        field_id = field.get('fieldId')
                        if field_id and field_id not in field_images:
                            bitmap_path = DEBUG_DIR / f"field_{field_id}.png"
                            if bitmap_path.exists():
                                try:
                                    with open(bitmap_path, 'rb') as f:
                                        bitmap_bytes = f.read()
                                        bitmap_base64 = base64.b64encode(bitmap_bytes).decode('utf-8')
                                        field_images[field_id] = f"data:image/png;base64,{bitmap_base64}"
                                        logger.info(f"Loaded bitmap for empty field '{field_id}' from {bitmap_path}")
                                        # DON'T add empty string to extracted_fields - frontend will handle image-only fields
                                except Exception as e:
                                    logger.warning(f"Failed to load bitmap for empty field '{field_id}': {e}")

                logger.info(f"Loaded {len(field_images)} field bitmap images")

                return {
                    "success": True,
                    "document_type": data.get("document_type", "UK Driving Licence"),
                    "raw_text": data.get("raw_text", ""),
                    "extracted_fields": extracted_fields,
                    "images": field_images,  # Add field bitmap images
                    "confidence": float(data.get("confidence", 0.9)),
                    "engine": "apple_vision"
                }
            else:
                logger.error(f"Apple Vision CLI returned non-success: {data}")
                return {
                    'success': False,
                    'error': f"Apple Vision CLI returned non-success: {data.get('error', 'unknown error')}"
                }
        else:
            logger.error(f"Apple Vision CLI failed: rc={proc.returncode}, stderr={proc.stderr}, stdout={proc.stdout}")
            return {
                'success': False,
                'error': f"Apple Vision CLI failed with return code {proc.returncode}: {proc.stderr}"
            }
    except Exception as e:
        logger.error(f"Apple Vision OCR exception: {e}", exc_info=True)
        return {
            'success': False,
            'error': f'Apple Vision OCR failed: {str(e)}'
        }
