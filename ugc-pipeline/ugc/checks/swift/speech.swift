import Speech
import AVFoundation
import Foundation

// usage: speech <audio file> <locale, e.g. en-US> [contextual string]...; prints JSON {"text", "words":[{"w","s","e"}]} or {"error"}.

func emit(_ obj: [String: Any], code: Int32 = 0) -> Never {
    let data = try! JSONSerialization.data(withJSONObject: obj)
    print(String(data: data, encoding: .utf8)!)
    exit(code)
}

@main
struct Main {
    static func main() async {
        let args = CommandLine.arguments
        guard args.count >= 3 else { emit(["error": "usage: speech <audio file> <locale>"], code: 2) }
        let locale = Locale(identifier: args[2])
        let installed = await SpeechTranscriber.installedLocales
        let want = locale.identifier(.bcp47).lowercased()
        guard installed.contains(where: { $0.identifier(.bcp47).lowercased() == want }) else {
            let have = installed.map { $0.identifier(.bcp47) }.sorted().joined(separator: ", ")
            emit(["error": "speech locale \(args[2]) is not installed on this Mac (installed: \(have)). Add it in System Settings > General > Language & Region > Dictation languages, or use an installed locale."], code: 3)
        }
        do {
            let t = SpeechTranscriber(locale: locale, transcriptionOptions: [], reportingOptions: [], attributeOptions: [.audioTimeRange])
            let a = SpeechAnalyzer(modules: [t])
            if args.count > 3 {
                let ctx = AnalysisContext()
                ctx.contextualStrings[.general] = Array(args[3...])
                try await a.setContext(ctx)
            }
            let file = try AVAudioFile(forReading: URL(fileURLWithPath: args[1]))
            let collector = Task { () -> ([[String: Any]], String) in
                var words: [[String: Any]] = []
                var text = ""
                for try await r in t.results where r.isFinal {
                    text += String(r.text.characters) + " "
                    for run in r.text.runs {
                        guard let tr = run.audioTimeRange else { continue }
                        let toks = String(r.text[run.range].characters).split(whereSeparator: { $0.isWhitespace })
                        guard !toks.isEmpty else { continue }
                        let s = tr.start.seconds, d = tr.duration.seconds / Double(toks.count)
                        for (i, tok) in toks.enumerated() {
                            words.append(["w": String(tok), "s": s + d * Double(i), "e": s + d * Double(i + 1)])
                        }
                    }
                }
                return (words, text)
            }
            if let last = try await a.analyzeSequence(from: file) {
                try await a.finalizeAndFinish(through: last)
            } else {
                await a.cancelAndFinishNow()
            }
            let (words, text) = try await collector.value
            emit(["text": text.trimmingCharacters(in: .whitespaces), "words": words])
        } catch {
            emit(["error": "speech analysis failed: \(error)"], code: 1)
        }
    }
}
