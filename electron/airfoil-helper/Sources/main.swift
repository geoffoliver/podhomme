import Cocoa
import Foundation

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
    let sem = DispatchSemaphore(value: 0)
    URLSession.shared.dataTask(with: url) { data, _, _ in
        defer { sem.signal() }
        guard let data = data else { return }
        result = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    }.resume()
    _ = sem.wait(timeout: .now() + 3)
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
    let sem = DispatchSemaphore(value: 0)
    URLSession.shared.dataTask(with: req) { _, _, _ in sem.signal() }.resume()
    _ = sem.wait(timeout: .now() + 3)
    // Invalidate cache so the next property read reflects the new state
    stateCache = nil
}

private func postSeek(_ position: Double) {
    guard let url = URL(string: "\(kBaseURL)/api/playback") else { return }
    var req = URLRequest(url: url)
    req.httpMethod = "POST"
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.httpBody = try? JSONSerialization.data(withJSONObject: ["action": "seek", "position": position])
    let sem = DispatchSemaphore(value: 0)
    URLSession.shared.dataTask(with: req) { _, _, _ in sem.signal() }.resume()
    _ = sem.wait(timeout: .now() + 3)
    stateCache = nil
}

private func tiffData(fromURLString urlString: String) -> NSData? {
    guard let url = URL(string: urlString) else { return nil }
    var raw: Data?
    let sem = DispatchSemaphore(value: 0)
    URLSession.shared.dataTask(with: url) { data, _, _ in
        raw = data
        sem.signal()
    }.resume()
    _ = sem.wait(timeout: .now() + 5)
    guard let raw, let image = NSImage(data: raw) else { return nil }

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
    }

    // MARK: AppleScript properties — Cocoa scripting calls these via KVC

    @objc var trackTitle: String {
        episodeString("title") ?? ""
    }

    @objc var artist: String {
        podcastString("title") ?? ""
    }

    @objc var album: String {
        podcastString("title") ?? ""
    }

    @objc var duration: Int {
        guard let ep = currentEpisode() else { return 0 }
        if let d = ep["duration"] as? Int { return d }
        if let d = ep["duration"] as? Double { return Int(d) }
        return 0
    }

    @objc var logo: NSData? {
        guard let ep = currentEpisode() else { return nil }
        let urlStr = (ep["imageUrl"] as? String)
            ?? (ep["podcast"] as? [String: Any])?["imageUrl"] as? String
        guard let urlStr else { return nil }
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
        let isPlaying = fetchPlaybackState()?["isPlaying"] as? Bool ?? false
        postAction(isPlaying ? "pause" : "play")
        return nil
    }
}

@objc(PHNextCommand)
class NextCommand: NSScriptCommand {
    override func performDefaultImplementation() -> Any? {
        postAction("next")
        return nil
    }
}

@objc(PHPrevCommand)
class PrevCommand: NSScriptCommand {
    override func performDefaultImplementation() -> Any? {
        postAction("prev")
        return nil
    }
}

@objc(PHSeekForwardCommand)
class SeekForwardCommand: NSScriptCommand {
    override func performDefaultImplementation() -> Any? {
        guard let state = fetchPlaybackState() else { return nil }
        let pos = state["position"] as? Double ?? (state["position"] as? Int).map(Double.init) ?? 0
        postSeek(pos + 30)
        return nil
    }
}

@objc(PHSeekBackwardCommand)
class SeekBackwardCommand: NSScriptCommand {
    override func performDefaultImplementation() -> Any? {
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
