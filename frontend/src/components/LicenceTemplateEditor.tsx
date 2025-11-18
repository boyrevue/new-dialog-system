import React, { useRef, useState, useEffect } from 'react';
import {
  Rect,
  NormalizedRect,
  FieldRect,
  TemplateExport,
  canvasToImage,
  imageToCanvas,
  normalizeRect,
  rectToCardLocal
} from '../utils/geometry';

const UK_FIELDS = [
  { id: "surname", label: "1. Surname" },
  { id: "given_names", label: "2. First names" },
  { id: "dob_place", label: "3. Date & place of birth" },
  { id: "issue_date", label: "4a. Date of issue" },
  { id: "expiry_date", label: "4b. Date of expiry" },
  { id: "issuing_authority", label: "4c. Issuing authority" },
  { id: "licence_number", label: "5. Licence number" },
  { id: "photo", label: "6. Photograph" },
  { id: "signature", label: "7. Signature" },
  { id: "address", label: "8. Address" },
  { id: "categories", label: "9. Categories" }
];

const V5C_FIELDS = [
  { id: "registration_number", label: "A. Registration number" },
  { id: "date_of_registration", label: "B. Date of registration" },
  { id: "date_first_uk_registration", label: "B.1. Date of first UK registration" },
  { id: "make", label: "D.1. Make" },
  { id: "type_variant_version", label: "D.2. Type, Variant, Version" },
  { id: "model", label: "D.3. Model" },
  { id: "body_type", label: "D.5. Body type" },
  { id: "vin", label: "E. VIN/Chassis/Frame number" },
  { id: "cylinder_capacity", label: "P.1. Cylinder capacity (cc)" },
  { id: "fuel_type", label: "P.3. Type of fuel" },
  { id: "engine_number", label: "P.5. Engine number" },
  { id: "colour", label: "R. Colour" },
  { id: "co2_emissions", label: "V.7. CO2 emissions (g/km)" },
  { id: "taxation_class", label: "X. Taxation class" },
  { id: "keeper_name", label: "Registered keeper - Name" },
  { id: "keeper_address", label: "Registered keeper - Address" },
  { id: "keeper_postcode", label: "Registered keeper - Postcode" },
  { id: "v5c_reference", label: "V5C document reference number" }
];

const TEMPLATE_TYPES = {
  uk_driving_licence: {
    name: 'UK Driving Licence',
    fields: UK_FIELDS,
    templateName: 'uk_driving_licence_front_v1',
    filename: 'uk_licence_template.json'
  },
  v5c: {
    name: 'V5C Log Book',
    fields: V5C_FIELDS,
    templateName: 'uk_v5c_logbook_v1',
    filename: 'v5c_template.json'
  }
};

interface Point {
  x: number;
  y: number;
}

export const LicenceTemplateEditor: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [templateType, setTemplateType] = useState<'uk_driving_licence' | 'v5c'>('uk_driving_licence');
  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null);
  const [workingImage, setWorkingImage] = useState<HTMLImageElement | null>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // Stage 1: Corner point selection for card boundary
  const [corners, setCorners] = useState<Point[]>([]);
  const [hoveredCornerIndex, setHoveredCornerIndex] = useState<number | null>(null);
  const [draggingCornerIndex, setDraggingCornerIndex] = useState<number | null>(null);
  const [straightenedImage, setStraightenedImage] = useState<HTMLImageElement | null>(null);
  const [savedNormalizedCorners, setSavedNormalizedCorners] = useState<Point[]>([]);

  // Stage 2: Field selection (after straightening)
  const [fields, setFields] = useState<FieldRect[]>([]);
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
  const [hoveredFieldId, setHoveredFieldId] = useState<string | null>(null);
  const [isDrawingRect, setIsDrawingRect] = useState(false);
  const [rectStart, setRectStart] = useState<Point | null>(null);
  const [rectCurrent, setRectCurrent] = useState<Point | null>(null);

  // Test extraction
  const [testResults, setTestResults] = useState<any>(null);
  const [isTestingExtraction, setIsTestingExtraction] = useState(false);
  const [zoomedFieldImages, setZoomedFieldImages] = useState<Set<string>>(new Set());

  const CORNER_LABELS = ['Top-Left', 'Top-Right', 'Bottom-Right', 'Bottom-Left'];
  const CORNER_RADIUS = 8;

  // Load image
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const img = new Image();
    img.onload = () => {
      setOriginalImage(img);
      setWorkingImage(img);
      setImageSize({ width: img.width, height: img.height });

      // Calculate scale to fit canvas (1000x700 max)
      const maxWidth = 1000;
      const maxHeight = 700;
      const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);

      const canvasWidth = img.width * scale;
      const canvasHeight = img.height * scale;

      setCanvasSize({ width: canvasWidth, height: canvasHeight });
      setScale(scale);
      setOffset({ x: 0, y: 0 });

      // Reset state - keep corner marking enabled
      setStraightenedImage(null);
      setFields([]);
      setActiveFieldId(null);

      // Auto-apply saved normalized corners if they exist
      if (savedNormalizedCorners.length === 4) {
        const denormalizedCorners = savedNormalizedCorners.map(nc => ({
          x: nc.x * img.width,
          y: nc.y * img.height
        }));
        setCorners(denormalizedCorners);
        // Auto-straighten after a brief delay to allow state to update
        setTimeout(() => straightenCard(denormalizedCorners), 100);
      } else {
        setCorners([]);
      }
    };

    img.src = URL.createObjectURL(file);
  };

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  // Check if mouse is near a corner
  const getCornerAtPoint = (point: Point, canvasCorners: Point[]): number | null => {
    for (let i = 0; i < canvasCorners.length; i++) {
      const dx = point.x - canvasCorners[i].x;
      const dy = point.y - canvasCorners[i].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= CORNER_RADIUS * 2) {
        return i;
      }
    }
    return null;
  };

  // Handle mouse events for corner or rectangle drawing
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = getCanvasCoordinates(e);

    if (!straightenedImage && corners.length < 4) {
      // Stage 1: Adding corners
      const imagePoint = canvasToImage({ x: point.x, y: point.y, width: 0, height: 0 }, scale, offset);
      setCorners([...corners, { x: imagePoint.x, y: imagePoint.y }]);

      // If we have 4 corners, trigger straightening
      if (corners.length === 3) {
        setTimeout(() => straightenCard([...corners, { x: imagePoint.x, y: imagePoint.y }]), 100);
      }
    } else if (!straightenedImage && corners.length === 4) {
      // Stage 1: Dragging corners to adjust
      const canvasCorners = corners.map(c => {
        const canvasPoint = imageToCanvas({ x: c.x, y: c.y, width: 0, height: 0 }, scale, offset);
        return { x: canvasPoint.x, y: canvasPoint.y };
      });

      const cornerIndex = getCornerAtPoint(point, canvasCorners);
      if (cornerIndex !== null) {
        setDraggingCornerIndex(cornerIndex);
      }
    } else if (straightenedImage && activeFieldId) {
      // Stage 2: Drawing rectangles for fields
      setIsDrawingRect(true);
      setRectStart(point);
      setRectCurrent(point);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = getCanvasCoordinates(e);

    if (draggingCornerIndex !== null) {
      // Update corner position while dragging
      const imagePoint = canvasToImage({ x: point.x, y: point.y, width: 0, height: 0 }, scale, offset);
      const newCorners = [...corners];
      newCorners[draggingCornerIndex] = { x: imagePoint.x, y: imagePoint.y };
      setCorners(newCorners);
    } else if (isDrawingRect && rectStart) {
      setRectCurrent(point);
    } else if (!straightenedImage && corners.length === 4) {
      // Check for hover over corners
      const canvasCorners = corners.map(c => {
        const canvasPoint = imageToCanvas({ x: c.x, y: c.y, width: 0, height: 0 }, scale, offset);
        return { x: canvasPoint.x, y: canvasPoint.y };
      });

      const cornerIndex = getCornerAtPoint(point, canvasCorners);
      setHoveredCornerIndex(cornerIndex);
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = getCanvasCoordinates(e);

    if (draggingCornerIndex !== null) {
      setDraggingCornerIndex(null);
    } else if (isDrawingRect && rectStart) {
      // Finalize rectangle for field
      const x = Math.min(rectStart.x, point.x);
      const y = Math.min(rectStart.y, point.y);
      const width = Math.abs(point.x - rectStart.x);
      const height = Math.abs(point.y - rectStart.y);

      if (width >= 10 && height >= 10) {
        const imageRect = canvasToImage({ x, y, width, height }, scale, offset);

        const normalizedRect = normalizeRect(imageRect, imageSize.width, imageSize.height);

        const templateConfig = TEMPLATE_TYPES[templateType];
        const fieldDef = templateConfig.fields.find(f => f.id === activeFieldId);
        if (fieldDef) {
          const newField: FieldRect = {
            fieldId: activeFieldId,
            label: fieldDef.label,
            rectCard: imageRect,
            normalizedCard: normalizedRect
          };

          setFields(prev => {
            const existing = prev.findIndex(f => f.fieldId === activeFieldId);
            if (existing >= 0) {
              const updated = [...prev];
              updated[existing] = newField;
              return updated;
            }
            return [...prev, newField];
          });
        }
      }

      setRectStart(null);
      setRectCurrent(null);
      setIsDrawingRect(false);
    }
  };

  // Straighten the card using the 4 corners
  const straightenCard = async (fourCorners: Point[]) => {
    if (!originalImage || fourCorners.length !== 4) return;

    try {
      // Convert image to base64
      const canvas = document.createElement('canvas');
      canvas.width = originalImage.width;
      canvas.height = originalImage.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(originalImage, 0, 0);
      const imageBase64 = canvas.toDataURL('image/png');

      // Call backend API for perspective transform
      const response = await fetch('http://localhost:8000/api/perspective-transform', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_base64: imageBase64,
          corners: fourCorners.map(c => [c.x, c.y])
        }),
      });

      if (!response.ok) {
        throw new Error('Perspective transform failed');
      }

      const data = await response.json();

      // Save normalized corners for future use
      const normalizedCorners = fourCorners.map(c => ({
        x: c.x / originalImage.width,
        y: c.y / originalImage.height
      }));
      setSavedNormalizedCorners(normalizedCorners);

      // Load the straightened image
      const img = new Image();
      img.onload = () => {
        setStraightenedImage(img);
        setWorkingImage(img);
        setImageSize({ width: img.width, height: img.height });

        // Recalculate scale for straightened image
        const maxWidth = 1000;
        const maxHeight = 700;
        const newScale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);

        const canvasWidth = img.width * newScale;
        const canvasHeight = img.height * newScale;

        setCanvasSize({ width: canvasWidth, height: canvasHeight });
        setScale(newScale);
        setOffset({ x: 0, y: 0 });
      };

      img.src = data.straightened_image;
    } catch (error) {
      console.error('Error straightening image:', error);
      alert('Failed to straighten image. Please try again.');
    }
  };

  // Draw on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !workingImage) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw image
    ctx.drawImage(workingImage, offset.x, offset.y, imageSize.width * scale, imageSize.height * scale);

    // Draw corner points and quadrilateral
    if (corners.length > 0 && !straightenedImage) {
      const canvasCorners = corners.map(c => {
        const canvasPoint = imageToCanvas({ x: c.x, y: c.y, width: 0, height: 0 }, scale, offset);
        return { x: canvasPoint.x, y: canvasPoint.y };
      });

      // Draw connecting lines (quadrilateral)
      if (canvasCorners.length > 1) {
        ctx.beginPath();
        ctx.moveTo(canvasCorners[0].x, canvasCorners[0].y);
        for (let i = 1; i < canvasCorners.length; i++) {
          ctx.lineTo(canvasCorners[i].x, canvasCorners[i].y);
        }
        if (canvasCorners.length === 4) {
          ctx.closePath();
        }
        ctx.strokeStyle = '#ef4444'; // red-500
        ctx.lineWidth = 3;
        ctx.stroke();

        // Fill with semi-transparent red
        if (canvasCorners.length === 4) {
          ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
          ctx.fill();
        }
      }

      // Draw corner points
      canvasCorners.forEach((corner, idx) => {
        const isHovered = hoveredCornerIndex === idx;
        const isDragging = draggingCornerIndex === idx;

        // Draw circle
        ctx.beginPath();
        ctx.arc(corner.x, corner.y, CORNER_RADIUS, 0, 2 * Math.PI);
        ctx.fillStyle = isDragging ? '#dc2626' : isHovered ? '#f87171' : '#ef4444'; // red shades
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw label
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.font = 'bold 12px sans-serif';
        const label = `${idx + 1}`;
        ctx.strokeText(label, corner.x - 4, corner.y + 4);
        ctx.fillText(label, corner.x - 4, corner.y + 4);

        // Draw corner name below
        ctx.font = '11px sans-serif';
        const cornerName = CORNER_LABELS[idx];
        const textWidth = ctx.measureText(cornerName).width;
        ctx.strokeText(cornerName, corner.x - textWidth / 2, corner.y + 20);
        ctx.fillText(cornerName, corner.x - textWidth / 2, corner.y + 20);
      });
    }

    // Draw field rectangles (after straightening)
    if (straightenedImage) {
      fields.forEach(field => {
        const canvasFieldRect = imageToCanvas(field.rectCard, scale, offset);

        const isActive = field.fieldId === activeFieldId;
        const isHovered = field.fieldId === hoveredFieldId;

        // Use thick yellow border for hovered fields
        ctx.strokeStyle = isHovered ? '#eab308' : isActive ? '#3b82f6' : '#93c5fd';
        ctx.lineWidth = isHovered ? 4 : isActive ? 2 : 1;
        ctx.strokeRect(canvasFieldRect.x, canvasFieldRect.y, canvasFieldRect.width, canvasFieldRect.height);
        ctx.fillStyle = isActive ? 'rgba(59, 130, 246, 0.15)' : 'rgba(147, 197, 253, 0.1)';
        ctx.fillRect(canvasFieldRect.x, canvasFieldRect.y, canvasFieldRect.width, canvasFieldRect.height);

        // Draw label
        ctx.fillStyle = '#1e40af';
        ctx.font = '12px sans-serif';
        ctx.fillText(field.label, canvasFieldRect.x + 4, canvasFieldRect.y + 14);
      });

      // Draw current rectangle being drawn
      if (isDrawingRect && rectStart && rectCurrent) {
        const x = Math.min(rectStart.x, rectCurrent.x);
        const y = Math.min(rectStart.y, rectCurrent.y);
        const width = Math.abs(rectCurrent.x - rectStart.x);
        const height = Math.abs(rectCurrent.y - rectStart.y);

        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(x, y, width, height);
        ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
        ctx.fillRect(x, y, width, height);
        ctx.setLineDash([]);
      }
    }
  }, [workingImage, corners, hoveredCornerIndex, draggingCornerIndex, fields, isDrawingRect, rectStart, rectCurrent, activeFieldId, hoveredFieldId, scale, offset, imageSize, straightenedImage]);

  // Export JSON
  const handleExport = () => {
    if (!straightenedImage) {
      alert('Please mark 4 corners and straighten the card first');
      return;
    }

    const templateConfig = TEMPLATE_TYPES[templateType];
    const exportData: TemplateExport = {
      templateName: templateConfig.templateName,
      imageSize: imageSize,
      cardRect: {
        absolute: { x: 0, y: 0, width: imageSize.width, height: imageSize.height },
        normalized: { x: 0, y: 0, width: 1, height: 1 }
      },
      fields: fields
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = templateConfig.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Load Template from Backend
  const handleLoadTemplate = async () => {
    const templateConfig = TEMPLATE_TYPES[templateType];

    try {
      const response = await fetch(`http://localhost:8000/api/template/load?filename=${templateConfig.filename}`);
      const result = await response.json();

      if (result.success && result.template) {
        // Load the template fields
        setFields(result.template.fields || []);

        // Load saved normalized corners if they exist
        if (result.template.normalizedCorners && result.template.normalizedCorners.length === 4) {
          setSavedNormalizedCorners(result.template.normalizedCorners);
        }

        alert(`Template loaded successfully from ${templateConfig.filename}. Found ${result.template.fields?.length || 0} fields.${result.template.normalizedCorners ? ' Auto-crop enabled.' : ''}`);
      } else {
        alert(`No saved template found for ${templateConfig.filename}. Please create and save one first.`);
      }
    } catch (error) {
      console.error('Load template error:', error);
      alert(`Error loading template: ${error}`);
    }
  };

  // Save Template to Backend
  const handleSaveTemplate = async () => {
    if (!straightenedImage) {
      alert('Please mark 4 corners and straighten the card first');
      return;
    }

    const templateConfig = TEMPLATE_TYPES[templateType];
    const templateData = {
      templateName: templateConfig.templateName,
      imageSize: imageSize,
      cardRect: {
        absolute: { x: 0, y: 0, width: imageSize.width, height: imageSize.height },
        normalized: { x: 0, y: 0, width: 1, height: 1 }
      },
      fields: fields,
      normalizedCorners: savedNormalizedCorners  // Save the crop region
    };

    try {
      const response = await fetch('http://localhost:8000/api/template/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template: templateData,
          filename: templateConfig.filename
        })
      });

      const result = await response.json();

      if (result.success) {
        alert(`Template saved successfully to ${templateConfig.filename}`);
      } else {
        alert(`Failed to save template: ${result.message}`);
      }
    } catch (error) {
      console.error('Save template error:', error);
      alert(`Error saving template: ${error}`);
    }
  };

  // Test extraction with current image
  const handleTestExtraction = async () => {
    if (!originalImage) {
      alert('Please upload an image first');
      return;
    }

    if (!straightenedImage) {
      alert('Please straighten the card first by marking corners');
      return;
    }

    setIsTestingExtraction(true);
    setTestResults(null);

    try {
      // Convert straightened image to blob
      const canvas = document.createElement('canvas');
      canvas.width = straightenedImage.width;
      canvas.height = straightenedImage.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      ctx.drawImage(straightenedImage, 0, 0);

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.95);
      });

      // Build template JSON with marked fields
      const templateJson = {
        templateName: `${templateType}_template_v1`,
        imageSize: {
          width: straightenedImage?.width || originalImage.width,
          height: straightenedImage?.height || originalImage.height
        },
        cardRect: {
          absolute: {
            x: 0,
            y: 0,
            width: straightenedImage?.width || originalImage.width,
            height: straightenedImage?.height || originalImage.height
          },
          normalized: { x: 0, y: 0, width: 1, height: 1 }
        },
        fields: fields
      };

      // Create form data
      const formData = new FormData();
      formData.append('file', blob, 'test-document.jpg');
      formData.append('template', JSON.stringify(templateJson));
      formData.append('document_type', templateType); // Pass document type (uk_driving_licence or v5c)

      // Call the document extraction API (using upload-and-extract without session)
      const response = await fetch('http://localhost:8000/api/document/upload-and-extract', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail?.error || 'Extraction failed');
      }

      const result = await response.json();

      // Transform the response to match our expected format
      const transformedResult = {
        success: result.success,
        document_type: result.document_type,
        confidence: result.confidence,
        extracted_data: result.extracted_fields || {},
        field_confidences: result.field_confidences || {},  // Include per-field confidences
        validations: result.validations || {},  // Include validation results
        field_images: result.field_images || {},  // Include field images
        debug_url: result.debug_urls?.[0] || null
      };

      console.log('Extraction results with validations:', transformedResult);
      setTestResults(transformedResult);
      setZoomedFieldImages(new Set()); // Reset zoom state when new results load
    } catch (error: any) {
      alert(`Extraction failed: ${error.message}`);
      console.error('Test extraction error:', error);
    } finally {
      setIsTestingExtraction(false);
    }
  };

  // Delete field
  const handleDeleteField = (fieldId: string) => {
    setFields(prev => prev.filter(f => f.fieldId !== fieldId));
    if (activeFieldId === fieldId) {
      setActiveFieldId(null);
    }
  };

  // Reset corners
  const handleResetCorners = () => {
    setCorners([]);
    setStraightenedImage(null);
    setWorkingImage(originalImage);
    setFields([]);
    setActiveFieldId(null);

    if (originalImage) {
      setImageSize({ width: originalImage.width, height: originalImage.height });
      const maxWidth = 1000;
      const maxHeight = 700;
      const newScale = Math.min(maxWidth / originalImage.width, maxHeight / originalImage.height, 1);
      setCanvasSize({ width: originalImage.width * newScale, height: originalImage.height * newScale });
      setScale(newScale);
    }
  };

  // Trigger straightening manually
  const handleStraighten = () => {
    if (corners.length === 4) {
      straightenCard(corners);
    }
  };

  // Zoom controls
  const handleZoomIn = () => {
    const newScale = Math.min(scale * 1.2, 3); // Max 3x zoom
    setScale(newScale);
    if (straightenedImage) {
      setCanvasSize({
        width: imageSize.width * newScale,
        height: imageSize.height * newScale
      });
    }
  };

  const handleZoomOut = () => {
    const newScale = Math.max(scale / 1.2, 0.1); // Min 0.1x zoom
    setScale(newScale);
    if (straightenedImage) {
      setCanvasSize({
        width: imageSize.width * newScale,
        height: imageSize.height * newScale
      });
    }
  };

  const handleZoomReset = () => {
    if (straightenedImage) {
      const maxWidth = 1000;
      const maxHeight = 700;
      const newScale = Math.min(maxWidth / imageSize.width, maxHeight / imageSize.height, 1);
      setScale(newScale);
      setCanvasSize({
        width: imageSize.width * newScale,
        height: imageSize.height * newScale
      });
    }
  };

  // Toggle zoom for field bitmap images
  const toggleFieldImageZoom = (fieldKey: string) => {
    setZoomedFieldImages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fieldKey)) {
        newSet.delete(fieldKey);
      } else {
        newSet.add(fieldKey);
      }
      return newSet;
    });
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Main canvas area */}
      <div className="flex-1 flex flex-col p-4">
        <div className="mb-4 flex gap-4 items-center flex-wrap">
          <select
            value={templateType}
            onChange={(e) => setTemplateType(e.target.value as 'uk_driving_licence' | 'v5c')}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:border-blue-500"
          >
            <option value="uk_driving_licence">UK Driving Licence</option>
            <option value="v5c">V5C Log Book</option>
          </select>

          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="block text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-white focus:outline-none px-3 py-2"
          />

          {savedNormalizedCorners.length === 4 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-green-700 bg-green-100 px-3 py-2 rounded-lg border border-green-300 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Auto-crop enabled
              </span>
              <button
                onClick={() => setSavedNormalizedCorners([])}
                className="text-xs px-3 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                title="Clear saved crop region"
              >
                Clear
              </button>
            </div>
          )}

          {corners.length > 0 && !straightenedImage && (
            <>
              <button
                onClick={handleResetCorners}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Reset Corners ({corners.length}/4)
              </button>
              {corners.length === 4 && (
                <button
                  onClick={handleStraighten}
                  className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
                >
                  Straighten Card
                </button>
              )}
            </>
          )}

          {straightenedImage && (
            <button
              onClick={handleResetCorners}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Restart (Re-mark Corners)
            </button>
          )}

          <button
            onClick={handleLoadTemplate}
            disabled={!straightenedImage}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Load Template
          </button>

          <button
            onClick={handleSaveTemplate}
            disabled={!straightenedImage || fields.length === 0}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Save Template
          </button>

          <button
            onClick={handleExport}
            disabled={!straightenedImage || fields.length === 0}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Download JSON Template
          </button>

          {/* Zoom controls */}
          {straightenedImage && (
            <div className="flex gap-2 items-center border-l pl-4 ml-2">
              <span className="text-sm text-gray-600">Zoom:</span>
              <button
                onClick={handleZoomOut}
                className="px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 font-bold"
                title="Zoom Out"
              >
                -
              </button>
              <button
                onClick={handleZoomReset}
                className="px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-xs"
                title="Reset Zoom"
              >
                {Math.round(scale * 100)}%
              </button>
              <button
                onClick={handleZoomIn}
                className="px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 font-bold"
                title="Zoom In"
              >
                +
              </button>
            </div>
          )}

          <button
            onClick={handleTestExtraction}
            disabled={!originalImage || isTestingExtraction}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {isTestingExtraction ? 'Testing...' : 'Test Extraction'}
          </button>
        </div>

        <div className="flex-1 bg-white rounded-lg shadow-lg p-4 overflow-auto">
          {!workingImage ? (
            <div className="h-full flex items-center justify-center text-gray-400">
              <div className="text-center">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="mt-2">Upload an image to get started</p>
              </div>
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              width={canvasSize.width}
              height={canvasSize.height}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              className="border border-gray-300 cursor-crosshair"
            />
          )}
        </div>

        {workingImage && !straightenedImage && (
          <div className="mt-4 p-4 bg-orange-50 rounded-lg">
            <h3 className="font-semibold text-orange-900 mb-2">Stage 1: Mark Card Corners</h3>
            <p className="text-sm text-orange-800">
              Click on the 4 corners of the licence card to mark them:<br />
              1. Top-Left corner<br />
              2. Top-Right corner<br />
              3. Bottom-Right corner<br />
              4. Bottom-Left corner<br />
              <span className="font-semibold">Corners marked: {corners.length}/4</span>
              {corners.length === 4 && <span className="block mt-2 text-orange-900 font-bold">✓ All corners marked! Click "Straighten Card" or wait...</span>}
            </p>
          </div>
        )}

        {straightenedImage && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">Stage 2: Mark Fields</h3>
            <p className="text-sm text-blue-800">
              1. Select a field from the right panel<br />
              2. Draw a rectangle around that field<br />
              3. Repeat for all fields<br />
              4. Click "Download JSON Template" when done
            </p>
          </div>
        )}
      </div>

      {/* Side panel */}
      <div className="w-80 bg-white shadow-lg p-6 overflow-y-auto">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">UK Licence Fields</h2>

        {!straightenedImage ? (
          <div className="p-4 bg-orange-50 rounded-lg border-2 border-orange-200">
            <p className="text-orange-900 font-medium">Step 1: Mark Corners</p>
            <p className="text-orange-700 text-sm mt-2">
              Click on the 4 corners of the licence card in order. The card will be automatically straightened.
            </p>
            <div className="mt-4 space-y-2">
              {CORNER_LABELS.map((label, idx) => (
                <div
                  key={idx}
                  className={`p-2 rounded flex items-center gap-2 ${
                    idx < corners.length
                      ? 'bg-green-100 text-green-800'
                      : idx === corners.length
                      ? 'bg-orange-100 text-orange-800 font-semibold'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    idx < corners.length ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'
                  }`}>
                    {idx + 1}
                  </div>
                  {label} {idx < corners.length && '✓'}
                </div>
              ))}
            </div>
            {corners.length === 4 && (
              <div className="mt-4">
                <button
                  onClick={handleStraighten}
                  className="w-full px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 font-semibold"
                >
                  ▶ Straighten Card
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {TEMPLATE_TYPES[templateType].fields.map(field => {
              const existingField = fields.find(f => f.fieldId === field.id);
              const isActive = activeFieldId === field.id;

              return (
                <div
                  key={field.id}
                  className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    isActive
                      ? 'border-blue-500 bg-blue-50'
                      : existingField
                      ? 'border-green-300 bg-green-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                  onClick={() => setActiveFieldId(field.id)}
                  onMouseEnter={() => setHoveredFieldId(field.id)}
                  onMouseLeave={() => setHoveredFieldId(null)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{field.label}</p>
                      {existingField && (
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-xs text-green-600">
                            ✓ Defined ({Math.round(existingField.rectCard.width)} × {Math.round(existingField.rectCard.height)}px)
                          </p>
                          <select
                            value={existingField.extractionType || 'text'}
                            onChange={(e) => {
                              e.stopPropagation();
                              const newType = e.target.value as 'text' | 'image' | 'both';
                              setFields(fields.map(f =>
                                f.fieldId === field.id
                                  ? { ...f, extractionType: newType }
                                  : f
                              ));
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs px-2 py-1 border border-gray-300 rounded bg-white"
                          >
                            <option value="text">Text (OCR)</option>
                            <option value="image">Image Only</option>
                            <option value="both">Both</option>
                          </select>
                        </div>
                      )}
                    </div>
                    {existingField && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteField(field.id);
                        }}
                        className="ml-2 p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold text-gray-700 mb-2">Progress</h3>
          {!straightenedImage ? (
            <p className="text-sm text-gray-600">
              Corners marked: <span className="font-bold text-gray-900">{corners.length}</span> / 4
            </p>
          ) : (
            <p className="text-sm text-gray-600">
              Fields defined: <span className="font-bold text-gray-900">{fields.length}</span> / {UK_FIELDS.length}
            </p>
          )}
        </div>

        {/* Test Extraction Results with Enhanced UI */}
        {testResults && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-blue-900">Test Extraction Results</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    // Save corrections back to results
                    if (window.confirm('Save corrections?')) {
                      console.log('Saved corrections:', testResults.extracted_data);
                      alert('Corrections saved to console');
                    }
                  }}
                  className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                >
                  Save
                </button>
                <button
                  onClick={() => setTestResults(null)}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  Clear
                </button>
              </div>
            </div>

            {testResults.success ? (
              <div className="space-y-3">
                {/* Confidence Meter with Visual Bar */}
                <div className="bg-white p-3 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-700">Overall Confidence:</span>
                      <span className={`text-lg font-bold ${
                        (testResults.confidence || 0) >= 0.8 ? 'text-green-600' :
                        (testResults.confidence || 0) >= 0.5 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {((testResults.confidence || 0) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {testResults.document_type || 'Unknown Document'}
                    </span>
                  </div>

                  {/* Confidence Bar */}
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        (testResults.confidence || 0) >= 0.8 ? 'bg-green-500' :
                        (testResults.confidence || 0) >= 0.5 ? 'bg-yellow-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${(testResults.confidence || 0) * 100}%` }}
                    />
                  </div>

                  <p className="text-xs text-gray-600 mt-2">
                    {(testResults.confidence || 0) >= 0.8 ? '✓ High confidence - Ready to use' :
                     (testResults.confidence || 0) >= 0.5 ? '⚠ Medium confidence - Review recommended' :
                     '✗ Low confidence - Manual review required'}
                  </p>
                </div>

                <div className="border-t border-blue-200 pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-blue-900 text-sm">Extracted Fields (Editable):</h4>
                    <span className="text-xs text-gray-500">Click any field to edit</span>
                  </div>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {Object.entries(testResults.extracted_data || {}).map(([key, value]) => {
                      const hasImage = testResults.field_images && testResults.field_images[key];
                      const fieldConfidence = testResults.field_confidences?.[key] || testResults.confidence || 0.5;

                      // Determine confidence color
                      const confidenceBg = fieldConfidence >= 0.8 ? 'bg-green-50 border-green-200' :
                                          fieldConfidence >= 0.5 ? 'bg-yellow-50 border-yellow-200' :
                                          'bg-red-50 border-red-200';
                      const confidenceText = fieldConfidence >= 0.8 ? 'text-green-700' :
                                            fieldConfidence >= 0.5 ? 'text-yellow-700' :
                                            'text-red-700';

                      return (
                        <div key={key} className={`p-3 rounded border-2 ${confidenceBg}`}>
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-semibold text-gray-600 uppercase">{key.replace(/_/g, ' ')}</p>
                            <span className={`text-xs font-bold ${confidenceText}`}>
                              {(fieldConfidence * 100).toFixed(0)}%
                            </span>
                          </div>

                          {/* Editable Input Field */}
                          <input
                            type="text"
                            defaultValue={String(value) || ''}
                            onChange={(e) => {
                              // Update the testResults in place
                              testResults.extracted_data[key] = e.target.value;
                            }}
                            className="w-full px-2 py-1 text-sm bg-white border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="(empty)"
                          />

                          {/* Validation warnings and suggestions from backend */}
                          {testResults.validations && testResults.validations[key] && (
                            <>
                              {testResults.validations[key].warning && (
                                <div className="mt-1 p-2 bg-yellow-50 border border-yellow-200 rounded">
                                  <p className="text-xs text-yellow-800">
                                    ⚠ {testResults.validations[key].warning}
                                  </p>
                                </div>
                              )}
                              {testResults.validations[key].suggestions && testResults.validations[key].suggestions.length > 0 && (
                                <div className="mt-1 flex items-center gap-1 flex-wrap">
                                  <span className="text-xs text-gray-500">Suggestions:</span>
                                  {testResults.validations[key].suggestions.map((suggestion: string, idx: number) => (
                                    <button
                                      key={idx}
                                      onClick={() => {
                                        const inputs = document.querySelectorAll('input');
                                        inputs.forEach((input) => {
                                          if (input.defaultValue === String(value)) {
                                            input.value = suggestion;
                                            testResults.extracted_data[key] = suggestion;
                                          }
                                        });
                                      }}
                                      className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                                    >
                                      {suggestion}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </>
                          )}

                          {hasImage && (
                            <div className="mt-2 border-t border-gray-200 pt-2">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-xs text-gray-500">OCR Source Image:</p>
                                <button
                                  onClick={() => toggleFieldImageZoom(key)}
                                  className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 flex items-center gap-1"
                                  title={zoomedFieldImages.has(key) ? "Shrink image" : "Zoom image"}
                                >
                                  {zoomedFieldImages.has(key) ? (
                                    <>
                                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                                      </svg>
                                      Shrink
                                    </>
                                  ) : (
                                    <>
                                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                                      </svg>
                                      Zoom
                                    </>
                                  )}
                                </button>
                              </div>
                              <div
                                className="overflow-auto border border-gray-300 rounded bg-white cursor-pointer"
                                onClick={() => toggleFieldImageZoom(key)}
                                style={{
                                  maxHeight: zoomedFieldImages.has(key) ? '400px' : '120px',
                                  transition: 'max-height 0.3s ease'
                                }}
                              >
                                <img
                                  src={testResults.field_images[key]}
                                  alt={`${key} image`}
                                  className="h-auto"
                                  style={{
                                    width: zoomedFieldImages.has(key) ? 'auto' : '100%',
                                    minWidth: zoomedFieldImages.has(key) ? '600px' : 'auto',
                                    imageRendering: zoomedFieldImages.has(key) ? 'pixelated' : 'auto'
                                  }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Show image-only fields that don't have text */}
                    {testResults.field_images && Object.entries(testResults.field_images).filter(([key]) => !testResults.extracted_data[key]).map(([key, imageUrl]) => (
                      <div key={key} className="bg-gray-50 p-3 rounded border-2 border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold text-gray-600 uppercase">{key.replace(/_/g, ' ')} (image only)</p>
                          <button
                            onClick={() => toggleFieldImageZoom(key)}
                            className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 flex items-center gap-1"
                            title={zoomedFieldImages.has(key) ? "Shrink image" : "Zoom image"}
                          >
                            {zoomedFieldImages.has(key) ? (
                              <>
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                                </svg>
                                Shrink
                              </>
                            ) : (
                              <>
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                                </svg>
                                Zoom
                              </>
                            )}
                          </button>
                        </div>
                        <div
                          className="overflow-auto border border-gray-300 rounded bg-white cursor-pointer"
                          onClick={() => toggleFieldImageZoom(key)}
                          style={{
                            maxHeight: zoomedFieldImages.has(key) ? '400px' : '120px',
                            transition: 'max-height 0.3s ease'
                          }}
                        >
                          <img
                            src={imageUrl as string}
                            alt={`${key} image`}
                            className="h-auto"
                            style={{
                              width: zoomedFieldImages.has(key) ? 'auto' : '100%',
                              minWidth: zoomedFieldImages.has(key) ? '600px' : 'auto',
                              imageRendering: zoomedFieldImages.has(key) ? 'pixelated' : 'auto'
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {testResults.debug_url && (
                  <div className="border-t border-blue-200 pt-3">
                    <a
                      href={testResults.debug_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-800 underline"
                    >
                      View debug image ↗
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm">
                <p className="text-red-700 font-medium">✗ Extraction failed</p>
                {testResults.error && (
                  <p className="text-gray-700 mt-2">{testResults.error}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
