import jwt from "jsonwebtoken";

export const protect = (req, res, next) => {
  try {
    let token = req.headers.authorization;

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    token = token.replace("Bearer ", "");

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded; // { id, role, iat, exp }

    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};
export const productionOnly = (req, res, next) => {
  if (req.user.role !== "production") {
    return res.status(403).json({ message: "Production only route" });
  }
  next();
};

export const adminOnly = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin only route" });
  }
  next();
};

export const warehouseManagerOnly = (req, res, next) => {
  if (req.user.role !== "warehouse") {
    return res.status(403).json({ message: "Warehouse manager only route" });
  }
  next(); // ✅ REQUIRED
};

export const fittingManagerOnly = (req, res, next) => {
  if (req.user.role !== "fitting") {
    return res.status(403).json({ message: "Fitting manager only route" });
  }
  next(); // ✅ REQUIRED
};

export const salesManagerOnly = (req, res, next) => {
  if (req.user.role !== "sales") {
    return res.status(403).json({ message: "Sales manager only route" });
  }
  next(); // ✅ REQUIRED
};
export const returnAccess = (req, res, next) => {
  const role = req.user.role;

  if (
    role === "admin" ||
    role === "sales" ||
    role === "warehouse"||
    role === "fitting"
  ) {
    return next();
  }

  return res.status(403).json({
    message: "You are not allowed to access Returns",
  });
};

