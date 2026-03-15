package expo.modules.reactnativephotomanagement

import android.net.Uri
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.label.ImageLabeling
import com.google.mlkit.vision.label.defaults.ImageLabelerOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class ReactNativePhotoManagementModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ReactNativePhotoManagement")

    AsyncFunction("classifyImageUriBatch") { assetIds: List<String>, assetUris: List<String>, options: ClassificationOptions, promise: Promise ->
      classifyImageUriBatch(assetIds, assetUris, options, promise)
    }
  }

  private fun classifyImageUriBatch(
    assetIds: List<String>,
    assetUris: List<String>,
    options: ClassificationOptions,
    promise: Promise
  ) {
    if (assetIds.size != assetUris.size) {
      promise.reject(
        "ERR_INVALID_ARGUMENTS",
        "assetIds and assetUris must contain the same number of items."
      )
      return
    }

    if (assetIds.isEmpty()) {
      promise.resolve(emptyList<Map<String, Any?>>())
      return
    }

    val context = appContext.reactContext
    if (context == null) {
      promise.reject(
        "ERR_NO_REACT_CONTEXT",
        "React context is not available."
      )
      return
    }

    Thread {
      val labeler = ImageLabeling.getClient(
        ImageLabelerOptions.Builder()
          .setConfidenceThreshold(options.confidenceThreshold)
          .setMaxResultCount(options.maxLabels)
          .build()
      )

      try {
        val results = assetIds.indices.map { index ->
          classifySingleUri(
            assetId = assetIds[index],
            assetUri = assetUris[index],
            labeler = labeler
          )
        }

        promise.resolve(results)
      } catch (error: Exception) {
        promise.reject(
          "ERR_CLASSIFICATION_FAILED",
          error.message ?: "Image classification failed.",
          error
        )
      } finally {
        labeler.close()
      }
    }.start()
  }

  private fun classifySingleUri(
    assetId: String,
    assetUri: String,
    labeler: com.google.mlkit.vision.label.ImageLabeler
  ): Map<String, Any?> {
    val context = appContext.reactContext
      ?: return mapOf(
        "assetId" to assetId,
        "labels" to emptyList<Map<String, Any?>>(),
        "error" to "React context is not available."
      )

    return try {
      val image = InputImage.fromFilePath(context, Uri.parse(assetUri))
      val labels = Tasks.await(labeler.process(image)).map { label ->
        mapOf(
          "label" to label.text,
          "confidence" to label.confidence.toDouble()
        )
      }

      mapOf(
        "assetId" to assetId,
        "labels" to labels
      )
    } catch (error: Exception) {
      mapOf(
        "assetId" to assetId,
        "labels" to emptyList<Map<String, Any?>>(),
        "error" to (error.message ?: "Classification failed")
      )
    }
  }
}

class ClassificationOptions : Record {
  @Field
  var confidenceThreshold: Float = 0.1f

  @Field
  var maxLabels: Int = 50
}
