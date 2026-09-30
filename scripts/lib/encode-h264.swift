// H.264 (MP4) без альфы через AVFoundation — встроено в macOS, без сторонних программ.
// Видео облёта фазенды: его перематывает скролл, поэтому ключевой кадр — каждые <key> кадров,
// индекс (moov) — в начале файла (перемотка до полной загрузки).
// Читает кадры RGBA из stdin: width*height*4 байт на кадр (альфа игнорируется).
// Использование: swift encode-h264.swift <width> <height> <fps> <frames> <key> <out.mp4>
import AVFoundation
import CoreVideo
import Foundation

let args = CommandLine.arguments
guard args.count >= 7, let width = Int(args[1]), let height = Int(args[2]),
      let fps = Int32(args[3]), let frames = Int(args[4]), let key = Int(args[5]) else {
  FileHandle.standardError.write("usage: width height fps frames key out.mp4\n".data(using: .utf8)!)
  exit(2)
}
let url = URL(fileURLWithPath: args[6])
try? FileManager.default.removeItem(at: url)

let writer = try AVAssetWriter(outputURL: url, fileType: .mp4)
writer.shouldOptimizeForNetworkUse = true
let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
  AVVideoCodecKey: AVVideoCodecType.h264,
  AVVideoWidthKey: width,
  AVVideoHeightKey: height,
  AVVideoCompressionPropertiesKey: [
    AVVideoAverageBitRateKey: 1_400_000,
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

let frameBytes = width * height * 4
let stdin = FileHandle.standardInput
for index in 0..<frames {
  var data = Data()
  while data.count < frameBytes {
    let chunk = stdin.readData(ofLength: frameBytes - data.count)
    if chunk.isEmpty { break }
    data.append(chunk)
  }
  guard data.count == frameBytes, let pool = adaptor.pixelBufferPool else { break }
  var buffer: CVPixelBuffer?
  CVPixelBufferPoolCreatePixelBuffer(nil, pool, &buffer)
  guard let pixel = buffer else { break }
  CVPixelBufferLockBaseAddress(pixel, [])
  let base = CVPixelBufferGetBaseAddress(pixel)!.assumingMemoryBound(to: UInt8.self)
  let stride = CVPixelBufferGetBytesPerRow(pixel)
  data.withUnsafeBytes { (src: UnsafeRawBufferPointer) in
    for y in 0..<height {
      for x in 0..<width {
        let s = (y * width + x) * 4
        let d = y * stride + x * 4
        base[d + 0] = src[s + 2] // B
        base[d + 1] = src[s + 1] // G
        base[d + 2] = src[s + 0] // R
        base[d + 3] = 255
      }
    }
  }
  CVPixelBufferUnlockBaseAddress(pixel, [])
  while !input.isReadyForMoreMediaData { usleep(1000) }
  adaptor.append(pixel, withPresentationTime: CMTime(value: CMTimeValue(index), timescale: fps))
}
input.markAsFinished()
let done = DispatchSemaphore(value: 0)
writer.finishWriting { done.signal() }
done.wait()
if writer.status != .completed {
  FileHandle.standardError.write("H.264: \(writer.error?.localizedDescription ?? "ошибка")\n".data(using: .utf8)!)
  exit(1)
}
