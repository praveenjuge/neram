// swift-tools-version: 6.2

import PackageDescription

let package = Package(
  name: "NeramKit",
  platforms: [.iOS(.v26), .macOS(.v26)],
  products: [
    .library(name: "NeramKit", targets: ["NeramKit"])
  ],
  dependencies: [
    .package(url: "https://github.com/get-convex/convex-swift", exact: "0.8.1"),
    .package(url: "https://github.com/clerk/clerk-ios", exact: "1.6.1"),
  ],
  targets: [
    .target(
      name: "NeramKit",
      dependencies: [
        .product(name: "ConvexMobile", package: "convex-swift"),
        .product(name: "ClerkKit", package: "clerk-ios"),
      ]
    ),
    .testTarget(
      name: "NeramKitTests",
      dependencies: ["NeramKit"]
    ),
  ]
)
