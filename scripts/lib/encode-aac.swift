// AAC (.m4a) через AVFoundation — встроено в macOS, без сторонних программ.
// Читает моно PCM float32 (little-endian) из stdin.
// Использование: swift encode-aac.swift <sampleRate> <bitrate> <out.m4a>
import AVFoundation
import Foundation

let args = CommandLine.arguments
guard args.count >= 4, let rate = Double(args[1]), let bitrate = Int(args[2]) else {
  FileHandle.standardError.write("usage: sampleRate bitrate out.m4a\n".data(using: .utf8)!)
  exit(2)
}
let url = URL(fileURLWithPath: args[3])
try? FileManager.default.removeItem(at: url)

let data = FileHandle.standardInput.readDataToEndOfFile()
let count = data.count / 4
let format = AVAudioFormat(standardFormatWithSampleRate: rate, channels: 1)!
let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(count))!
buffer.frameLength = AVAudioFrameCount(count)
data.withUnsafeBytes { (src: UnsafeRawBufferPointer) in
  let samples = src.bindMemory(to: Float.self)
  let out = buffer.floatChannelData![0]
  for i in 0..<count { out[i] = samples[i] }
}
// Файл закрывается (и дописывается индекс MP4) при уничтожении объекта — поэтому внутри функции:
// глобальная переменная скрипта не уничтожается до выхода, и файл остался бы незавершённым.
func write() throws {
  let file = try AVAudioFile(forWriting: url, settings: [
    AVFormatIDKey: kAudioFormatMPEG4AAC,
    AVSampleRateKey: rate,
    AVNumberOfChannelsKey: 1,
    AVEncoderBitRateKey: bitrate,
  ])
  try file.write(from: buffer)
}
try write()
