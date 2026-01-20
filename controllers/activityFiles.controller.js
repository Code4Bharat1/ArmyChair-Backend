import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";

const verifyToken = (req, res) => {
  const token =
    req.query.token ||
    req.headers.authorization?.split(" ")[1];

  if (!token) {
    res.status(401).json({ message: "No token provided" });
    return null;
  }

  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
    return null;
  }
};

export const listActivityExports = async (req, res) => {
  const user = verifyToken(req, res);
  if (!user) return;

  try {
    const folder = path.join(process.cwd(), "exports");
    if (!fs.existsSync(folder)) {
      return res.json({ success: true, files: [] });
    }

    const files = fs.readdirSync(folder).filter(f => f.endsWith(".xlsx"));

    res.json({ success: true, files });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const downloadActivityExport = async (req, res) => {
  const user = verifyToken(req, res);
  if (!user) return;

  try {
    const { file } = req.params;
    const filePath = path.join(process.cwd(), "exports", file);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "File not found" });
    }

    res.download(filePath);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
