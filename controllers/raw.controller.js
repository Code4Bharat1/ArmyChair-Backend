import Raw from "../models/Raw.model.js";
/* ============================
   CREATE RAW MATERIAL
   (Admin + User allowed)
============================ */
export const createRaw = async (req, res) => {
  try {
    const { ProductName, type, colour, setNo, company, date } = req.body;

    if (
      !ProductName ||
      !type ||
      !colour ||
      setNo === undefined ||
      !company ||
      !date
    ) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const raw = await Raw.create({
      ProductName,
      type,
      colour,
      setNo,
      company,
      date,
      createdBy: req.user?.id,
      createdByRole: req.user?.role,
    });

    res.status(201).json({
      message: "Raw material added successfully",
      raw,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ============================
   GET ALL RAW MATERIALS
   (Admin + User)
============================ */
export const getAllRaw = async (req, res) => {
  try {
    const rawMaterials = await Raw.find().sort({ createdAt: -1 });

    res.status(200).json(rawMaterials);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ============================
   GET RAW MATERIAL BY ID
============================ */
export const getRawById = async (req, res) => {
  try {
    const raw = await Raw.findById(req.params.id);

    if (!raw) {
      return res.status(404).json({ message: "Raw material not found" });
    }

    res.status(200).json(raw);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ============================
   UPDATE RAW MATERIAL
   (Admin only)
============================ */
export const updateRaw = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Admin access only" });
    }

    const updatedRaw = await Raw.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedRaw) {
      return res.status(404).json({ message: "Raw material not found" });
    }

    res.status(200).json({
      message: "Raw material updated successfully",
      raw: updatedRaw,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ============================
   DELETE RAW MATERIAL
   (Admin only)
============================ */
export const deleteRaw = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Admin access only" });
    }

    const raw = await Raw.findByIdAndDelete(req.params.id);

    if (!raw) {
      return res.status(404).json({ message: "Raw material not found" });
    }

    res.status(200).json({ message: "Raw material deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
