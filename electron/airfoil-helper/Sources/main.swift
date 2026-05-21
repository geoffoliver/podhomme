import Cocoa
import Foundation

// MARK: - Logging

private let logFileURL: URL = {
    let dir = FileManager.default.urls(for: .libraryDirectory, in: .userDomainMask)[0]
        .appendingPathComponent("Logs/Podhomme", isDirectory: true)
    try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    return dir.appendingPathComponent("AirfoilHelper.log")
}()

private let logDateFormatter: DateFormatter = {
    let f = DateFormatter()
    f.dateFormat = "yyyy-MM-dd HH:mm:ss.SSS"
    return f
}()

private func log(_ message: String) {
    let line = "[\(logDateFormatter.string(from: Date()))] \(message)\n"
    NSLog("[AirfoilHelper] %@", message)
    guard let data = line.data(using: .utf8) else { return }
    if FileManager.default.fileExists(atPath: logFileURL.path) {
        if let handle = try? FileHandle(forWritingTo: logFileURL) {
            handle.seekToEndOfFile()
            handle.write(data)
            try? handle.close()
        }
    } else {
        try? data.write(to: logFileURL, options: .atomic)
    }
}

// MARK: - HTTP helpers

private let kBaseURL = "http://localhost:3030"
private var stateCache: [String: Any]?
private var stateCacheTime: Date?
private let kCacheTTL: TimeInterval = 2.0

private func fetchPlaybackState() -> [String: Any]? {
    if let cached = stateCache,
       let time = stateCacheTime,
       Date().timeIntervalSince(time) < kCacheTTL {
        return cached
    }
    guard let url = URL(string: "\(kBaseURL)/api/playback") else { return nil }
    var result: [String: Any]?
    var httpError: String?
    let sem = DispatchSemaphore(value: 0)
    URLSession.shared.dataTask(with: url) { data, response, error in
        defer { sem.signal() }
        if let error = error {
            httpError = error.localizedDescription
            return
        }
        guard let data = data else { return }
        result = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    }.resume()
    let timedOut = sem.wait(timeout: .now() + 3) == .timedOut
    if timedOut {
        log("fetchPlaybackState: timed out connecting to \(kBaseURL)")
    } else if let err = httpError {
        log("fetchPlaybackState: HTTP error — \(err)")
    }
    stateCache = result
    stateCacheTime = Date()
    return result
}

private func postAction(_ action: String) {
    guard let url = URL(string: "\(kBaseURL)/api/playback") else { return }
    var req = URLRequest(url: url)
    req.httpMethod = "POST"
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.httpBody = try? JSONSerialization.data(withJSONObject: ["action": action])
    log("postAction: \(action)")
    let sem = DispatchSemaphore(value: 0)
    URLSession.shared.dataTask(with: req) { _, _, error in
        if let error = error { log("postAction \(action) error: \(error.localizedDescription)") }
        sem.signal()
    }.resume()
    _ = sem.wait(timeout: .now() + 3)
    stateCache = nil
}

private func postSeek(_ position: Double) {
    guard let url = URL(string: "\(kBaseURL)/api/playback") else { return }
    var req = URLRequest(url: url)
    req.httpMethod = "POST"
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.httpBody = try? JSONSerialization.data(withJSONObject: ["action": "seek", "position": position])
    log("postSeek: \(position)")
    let sem = DispatchSemaphore(value: 0)
    URLSession.shared.dataTask(with: req) { _, _, error in
        if let error = error { log("postSeek error: \(error.localizedDescription)") }
        sem.signal()
    }.resume()
    _ = sem.wait(timeout: .now() + 3)
    stateCache = nil
}

private func tiffData(fromURLString urlString: String) -> NSData? {
    guard let url = URL(string: urlString) else {
        log("tiffData: invalid URL '\(urlString)'")
        return nil
    }
    var raw: Data?
    let sem = DispatchSemaphore(value: 0)
    URLSession.shared.dataTask(with: url) { data, _, error in
        if let error = error { log("tiffData fetch error: \(error.localizedDescription)") }
        raw = data
        sem.signal()
    }.resume()
    _ = sem.wait(timeout: .now() + 5)
    guard let raw, let image = NSImage(data: raw) else {
        log("tiffData: could not decode image from \(urlString)")
        return nil
    }

    // Cap at 512×512 — large images can overflow the AppleScript transport buffer
    let maxDim: CGFloat = 512
    let size = image.size
    let tiffSource: NSImage
    if size.width > maxDim || size.height > maxDim {
        let scale = maxDim / max(size.width, size.height)
        let newSize = CGSize(width: size.width * scale, height: size.height * scale)
        let scaled = NSImage(size: newSize)
        scaled.lockFocus()
        image.draw(in: NSRect(origin: .zero, size: newSize))
        scaled.unlockFocus()
        tiffSource = scaled
    } else {
        tiffSource = image
    }
    return tiffSource.tiffRepresentation as NSData?
}

// MARK: - AppDelegate

@objc class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.prohibited)
        log("AirfoilHelper launched — bundle ID: \(Bundle.main.bundleIdentifier ?? "unknown"), bundle path: \(Bundle.main.bundlePath)")
        log("Scripting definition: \(Bundle.main.infoDictionary?["OSAScriptingDefinition"] as? String ?? "not set")")
    }

    // MARK: AppleScript properties — Cocoa scripting calls these via KVC

    @objc var trackTitle: String {
        let val = episodeString("title") ?? ""
        log("trackTitle queried → '\(val)'")
        return val
    }

    @objc var artist: String {
        let val = podcastString("title") ?? ""
        log("artist queried → '\(val)'")
        return val
    }

    @objc var album: String {
        let val = podcastString("title") ?? ""
        log("album queried → '\(val)'")
        return val
    }

    @objc var duration: Int {
        guard let ep = currentEpisode() else {
            log("duration queried → 0 (no episode)")
            return 0
        }
        let val: Int
        if let d = ep["duration"] as? Int { val = d }
        else if let d = ep["duration"] as? Double { val = Int(d) }
        else { val = 0 }
        log("duration queried → \(val)")
        return val
    }

    @objc var logo: NSData? {
        guard let ep = currentEpisode() else {
            log("logo queried → nil (no episode)")
            return nil
        }
        let urlStr = (ep["imageUrl"] as? String)
            ?? (ep["podcast"] as? [String: Any])?["imageUrl"] as? String
        guard let urlStr else {
            log("logo queried → nil (no image URL)")
            return nil
        }
        log("logo queried — fetching \(urlStr)")
        return tiffData(fromURLString: urlStr)
    }

    // MARK: Private

    private func currentEpisode() -> [String: Any]? {
        fetchPlaybackState()?["episode"] as? [String: Any]
    }

    private func episodeString(_ key: String) -> String? {
        currentEpisode()?[key] as? String
    }

    private func podcastString(_ key: String) -> String? {
        (currentEpisode()?["podcast"] as? [String: Any])?[key] as? String
    }
}

// MARK: - Command handlers

@objc(PHPlayPauseCommand)
class PlayPauseCommand: NSScriptCommand {
    override func performDefaultImplementation() -> Any? {
        log("command: playpause")
        let isPlaying = fetchPlaybackState()?["isPlaying"] as? Bool ?? false
        postAction(isPlaying ? "pause" : "play")
        return nil
    }
}

@objc(PHNextCommand)
class NextCommand: NSScriptCommand {
    override func performDefaultImplementation() -> Any? {
        log("command: next")
        postAction("next")
        return nil
    }
}

@objc(PHPrevCommand)
class PrevCommand: NSScriptCommand {
    override func performDefaultImplementation() -> Any? {
        log("command: previous")
        postAction("prev")
        return nil
    }
}

@objc(PHSeekForwardCommand)
class SeekForwardCommand: NSScriptCommand {
    override func performDefaultImplementation() -> Any? {
        log("command: seek forward")
        guard let state = fetchPlaybackState() else { return nil }
        let pos = state["position"] as? Double ?? (state["position"] as? Int).map(Double.init) ?? 0
        postSeek(pos + 30)
        return nil
    }
}

@objc(PHSeekBackwardCommand)
class SeekBackwardCommand: NSScriptCommand {
    override func performDefaultImplementation() -> Any? {
        log("command: seek backward")
        guard let state = fetchPlaybackState() else { return nil }
        let pos = state["position"] as? Double ?? (state["position"] as? Int).map(Double.init) ?? 0
        postSeek(max(0, pos - 15))
        return nil
    }
}

// MARK: - Entry point

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
