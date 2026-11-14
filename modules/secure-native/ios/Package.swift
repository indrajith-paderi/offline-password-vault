// swift-tools-version:5.9
import PackageDescription

let package = Package(
  name: "SecureNativeCore",
  platforms: [.macOS(.v13), .iOS(.v16)],
  targets: [
    .target(name: "SecureNativeCore", path: "Sources/SecureNativeCore"),
    .testTarget(
      name: "SecureNativeCoreTests",
      dependencies: ["SecureNativeCore"],
      path: "Tests/SecureNativeCoreTests"
    ),
  ]
)
