// HEVC с альфой (для Safari) через AVFoundation — встроено в macOS, без сторонних программ.
// Читает кадры RGBA (непредумноженная альфа) из stdin: width*height*4 байт на кадр.
// Использование: swift encode-hevc-alpha.swift <width> <height> <fps> <frames> <out.mov>
import AVFoundation
import CoreVideo
import Foundation

let args = CommandLine.arguments
guard args.count == 6, let width = Int(args[1]), let height = Int(args[2]),
      let fps = Int32(args[3]), let frames = Int(args[4]) else {
  FileHandle.standardError.write("usage: width height fps frames out.mov\n".data(using: .utf8)!)
  exit(2)
}
let url = URL(fileURLWithPath: args[5])
try? FileManager.default.removeItem(at: url)

let writer = try AVAssetWriter(outputURL: url, fileType: .mov)
let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
  AVVideoCodecKey: AVVideoCodecType.hevcWithAlpha,
  AVVideoWidthKey: width,
  AVVideoHeightKey: height,
  AVVideoCompressionPropertiesKey: [AVVideoQualityKey: 0.85],
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
  // Предумноженная альфа — так её ждёт кодек и так она правильно смешивается при показе.
  CVBufferSetAttachment(pixel, kCVImageBufferAlphaChannelModeKey, kCVImageBufferAlphaChannelMode_PremultipliedAlpha, .shouldPropagate)
  CVPixelBufferLockBaseAddress(pixel, [])
  let base = CVPixelBufferGetBaseAddress(pixel)!.assumingMemoryBound(to: UInt8.self)
  let stride = CVPixelBufferGetBytesPerRow(pixel)
  data.withUnsafeBytes { (src: UnsafeRawBufferPointer) in
    for y in 0..<height {
      for x in 0..<width {
        let s = (y * width + x) * 4
        let d = y * stride + x * 4
        let a = Int(src[s + 3])
        base[d + 0] = UInt8(Int(src[s + 2]) * a / 255) // B
        base[d + 1] = UInt8(Int(src[s + 1]) * a / 255) // G
        base[d + 2] = UInt8(Int(src[s + 0]) * a / 255) // R
        base[d + 3] = UInt8(a)
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
  FileHandle.standardError.write("HEVC: \(writer.error?.localizedDescription ?? "ошибка")\n".data(using: .utf8)!)
  exit(1)
}
