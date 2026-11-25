import Vision
import Foundation
import ImageIO

// usage: face <sheet image or -> <frame image>...
// Prints {"sheet_faces": n, "frames": [{"faces": k, "distance": d|null, "drift": d|null}]} or {"error"}.
// distance: feature-print distance between a frame's face crop and the sheet's face crop.
// drift: feature-print distance between a frame's face crop and the first single-face frame's crop.
// Feature prints are a general image-similarity measure, not face recognition.

func emit(_ obj: [String: Any], code: Int32 = 0) -> Never {
    let data = try! JSONSerialization.data(withJSONObject: obj)
    print(String(data: data, encoding: .utf8)!)
    exit(code)
}

func load(_ path: String) -> CGImage? {
    guard let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: path) as CFURL, nil) else { return nil }
    return CGImageSourceCreateImageAtIndex(src, 0, nil)
}

func faces(_ img: CGImage) throws -> [VNFaceObservation] {
    let req = VNDetectFaceRectanglesRequest()
    try VNImageRequestHandler(cgImage: img, options: [:]).perform([req])
    return req.results ?? []
}

func crop(_ img: CGImage, _ f: VNFaceObservation) -> CGImage? {
    let w = CGFloat(img.width), h = CGFloat(img.height)
    let b = f.boundingBox
    var r = CGRect(x: b.minX * w, y: (1 - b.maxY) * h, width: b.width * w, height: b.height * h)
    r = r.insetBy(dx: -r.width * 0.25, dy: -r.height * 0.25).intersection(CGRect(x: 0, y: 0, width: w, height: h))
    return img.cropping(to: r.integral)
}

func print_(_ img: CGImage) throws -> VNFeaturePrintObservation? {
    let req = VNGenerateImageFeaturePrintRequest()
    try VNImageRequestHandler(cgImage: img, options: [:]).perform([req])
    return req.results?.first
}

func dist(_ a: VNFeaturePrintObservation, _ b: VNFeaturePrintObservation) -> Double? {
    var d: Float = 0
    do { try a.computeDistance(&d, to: b) } catch { return nil }
    return Double(d)
}

@main
struct Main {
    static func main() {
        let args = CommandLine.arguments
        guard args.count >= 3 else { emit(["error": "usage: face <sheet image or -> <frame image>..."], code: 2) }
        do {
            var sheetPrint: VNFeaturePrintObservation? = nil
            var sheetFaces = 0
            if args[1] != "-" {
                guard let sheet = load(args[1]) else { emit(["error": "cannot read sheet image \(args[1])"], code: 2) }
                let fs = try faces(sheet)
                sheetFaces = fs.count
                guard let big = fs.max(by: { $0.boundingBox.width < $1.boundingBox.width }), let c = crop(sheet, big) else {
                    emit(["error": "no face found in the character sheet \(args[1]); the sheet needs one face close-up panel"], code: 4)
                }
                sheetPrint = try print_(c)
            }
            var first: VNFeaturePrintObservation? = nil
            var rows: [[String: Any]] = []
            for path in args[2...] {
                guard let img = load(path) else { emit(["error": "cannot read frame \(path)"], code: 2) }
                let fs = try faces(img)
                var row: [String: Any] = ["faces": fs.count, "distance": NSNull(), "drift": NSNull()]
                if fs.count == 1, let c = crop(img, fs[0]), let p = try print_(c) {
                    if let s = sheetPrint, let d = dist(p, s) { row["distance"] = d }
                    if let f = first { if let d = dist(p, f) { row["drift"] = d } } else { first = p; row["drift"] = 0.0 }
                }
                rows.append(row)
            }
            emit(["sheet_faces": sheetFaces, "frames": rows])
        } catch {
            emit(["error": "vision failed: \(error)"], code: 1)
        }
    }
}
