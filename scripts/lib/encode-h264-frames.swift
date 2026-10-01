// H.264 (MP4) из последовательности PNG-кадров через AVFoundation + ImageIO (встроено в macOS).
// Видео-секвенции fallback: перематываются скроллом — ключевой кадр каждые <key> кадров,
// индекс (moov) — в начале файла.
// Использование: swift encode-h264-frames.swift <dir> <width> <height> <fps> <key> <bitrate> <out.mp4>
// Кадры: <dir>/frame_0000.png, frame_0001.png, … (масштабируются в width×height с обрезкой «cover»).
import AVFoundation
import CoreGraphics
import Foundation
import ImageIO

let args = CommandLine.arguments
guard args.count >= 8, let width = Int(args[2]), let height = Int(args[3]),
      let fps = Int32(args[4]), let key = Int(args[5]), let bitrate = Int(args[6]) else {
  FileHandle.standardError.write("usage: dir width height fps key bitrate out.mp4\n".data(using: .utf8)!)
  exit(2)
}
let dir = URL(fileURLWithPath: args[1])
let url = URL(fileURLWithPath: args[7])
try? FileManager.default.removeItem(at: url)
let files = try FileManager.default.contentsOfDirectory(atPath: dir.path)
  .filter { $0.hasPrefix("frame_") && $0.hasSuffix(".png") }
  .sorted()

func encode() throws {
  let writer = try AVAssetWriter(outputURL: url, fileType: .mp4)
  writer.shouldOptimizeForNetworkUse = true
  let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
    AVVideoCodecKey: AVVideoCodecType.h264,
    AVVideoWidthKey: width,
    AVVideoHeightKey: height,
    AVVideoCompressionPropertiesKey: [
      AVVideoAverageBitRateKey: bitrate,
      AVVideoMaxKeyFrameIntervalKey: key,
      AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
      AVVideoAllowFrameReorderingKey: false,
    ] as [String: Any],
  ])
  input.expectsMediaDataInRealTime = false
  let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
    kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
    kCVPixelBufferWidthKey as String: width,
    kCVPixelBufferHeightKey as String: height,
  ])
  writer.add(input)
  writer.startWriting()
  writer.startSession(atSourceTime: .zero)
  let space = CGColorSpace(name: CGColorSpace.sRGB)!
  for (index, name) in files.enumerated() {
    guard let source = CGImageSourceCreateWithURL(dir.appendingPathComponent(name) as CFURL, nil),
          let image = CGImageSourceCreateImageAtIndex(source, 0, nil),
          let pool = adaptor.pixelBufferPool else { continue }
    var buffer: CVPixelBuffer?
    CVPixelBufferPoolCreatePixelBuffer(nil, pool, &buffer)
    guard let pixel = buffer else { continue }
    CVPixelBufferLockBaseAddress(pixel, [])
    let context = CGContext(
      data: CVPixelBufferGetBaseAddress(pixel), width: width, height: height, bitsPerComponent: 8,
      bytesPerRow: CVPixelBufferGetBytesPerRow(pixel), space: space,
      bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue)!
    // «cover»: кадр заполняет видео целиком, лишнее обрезается по центру.
    let scale = max(Double(width) / Double(image.width), Double(height) / Double(image.height))
    let w = Double(image.width) * scale
    let h = Double(image.height) * scale
    context.interpolationQuality = .high
    context.draw(image, in: CGRect(x: (Double(width) - w) / 2, y: (Double(height) - h) / 2, width: w, height: h))
    CVPixelBufferUnlockBaseAddress(pixel, [])
    while !input.isReadyForMoreMediaData { usleep(1000) }
    adaptor.append(pixel, withPresentationTime: CMTime(value: CMTimeValue(index), timescale: fps))
  }
  input.markAsFinished()
  let done = DispatchSemaphore(value: 0)
  writer.finishWriting { done.signal() }
  done.wait()
  if writer.status != .completed {
    throw NSError(domain: "h264", code: 1, userInfo: [NSLocalizedDescriptionKey: writer.error?.localizedDescription ?? "ошибка"])
  }
}
try encode()
