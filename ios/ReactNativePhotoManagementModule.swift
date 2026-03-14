import ExpoModulesCore
import Photos
import Vision

public class ReactNativePhotoManagementModule: Module {
  private let processingQueue = DispatchQueue(
    label: "com.reactnativephotomanagement.processing",
    qos: .userInitiated,
    attributes: .concurrent
  )
  private let semaphore = DispatchSemaphore(value: 8)

  public func definition() -> ModuleDefinition {
    Name("ReactNativePhotoManagement")

    AsyncFunction("getAssetInfoBatch") { (assetIds: [String], promise: Promise) in
      self.fetchAssetInfoBatch(assetIds: assetIds, promise: promise)
    }

    AsyncFunction("classifyImageBatch") { (assetIds: [String], options: ClassificationOptions, promise: Promise) in
      self.classifyImageBatch(
        assetIds: assetIds,
        confidenceThreshold: options.confidenceThreshold,
        maxLabels: options.maxLabels,
        promise: promise
      )
    }
  }

  private func fetchAssetInfoBatch(assetIds: [String], promise: Promise) {
    DispatchQueue.global(qos: .userInitiated).async {
      let fetchResult = PHAsset.fetchAssets(withLocalIdentifiers: assetIds, options: nil)

      var assetsByIdentifier: [String: PHAsset] = [:]
      fetchResult.enumerateObjects { asset, _, _ in
        assetsByIdentifier[asset.localIdentifier] = asset
      }

      var results: [[String: Any?]] = []
      results.reserveCapacity(assetIds.count)

      for assetId in assetIds {
        guard let asset = assetsByIdentifier[assetId] else {
          continue
        }

        var info: [String: Any?] = [
          "id": asset.localIdentifier,
          "uri": "ph://\(asset.localIdentifier)",
          "creationTime": (asset.creationDate?.timeIntervalSince1970 ?? 0) * 1000,
          "modificationTime": (asset.modificationDate?.timeIntervalSince1970 ?? 0) * 1000,
          "width": asset.pixelWidth,
          "height": asset.pixelHeight,
          "mediaType": self.mediaTypeToString(asset.mediaType),
          "duration": asset.duration,
        ]

        if let location = asset.location {
          info["location"] = [
            "latitude": location.coordinate.latitude,
            "longitude": location.coordinate.longitude,
            "altitude": location.altitude,
            "speed": location.speed,
            "heading": location.course,
          ]
        } else {
          info["location"] = nil
        }

        results.append(info)
      }

      DispatchQueue.main.async {
        promise.resolve(results)
      }
    }
  }

  private func classifyImageBatch(
    assetIds: [String],
    confidenceThreshold: Float,
    maxLabels: Int,
    promise: Promise
  ) {
    processingQueue.async {
      let fetchResult = PHAsset.fetchAssets(withLocalIdentifiers: assetIds, options: nil)

      var assetsByIdentifier: [String: PHAsset] = [:]
      fetchResult.enumerateObjects { asset, _, _ in
        assetsByIdentifier[asset.localIdentifier] = asset
      }

      var resultsByIdentifier: [String: [String: Any]] = [:]
      let resultsLock = NSLock()
      let group = DispatchGroup()

      for assetId in assetIds {
        guard let asset = assetsByIdentifier[assetId] else {
          continue
        }

        group.enter()
        processingQueue.async {
          self.semaphore.wait()
          defer { self.semaphore.signal() }

          self.loadAndClassifyImageSync(
            asset: asset,
            confidenceThreshold: confidenceThreshold,
            maxLabels: maxLabels
          ) { result in
            resultsLock.lock()
            switch result {
            case .success(let classificationResult):
              resultsByIdentifier[asset.localIdentifier] = classificationResult
            case .failure:
              resultsByIdentifier[asset.localIdentifier] = [
                "assetId": asset.localIdentifier,
                "labels": [],
                "error": "Classification failed",
              ]
            }
            resultsLock.unlock()
            group.leave()
          }
        }
      }

      group.notify(queue: .main) {
        let orderedResults = assetIds.compactMap { assetId in
          resultsByIdentifier[assetId]
        }
        promise.resolve(orderedResults)
      }
    }
  }

  private func mediaTypeToString(_ mediaType: PHAssetMediaType) -> String {
    switch mediaType {
    case .image:
      return "photo"
    case .video:
      return "video"
    case .audio:
      return "audio"
    default:
      return "unknown"
    }
  }

  private func loadAndClassifyImageSync(
    asset: PHAsset,
    confidenceThreshold: Float,
    maxLabels: Int,
    completion: @escaping (Result<[String: Any], Error>) -> Void
  ) {
    let options = PHImageRequestOptions()
    options.deliveryMode = .fastFormat
    options.isNetworkAccessAllowed = true
    options.isSynchronous = true
    options.resizeMode = .fast

    let targetSize = CGSize(width: 299, height: 299)

    PHImageManager.default().requestImage(
      for: asset,
      targetSize: targetSize,
      contentMode: .aspectFit,
      options: options
    ) { image, _ in
      guard let image = image, let cgImage = image.cgImage else {
        completion(
          .failure(
            NSError(
              domain: "ReactNativePhotoManagement",
              code: 1,
              userInfo: [NSLocalizedDescriptionKey: "Failed to load image"]
            )
          )
        )
        return
      }

      self.performClassification(
        cgImage: cgImage,
        assetId: asset.localIdentifier,
        confidenceThreshold: confidenceThreshold,
        maxLabels: maxLabels,
        completion: completion
      )
    }
  }

  private func performClassification(
    cgImage: CGImage,
    assetId: String,
    confidenceThreshold: Float,
    maxLabels: Int,
    completion: @escaping (Result<[String: Any], Error>) -> Void
  ) {
    let request = VNClassifyImageRequest()
    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])

    do {
      try handler.perform([request])

      guard let observations = request.results as? [VNClassificationObservation] else {
        completion(
          .failure(
            NSError(
              domain: "ReactNativePhotoManagement",
              code: 2,
              userInfo: [NSLocalizedDescriptionKey: "No classification results"]
            )
          )
        )
        return
      }

      let labels: [[String: Any]] = observations
        .filter { $0.confidence >= confidenceThreshold }
        .prefix(maxLabels)
        .map { observation in
          [
            "label": observation.identifier,
            "confidence": observation.confidence,
          ]
        }

      completion(.success([
        "assetId": assetId,
        "labels": labels,
      ]))
    } catch {
      completion(.failure(error))
    }
  }
}

struct ClassificationOptions: Record {
  @Field
  var confidenceThreshold: Float = 0.1

  @Field
  var maxLabels: Int = 50
}
