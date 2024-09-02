const CustomError = require("../errors");
const jwt = require("jsonwebtoken");

const authenticateUser = async (req, res, next) => {
  const acessToken = req.headers.authorization.split(" ")[1];
  // console.log("access token : ", acessToken);
  if (!acessToken) {
    throw new CustomError.UnauthorizedError(
      "Not authorized Please Login again"
    );
  }

  try {
    if (acessToken) {
      // console.log(process.env.ACCESS_TOKEN_SECRET);
      const payload = jwt.verify(acessToken, process.env.ACCESS_TOKEN_SECRET);
      // console.log(payload);
      req.user = payload;
      return next();
    }
    next();
  } catch (error) {
    throw new CustomError.UnauthenticatedError(
      `Authentication Invalid ${error}`
    );
  }
};

const authorizePermissions = (...roles) => {
  return (req, res, next) => {
    // console.log(req.user, roles, req.user.role);
    // console.log(roles.includes(req.user.role));
    if (!roles.includes(req.user.role)) {
      throw new CustomError.UnauthorizedError(
        "Unauthorized to access this route"
      );
    }
    next();
  };
};

module.exports = {
  authenticateUser,
  authorizePermissions,
};
