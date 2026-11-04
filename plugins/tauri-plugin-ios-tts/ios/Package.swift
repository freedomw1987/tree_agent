// swift-tools-version:5.5
import PackageDescription

let package = Package(
    name: "tauri-plugin-ios-tts",
    platforms: [.macOS(.v10_13), .iOS(.v15)],
    products: [
        .library(name: "tauri-plugin-ios-tts", type: .static, targets: ["tauri-plugin-ios-tts"])
    ],
    dependencies: [.package(name: "Tauri", path: "../.tauri/tauri-api")],
    targets: [
        .target(
            name: "tauri-plugin-ios-tts",
            dependencies: [.byName(name: "Tauri")],
            path: "Sources")
    ]
)
