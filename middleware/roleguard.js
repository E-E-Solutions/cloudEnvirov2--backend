const CustomError = require("../errors");

const requireRole = (requiredRole) => {
  return (req, res, next) => {
    const userRole = req.user?.role;

    if (!userRole) {
      throw new CustomError.UnauthorizedError("User role is not assigned");
    }

    if (userRole !== requiredRole) {
      throw new CustomError.UnauthorizedError("You are not authorized to access this route");
    }

    next();
  };
};

module.exports = requireRole;
