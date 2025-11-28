import multer from "multer";
import XLSX from "xlsx";
import archiver from "archiver";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 } // 200MB
});

export const config = {
  api: {
    bodyParser: false,
  },
};

function parseToLines(buffer, name) {
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const wb = XLSX.read(buffer, { type: "buffer" });
    const sheet = wb.SheetNames[0];
    const csv = XLSX.utils.sheet_to_csv(wb.Sheets[sheet]);
    return csv.split(/\r?\n/).filter(x => x.trim() !== "");
  }
  return buffer.toString("utf8").split(/\r?\n/);
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }

  await new Promise((resolve, reject) =>
    upload.single("file")(req, res, err => (err ? reject(err) : resolve()))
  );

  if (!req.file) {
    res.status(400).send("No file uploaded");
    return;
  }

  const linesPerFile = parseInt(req.body.linesPerFile || "1000", 10);
  const original = req.file.originalname;

  const lines = parseToLines(req.file.buffer, original);
  const parts = chunk(lines, linesPerFile);

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", 'attachment; filename="result.zip"');

  const zip = archiver("zip", { zlib: { level: 9 } });
  zip.pipe(res);

  const ext = original.endsWith(".txt") ? "txt" : "csv";

  parts.forEach((part, i) => {
    const name = `part-${i + 1}.${ext}`;
    zip.append(part.join("\n"), { name });
  });

  await zip.finalize();
}
