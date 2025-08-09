import jwt from "jsonwebtoken";
import prisma from "../../prisma/index";

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: "Unauthorized. Please log in." });
  }
  const token = authHeader.split(" ")[1];
  let user;
  try {
    const decoded = jwt.verify(token, process.env.USER_ACCESS_SECRET);
    user = await prisma.user.findUnique({
      where: {
        id: decoded,
      },
    });
    if (!user) {
      return res.status(401).json({ message: "Unauthorized. User not found." });
    }
    req.user = user;
    next();
  } catch (err) {
    console.error("Unauthorized. Invalid token: ", err);
    return res.status(401).json({ message: "Unauthorized. Invalid token." });
  }
};

export default authMiddleware;
