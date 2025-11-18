import Foundation
import Vision
import CoreImage
import AppKit

// MARK: - Data Models

struct Output: Codable {
    var success: Bool
    var document_type: String
    var extracted_fields: [String: String]
    var confidence: Double
    var raw_text: String
    var error: String?
}

struct TemplateField: Codable {
    var fieldId: String
    var label: String?
    var normalizedCard: NormalizedRect
}

struct NormalizedRect: Codable {
    var x: Double
    var y: Double
    var width: Double
    var height: Double
}

struct CustomTemplate: Codable {
    var templateName: String
    var fields: [TemplateField]
}

// MARK: - Image Loading

func loadCGImage(at path: String) throws -> CGImage {
    let url = URL(fileURLWithPath: path)
    guard let img = NSImage(contentsOf: url) else {
        throw NSError(domain: "vision-ocr", code: 1, userInfo: [NSLocalizedDescriptionKey: "Cannot load image"])
    }
    var rect = CGRect(origin: .zero, size: img.size)
    guard let cg = img.cgImage(forProposedRect: &rect, context: nil, hints: nil) else {
        throw NSError(domain: "vision-ocr", code: 2, userInfo: [NSLocalizedDescriptionKey: "Cannot get CGImage"])
    }
    return cg
}

// MARK: - Region-based OCR

func recognizeText(from cg: CGImage, in normalizedRect: CGRect) throws -> String {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.recognitionLanguages = ["en-GB", "en"]
    request.usesLanguageCorrection = false  // Disable for dot-matrix fonts

    // Set region of interest
    request.regionOfInterest = normalizedRect

    let handler = VNImageRequestHandler(cgImage: cg, options: [:])
    try handler.perform([request])

    let observations = request.results ?? []
    let lines = observations.compactMap { $0.topCandidates(1).first?.string }
    return lines.joined(separator: " ").trimmingCharacters(in: .whitespacesAndNewlines)
}

func upscaleImage(_ image: CGImage, scale: CGFloat) -> CGImage? {
    let width = Int(CGFloat(image.width) * scale)
    let height = Int(CGFloat(image.height) * scale)

    let colorSpace = CGColorSpaceCreateDeviceRGB()
    let bitmapInfo = CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue)

    guard let context = CGContext(
        data: nil,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: 0,
        space: colorSpace,
        bitmapInfo: bitmapInfo.rawValue
    ) else {
        return nil
    }

    // Use high quality interpolation
    context.interpolationQuality = .high
    context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))

    return context.makeImage()
}

func recognizeFullTextFromCropped(from cg: CGImage) throws -> String {
    // Debug: Log the actual image dimensions we received
    fputs("[TRACE]   recognizeFullTextFromCropped called with image dimensions: \(cg.width)x\(cg.height)px\n", stderr)

    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.recognitionLanguages = ["en-GB", "en"]
    request.usesLanguageCorrection = false  // Disable for dot-matrix fonts

    // Upscale small images for better OCR (3x for images with height < 20px)
    var imageToProcess = cg
    fputs("[TRACE]   Checking if height (\(cg.height)) < 20...\n", stderr)
    if cg.height < 20 {
        fputs("[TRACE]   Image too small (height=\(cg.height)px), upscaling 3x for better OCR\n", stderr)
        if let upscaled = upscaleImage(cg, scale: 3.0) {
            imageToProcess = upscaled
            fputs("[TRACE]   Upscaled to \(upscaled.width)x\(upscaled.height)px\n", stderr)
        }
    }

    // Process the entire cropped image (no region of interest needed)
    let handler = VNImageRequestHandler(cgImage: imageToProcess, options: [:])
    try handler.perform([request])

    let observations = request.results ?? []
    let lines = observations.compactMap { $0.topCandidates(1).first?.string }
    return lines.joined(separator: " ").trimmingCharacters(in: .whitespacesAndNewlines)
}

func recognizeFullText(from cg: CGImage) throws -> String {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.recognitionLanguages = ["en-GB", "en"]
    request.usesLanguageCorrection = true

    let handler = VNImageRequestHandler(cgImage: cg, options: [:])
    try handler.perform([request])

    let observations = request.results ?? []
    let lines = observations.compactMap { $0.topCandidates(1).first?.string }
    return lines.joined(separator: "\n")
}

// MARK: - CLI

let args = CommandLine.arguments
var inputPath: String?
var templatePath: String?
var docType: String = "uk_driving_licence"

var i = 1
while i < args.count {
    let a = args[i]
    if a == "--input", i + 1 < args.count {
        inputPath = args[i + 1]
        i += 2
        continue
    }
    if a == "--template", i + 1 < args.count {
        templatePath = args[i + 1]
        i += 2
        continue
    }
    if a == "--type", i + 1 < args.count {
        docType = args[i + 1]
        i += 2
        continue
    }
    i += 1
}

// If template is provided, use template name as document type
if let templatePath = templatePath {
    do {
        let templateData = try Data(contentsOf: URL(fileURLWithPath: templatePath))
        let template = try JSONDecoder().decode(CustomTemplate.self, from: templateData)
        docType = template.templateName
    } catch {
        // Ignore error, use docType from --type flag
    }
}

func fail(_ message: String) -> Never {
    let out = Output(
        success: false,
        document_type: docType,
        extracted_fields: [:],
        confidence: 0.0,
        raw_text: "",
        error: message
    )
    let data = try! JSONEncoder().encode(out)
    FileHandle.standardOutput.write(data)
    exit(1)
}

guard let path = inputPath else { fail("Missing --input") }

do {
    let cg = try loadCGImage(at: path)
    let imageSize = CGSize(width: cg.width, height: cg.height)

    var extractedFields: [String: String] = [:]
    var rawText = ""

    // If template is provided, use region-based extraction
    if let templatePath = templatePath {
        let templateData = try Data(contentsOf: URL(fileURLWithPath: templatePath))
        let template = try JSONDecoder().decode(CustomTemplate.self, from: templateData)

        // Update doc type from template
        docType = template.templateName

        // Extract each field using its normalized coordinates
        for field in template.fields {
            let norm = field.normalizedCard

            // TRACE: Log field extraction attempt
            fputs("[TRACE] Extracting field '\(field.fieldId)' (\(field.label ?? "no label"))\n", stderr)
            fputs("[TRACE]   Normalized rect: x=\(norm.x), y=\(norm.y), w=\(norm.width), h=\(norm.height)\n", stderr)

            // Convert normalized coordinates to Vision's coordinate system
            // Vision uses bottom-left origin, normalized 0-1
            let visionRect = CGRect(
                x: norm.x,
                y: 1.0 - norm.y - norm.height,  // Flip Y axis
                width: norm.width,
                height: norm.height
            )

            fputs("[TRACE]   Vision rect (bottom-left origin): x=\(visionRect.origin.x), y=\(visionRect.origin.y), w=\(visionRect.width), h=\(visionRect.height)\n", stderr)

            // Convert to pixel coordinates for bitmap extraction
            let pixelRect = CGRect(
                x: visionRect.origin.x * CGFloat(cg.width),
                y: visionRect.origin.y * CGFloat(cg.height),
                width: visionRect.width * CGFloat(cg.width),
                height: visionRect.height * CGFloat(cg.height)
            )

            fputs("[TRACE]   Pixel rect (bottom-left): x=\(pixelRect.origin.x), y=\(pixelRect.origin.y), w=\(pixelRect.width), h=\(pixelRect.height)\n", stderr)

            // Convert pixelRect back to top-left origin for CGImage cropping
            // CGImage uses top-left origin, but pixelRect is in bottom-left (Vision) coordinates
            let cgImageRect = CGRect(
                x: pixelRect.origin.x,
                y: CGFloat(cg.height) - pixelRect.origin.y - pixelRect.height,  // Flip Y back to top-left
                width: pixelRect.width,
                height: pixelRect.height
            )

            fputs("[TRACE]   CGImage rect (top-left): x=\(cgImageRect.origin.x), y=\(cgImageRect.origin.y), w=\(cgImageRect.width), h=\(cgImageRect.height)\n", stderr)

            // Crop the field region and save bitmap
            guard let croppedImage = cg.cropping(to: cgImageRect) else {
                fputs("[TRACE]   ✗ Failed to crop image\n", stderr)
                continue
            }

            // Save field bitmap to debug_images directory
            let debugDir = URL(fileURLWithPath: FileManager.default.currentDirectoryPath).appendingPathComponent("debug_images")
            try? FileManager.default.createDirectory(at: debugDir, withIntermediateDirectories: true)

            let filename = debugDir.appendingPathComponent("field_\(field.fieldId).png")
            let destination = CGImageDestinationCreateWithURL(filename as CFURL, kUTTypePNG, 1, nil)
            if let dest = destination {
                CGImageDestinationAddImage(dest, croppedImage, nil)
                CGImageDestinationFinalize(dest)
                fputs("[TRACE]   Saved field bitmap to: \(filename.path)\n", stderr)
            }

            do {
                // OCR the cropped bitmap directly, not the full image with region of interest
                // This gives better results for small text fields
                let text = try recognizeFullTextFromCropped(from: croppedImage)
                fputs("[TRACE]   OCR result: '\(text)'\n", stderr)
                if !text.isEmpty {
                    extractedFields[field.fieldId] = text
                    rawText += "\(field.fieldId): \(text)\n"
                    fputs("[TRACE]   ✓ Field extracted successfully\n", stderr)
                } else {
                    fputs("[TRACE]   ✗ OCR returned empty text\n", stderr)
                }
            } catch {
                // Field extraction failed, continue with others
                fputs("[TRACE]   ✗ OCR failed with error: \(error.localizedDescription)\n", stderr)
                continue
            }
        }

        // Calculate confidence based on successful extractions
        let successRate = Double(extractedFields.count) / Double(template.fields.count)
        let confidence = min(0.95, max(0.5, successRate))

        let out = Output(
            success: true,
            document_type: docType,
            extracted_fields: extractedFields,
            confidence: confidence,
            raw_text: rawText,
            error: nil
        )
        let data = try JSONEncoder().encode(out)
        FileHandle.standardOutput.write(data)

    } else {
        // No template - do full document OCR (legacy behavior)
        rawText = try recognizeFullText(from: cg)

        // Simple field extraction for UK driving licence
        var fields: [String: String] = [:]

        // Licence number pattern
        if let match = rawText.replacingOccurrences(of: " ", with: "")
            .range(of: #"[A-Z]{5}\d{6}[A-Z]{2}\d{3}"#, options: .regularExpression) {
            fields["licence_number"] = String(rawText.replacingOccurrences(of: " ", with: "")[match])
        }

        // Extract names (first 2 lines with only letters)
        let lines = rawText.split(separator: "\n")
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }

        var nameLines: [String] = []
        for line in lines {
            if line.range(of: #"^[A-Za-z][A-Za-z '\-]*$"#, options: .regularExpression) != nil {
                nameLines.append(String(line))
            }
            if nameLines.count >= 2 { break }
        }

        if nameLines.count >= 1 { fields["surname"] = nameLines[0] }
        if nameLines.count >= 2 { fields["first_names"] = nameLines[1] }

        let confidence = fields.isEmpty ? 0.5 : 0.8

        let out = Output(
            success: true,
            document_type: docType,
            extracted_fields: fields,
            confidence: confidence,
            raw_text: rawText,
            error: nil
        )
        let data = try JSONEncoder().encode(out)
        FileHandle.standardOutput.write(data)
    }

    exit(0)

} catch {
    fail(error.localizedDescription)
}
