// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "vision-ocr",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .executable(name: "vision-ocr", targets: ["VisionOCR"])
    ],
    targets: [
        .executableTarget(
            name: "VisionOCR",
            path: "Sources",
            linkerSettings: [
                .linkedFramework("Vision"),
                .linkedFramework("CoreImage"),
                .linkedFramework("AppKit", .when(platforms: [.macOS]))
            ]
        )
    ]
)


